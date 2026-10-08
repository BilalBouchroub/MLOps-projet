# ============================================================
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
