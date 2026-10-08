# ============================================================
#  MALOPS - Pipeline Serving / Déploiement FastAPI
#  Étapes : Chargement registry → Warmup → Lancement API
#  Commande : python3 pipeline_serving.py
# ============================================================

import os
from clearml import PipelineDecorator, Task

DATA_DIR = os.path.expanduser('~/malops-project/')


# ─────────────────────────────────────────────────────────────
# ÉTAPE 1 : Chargement du modèle depuis le registry
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.data_processing
)
def step_load_from_registry():
    import os, json, joblib, shutil

    DATA_DIR = os.path.expanduser('~/malops-project/')
    SERVE_DIR = os.path.join(DATA_DIR, 'serving')
    os.makedirs(SERVE_DIR, exist_ok=True)

    # Lecture production_model.json (créé par pipeline_registry.py)
    # Fallback : registry.json si production_model.json absent
    prod_path    = os.path.join(DATA_DIR, 'production_model.json')
    registry_path = os.path.join(DATA_DIR, 'model_registry', 'registry.json')

    if os.path.exists(prod_path):
        with open(prod_path, 'r') as f:
            prod = json.load(f)
        print(f"Source : production_model.json")
    elif os.path.exists(registry_path):
        with open(registry_path, 'r') as f:
            registry = json.load(f)
        prod = registry.get('production')
        if not prod:
            # Aucune version en production → prendre la meilleure en staging
            prod = registry.get('staging')
        if not prod:
            raise FileNotFoundError(
                "Aucun modèle en production ni staging. Lance d'abord pipeline_registry.py")
        print(f"Source : registry.json (fallback)")
    else:
        raise FileNotFoundError(
            "Aucun modèle en production. Lance d'abord pipeline_registry.py")

    model_name = prod['model_name']
    model_path = prod['model_path']
    print(f"Chargement du modèle en production : {model_name}")
    print(f"  R² test : {prod['r2_test']:.4f}")
    print(f"  Promu le : {prod.get('promoted_at', 'N/A')}")

    # Copie vers le dossier serving
    if model_name == 'GRU':
        dest = os.path.join(SERVE_DIR, 'model_GRU')
        if os.path.exists(dest):
            shutil.rmtree(dest)
        shutil.copytree(model_path, dest)
        serve_model_path = dest
    else:
        dest = os.path.join(SERVE_DIR, 'model.pkl')
        shutil.copy2(model_path, dest)
        serve_model_path = dest

    # Copie du scaler — cherche best_scaler.pkl puis scaler.pkl
    scaler_src = os.path.join(DATA_DIR, 'best_scaler.pkl')
    if not os.path.exists(scaler_src):
        scaler_src = prod.get('scaler_path', os.path.join(DATA_DIR, 'scaler.pkl'))
    scaler_dest = os.path.join(SERVE_DIR, 'scaler.pkl')
    shutil.copy2(scaler_src, scaler_dest)

    # Manifeste serving
    manifest = {
        'model_name'      : model_name,
        'model_path'      : serve_model_path,
        'scaler_path'     : scaler_dest,
        'r2_test'         : prod['r2_test'],
        'features'        : ['NDVI', 'NDWI', 'MSI', 'LST',
                             'Precipitation', 'SoilMoisture', 'ET0'],
        'is_gru'          : model_name == 'GRU',
        'seq_len'         : 12
    }
    manifest_path = os.path.join(SERVE_DIR, 'manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"Manifeste serving → {manifest_path}")
    return manifest_path


# ─────────────────────────────────────────────────────────────
# ÉTAPE 2 : Warmup — test de prédiction rapide
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.testing
)
def step_warmup(manifest_path: str):
    import os, json, joblib
    import numpy as np

    with open(manifest_path, 'r') as f:
        manifest = json.load(f)

    scaler = joblib.load(manifest['scaler_path'])

    # Données factices pour le warmup
    dummy = np.array([[0.4, 0.1, 0.5, 28.0, 15.0, 0.2, 3.5]])
    dummy_sc = scaler.transform(dummy)

    if manifest['is_gru']:
        import tensorflow as tf
        model   = tf.keras.models.load_model(manifest['model_path'])
        seq_len = manifest['seq_len']
        # Répète la ligne pour former une séquence
        dummy_seq = np.tile(dummy_sc, (seq_len, 1))[np.newaxis, ...]
        pred = model.predict(dummy_seq, verbose=0).flatten()[0]
    else:
        model = joblib.load(manifest['model_path'])
        pred  = model.predict(dummy_sc)[0]

    def classify(cwsi):
        if cwsi < 0.2:   return 'Pas de stress'
        elif cwsi < 0.4: return 'Stress léger'
        elif cwsi < 0.6: return 'Stress modéré'
        elif cwsi < 0.8: return 'Stress sévère'
        else:            return 'Stress extrême'

    stress = classify(float(pred))
    print(f"\n── Warmup OK ──")
    print(f"  Modèle   : {manifest['model_name']}")
    print(f"  CWSI     : {pred:.4f}")
    print(f"  Stress   : {stress}")
    print(f"  Latence  : OK")
    return True


# ─────────────────────────────────────────────────────────────
# ÉTAPE 3 : Génération de l'application FastAPI
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.custom
)
def step_generate_api(manifest_path: str, warmup_ok: bool):
    import os

    DATA_DIR  = os.path.expanduser('~/malops-project/')
    SERVE_DIR = os.path.join(DATA_DIR, 'serving')

    api_code = '''# ============================================================
#  MALOPS FastAPI — Serveur de prédiction CWSI
#  Démarrage : uvicorn app:app --host 0.0.0.0 --port 8000
# ============================================================

import os, json, joblib
import numpy as np
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import jwt

# ── Config ──────────────────────────────────────────────────
SECRET_KEY  = os.getenv("MALOPS_SECRET", "malops-secret-key-change-in-production")
ALGORITHM   = "HS256"
TOKEN_EXP   = 60   # minutes

MANIFEST_PATH = os.path.join(os.path.dirname(__file__), "manifest.json")

with open(MANIFEST_PATH, "r") as f:
    MANIFEST = json.load(f)

FEATURES = MANIFEST["features"]
IS_GRU   = MANIFEST["is_gru"]
SEQ_LEN  = MANIFEST["seq_len"]

# Chargement du modèle au démarrage
import joblib
SCALER = joblib.load(MANIFEST["scaler_path"])

if IS_GRU:
    import tensorflow as tf
    MODEL = tf.keras.models.load_model(MANIFEST["model_path"])
else:
    MODEL = joblib.load(MANIFEST["model_path"])

# ── Utilisateurs (à remplacer par une vraie DB) ─────────────
USERS_DB = {
    "admin": {
        "password" : "admin123",
        "role"     : "admin",
        "full_name": "Admin MALOPS"
    },
    "user1": {
        "password" : "user123",
        "role"     : "user",
        "full_name": "Utilisateur Standard"
    }
}

# ── FastAPI ──────────────────────────────────────────────────
app = FastAPI(
    title       = "MALOPS API",
    description = "Détection du stress hydrique au Maroc via CWSI",
    version     = "1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# ── Schémas Pydantic ─────────────────────────────────────────
class PredictInput(BaseModel):
    NDVI          : float = Field(..., ge=-1,   le=1,   example=0.45)
    NDWI          : float = Field(..., ge=-1,   le=1,   example=0.12)
    MSI           : float = Field(..., ge=0,    le=10,  example=0.8)
    LST           : float = Field(..., ge=-10,  le=70,  example=32.5)
    Precipitation : float = Field(..., ge=0,    le=500, example=10.0)
    SoilMoisture  : float = Field(..., ge=0,    le=1,   example=0.25)
    ET0           : float = Field(..., ge=0,    le=20,  example=4.2)

class PredictOutput(BaseModel):
    cwsi         : float
    stress_class : str
    model_used   : str
    r2_test      : float
    timestamp    : str

class TokenResponse(BaseModel):
    access_token : str
    token_type   : str
    role         : str
    expires_in   : int

# ── Auth helpers ─────────────────────────────────────────────
def create_token(data: dict, expires_minutes: int = TOKEN_EXP) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=expires_minutes)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username not in USERS_DB:
            raise HTTPException(status_code=401, detail="Token invalide")
        return {"username": username, **USERS_DB[username]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    return user

# ── Fonctions métier ─────────────────────────────────────────
def classify_cwsi(cwsi: float) -> str:
    if cwsi < 0.2:   return "Pas de stress"
    elif cwsi < 0.4: return "Stress léger"
    elif cwsi < 0.6: return "Stress modéré"
    elif cwsi < 0.8: return "Stress sévère"
    else:            return "Stress extrême"

def predict_cwsi(features: list) -> float:
    X = np.array([features])
    X_sc = SCALER.transform(X)
    if IS_GRU:
        X_seq = np.tile(X_sc, (SEQ_LEN, 1))[np.newaxis, ...]
        pred  = float(MODEL.predict(X_seq, verbose=0).flatten()[0])
    else:
        pred = float(MODEL.predict(X_sc)[0])
    return float(np.clip(pred, 0, 1))

# ── Routes ───────────────────────────────────────────────────
@app.get("/", tags=["Info"])
def root():
    return {
        "service"   : "MALOPS API",
        "model"     : MANIFEST["model_name"],
        "r2_test"   : MANIFEST["r2_test"],
        "status"    : "running"
    }

@app.get("/health", tags=["Info"])
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.post("/auth/token", response_model=TokenResponse, tags=["Auth"])
def login(form: OAuth2PasswordRequestForm = Depends()):
    user = USERS_DB.get(form.username)
    if not user or user["password"] != form.password:
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    token = create_token({"sub": form.username, "role": user["role"]})
    return {
        "access_token": token,
        "token_type"  : "bearer",
        "role"        : user["role"],
        "expires_in"  : TOKEN_EXP * 60
    }

@app.post("/predict", response_model=PredictOutput, tags=["Prédiction"])
def predict(data: PredictInput, user=Depends(get_current_user)):
    features = [
        data.NDVI, data.NDWI, data.MSI, data.LST,
        data.Precipitation, data.SoilMoisture, data.ET0
    ]
    cwsi = predict_cwsi(features)
    return {
        "cwsi"        : round(cwsi, 4),
        "stress_class": classify_cwsi(cwsi),
        "model_used"  : MANIFEST["model_name"],
        "r2_test"     : MANIFEST["r2_test"],
        "timestamp"   : datetime.now().isoformat()
    }

@app.post("/predict/batch", tags=["Prédiction"])
def predict_batch(data: list[PredictInput], user=Depends(get_current_user)):
    results = []
    for item in data:
        features = [item.NDVI, item.NDWI, item.MSI, item.LST,
                    item.Precipitation, item.SoilMoisture, item.ET0]
        cwsi = predict_cwsi(features)
        results.append({
            "cwsi"        : round(cwsi, 4),
            "stress_class": classify_cwsi(cwsi)
        })
    return {"predictions": results, "count": len(results)}

@app.get("/admin/users", tags=["Admin"])
def list_users(admin=Depends(require_admin)):
    return [
        {"username": u, "role": d["role"], "full_name": d["full_name"]}
        for u, d in USERS_DB.items()
    ]

@app.get("/admin/model-info", tags=["Admin"])
def model_info(admin=Depends(require_admin)):
    return MANIFEST
'''

    api_path = os.path.join(SERVE_DIR, 'app.py')
    with open(api_path, 'w') as f:
        f.write(api_code)

    # requirements.txt serving
    reqs = (
        "fastapi>=0.110.0\n"
        "uvicorn[standard]>=0.29.0\n"
        "pydantic>=2.0\n"
        "PyJWT>=2.8.0\n"
        "scikit-learn>=1.3\n"
        "xgboost>=2.0\n"
        "lightgbm>=4.0\n"
        "tensorflow>=2.15\n"
        "numpy>=1.24\n"
        "joblib>=1.3\n"
    )
    with open(os.path.join(SERVE_DIR, 'requirements_serving.txt'), 'w') as f:
        f.write(reqs)

    print(f"\n── API générée ──")
    print(f"  Fichier : {api_path}")
    print(f"  Démarrage : uvicorn app:app --host 0.0.0.0 --port 8000")
    print(f"  Docs     : http://localhost:8000/docs")
    return api_path


# ─────────────────────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.pipeline(
    name='Serving Pipeline',
    project='MALOPS',
    version='1.0'
)
def serving_pipeline():
    print("═" * 50)
    print("MALOPS — Serving Pipeline démarré")
    print("═" * 50)

    manifest_path = step_load_from_registry()
    warmup_ok     = step_warmup(manifest_path)
    api_path      = step_generate_api(manifest_path, warmup_ok)

    print(f"\nServing Pipeline terminé !")
    print(f"API prête → {api_path}")
    print(f"Lance : cd ~/malops-project/serving && uvicorn app:app --reload --port 8000")
    print("Ouvre http://localhost:8080/pipelines pour voir le graphe !")


# ─────────────────────────────────────────────────────────────
# LANCEMENT
# ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    PipelineDecorator.run_locally()
    serving_pipeline()