import json
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from routers.auth import require_roles
from models.user import User

PIPELINES_PATH = "/home/bilalbouch/malops-project/pipelines_manager.json"

# ── Default script generator ────────────────────────────────────────────────

def _default_script(name: str, pipeline_type: str, steps: list, data_source: dict) -> str:
    filename = data_source.get("filename", "Maroc_ENV_Features_2024.csv")
    steps_str = ", ".join(f'"{s}"' for s in steps)

    cleaning = """
def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    df = df.dropna()
    df = df.drop_duplicates()
    return df
""" if "Data Cleaning" in steps else ""

    feat_eng = """
def feature_engineering(df: pd.DataFrame):
    features = ['NDVI', 'NDWI', 'MSI', 'LST', 'Precipitation', 'SoilMoisture', 'ET0']
    X = df[features]
    y = df['CWSI']
    return X, y
""" if "Feature Engineering" in steps else ""

    split = """
def split_data(X, y, test_size=0.2, random_state=42):
    return train_test_split(X, y, test_size=test_size, random_state=random_state)
""" if "Train/Test Split" in steps else ""

    training = """
def train_model(X_train, y_train):
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_train)
    model = RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42)
    model.fit(X_scaled, y_train)
    return model, scaler
""" if "Model Training" in steps else ""

    evaluation = """
def evaluate_model(model, scaler, X_test, y_test):
    X_scaled = scaler.transform(X_test)
    y_pred = model.predict(X_scaled)
    r2   = r2_score(y_test, y_pred)
    rmse = mean_squared_error(y_test, y_pred, squared=False)
    mae  = mean_absolute_error(y_test, y_pred)
    print(f"R²={r2:.4f}  RMSE={rmse:.4f}  MAE={mae:.4f}")
    return {"r2": r2, "rmse": rmse, "mae": mae}
""" if "Evaluation" in steps else ""

    export = """
def export_model(model, scaler, output_dir="model_registry"):
    import os; os.makedirs(output_dir, exist_ok=True)
    joblib.dump(model,  f"{output_dir}/model.pkl")
    joblib.dump(scaler, f"{output_dir}/scaler.pkl")
    print(f"Model saved to {output_dir}/")
""" if "Model Export" in steps else ""

    main_calls = []
    if "Data Cleaning" in steps:         main_calls.append("    df      = clean_data(df)")
    if "Feature Engineering" in steps:   main_calls.append("    X, y    = feature_engineering(df)")
    if "Train/Test Split" in steps:      main_calls.append("    X_train, X_test, y_train, y_test = split_data(X, y)")
    if "Model Training" in steps:        main_calls.append("    model, scaler = train_model(X_train, y_train)")
    if "Evaluation" in steps:            main_calls.append("    metrics = evaluate_model(model, scaler, X_test, y_test)")
    if "Model Export" in steps:          main_calls.append("    export_model(model, scaler)")

    return f'''#!/usr/bin/env python3
"""
Pipeline  : {name}
Type      : {pipeline_type}
Steps     : {steps_str}
Generated : {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}
"""

import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error

# ── Configuration ──────────────────────────────────────
DATASET_PATH = "/home/bilalbouch/malops-project/{filename}"
TARGET_COL   = "CWSI"
TEST_SIZE    = 0.2
RANDOM_STATE = 42
# ──────────────────────────────────────────────────────
{cleaning}{feat_eng}{split}{training}{evaluation}{export}

def run():
    print(f"[MALOPS] Starting pipeline: {name}")
    df = pd.read_csv(DATASET_PATH)
    print(f"[MALOPS] Loaded {{len(df)}} rows from {{DATASET_PATH}}")
{chr(10).join(main_calls)}
    print("[MALOPS] Pipeline completed successfully.")


if __name__ == "__main__":
    run()
'''


# ── Sample data ─────────────────────────────────────────────────────────────

_SAMPLE_STEPS_1 = ["Data Cleaning", "Feature Engineering", "Train/Test Split", "Model Training", "Evaluation", "Model Export"]
_SAMPLE_STEPS_2 = ["Data Cleaning", "Feature Engineering"]

SAMPLE = [
    {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "Full ML Pipeline – CWSI 2024",
        "description": "Pipeline complet : preprocessing + training + évaluation pour données 2024",
        "type": "Full ML Pipeline",
        "status": "Completed",
        "progress": 100,
        "created_at": "2026-04-18T02:00:00",
        "last_run": "2026-04-18T02:33:16",
        "duration_seconds": 1996,
        "steps": _SAMPLE_STEPS_1,
        "schedule": {"type": "manual"},
        "data_source": {"type": "file", "filename": "Maroc_ENV_Features_2024.csv"},
        "script": _default_script("Full ML Pipeline – CWSI 2024", "Full ML Pipeline", _SAMPLE_STEPS_1,
                                   {"filename": "Maroc_ENV_Features_2024.csv"}),
    },
    {
        "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "name": "Data Preprocessing – Validation",
        "description": "Préprocessing et validation des datasets 2022-2023",
        "type": "Data Preprocessing",
        "status": "Idle",
        "progress": 0,
        "created_at": "2026-04-17T14:00:00",
        "last_run": "2026-04-17T15:30:00",
        "duration_seconds": 540,
        "steps": _SAMPLE_STEPS_2,
        "schedule": {"type": "daily", "time": "06:00"},
        "data_source": {"type": "file", "filename": "Maroc_ENV_Features_2023.csv"},
        "script": _default_script("Data Preprocessing – Validation", "Data Preprocessing", _SAMPLE_STEPS_2,
                                   {"filename": "Maroc_ENV_Features_2023.csv"}),
    },
]

router = APIRouter(prefix="/ml-pipelines", tags=["ml-pipelines"])


def _load():
    try:
        with open(PIPELINES_PATH) as f:
            data = json.load(f)
        # Back-fill script for old entries that don't have one
        changed = False
        for p in data:
            if not p.get("script"):
                p["script"] = _default_script(p["name"], p.get("type",""), p.get("steps",[]), p.get("data_source",{}))
                changed = True
        if changed:
            _save(data)
        return data
    except (FileNotFoundError, json.JSONDecodeError):
        _save(SAMPLE)
        return SAMPLE


def _save(data):
    with open(PIPELINES_PATH, "w") as f:
        json.dump(data, f, indent=2)


# ── Schemas ─────────────────────────────────────────────────────────────────

class PipelineCreate(BaseModel):
    name: str
    description: str = ""
    type: str = "Full ML Pipeline"
    steps: list = []
    schedule: dict = {}
    data_source: dict = {}
    script: Optional[str] = None


class ScriptUpdate(BaseModel):
    script: str


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("")
def list_pipelines(_: User = Depends(require_roles(["data_scientist", "mlops_engineer"]))):
    return {"pipelines": _load()}


@router.post("", status_code=201)
def create_pipeline(body: PipelineCreate, _: User = Depends(require_roles(["data_scientist"]))):
    pipelines = _load()
    script = body.script or _default_script(body.name, body.type, body.steps, body.data_source)
    p = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "description": body.description,
        "type": body.type,
        "status": "Idle",
        "progress": 0,
        "created_at": datetime.utcnow().isoformat(),
        "last_run": None,
        "duration_seconds": None,
        "steps": body.steps,
        "schedule": body.schedule,
        "data_source": body.data_source,
        "script": script,
    }
    pipelines.append(p)
    _save(pipelines)
    return p


@router.get("/{pid}")
def get_pipeline(pid: str, _: User = Depends(require_roles(["data_scientist"]))):
    p = next((p for p in _load() if p["id"] == pid), None)
    if not p:
        raise HTTPException(404, "Pipeline non trouvé")
    return p


@router.put("/{pid}")
def update_pipeline(pid: str, body: PipelineCreate, _: User = Depends(require_roles(["data_scientist"]))):
    pl = _load()
    idx = next((i for i, p in enumerate(pl) if p["id"] == pid), None)
    if idx is None:
        raise HTTPException(404, "Pipeline non trouvé")
    # Regenerate script only if steps changed and no custom script provided
    old_steps  = pl[idx].get("steps", [])
    old_script = pl[idx].get("script", "")
    new_script = body.script
    if new_script is None:
        if body.steps != old_steps:
            new_script = _default_script(body.name, body.type, body.steps, body.data_source)
        else:
            new_script = old_script
    pl[idx].update({
        "name": body.name, "description": body.description, "type": body.type,
        "steps": body.steps, "schedule": body.schedule,
        "data_source": body.data_source, "script": new_script,
    })
    _save(pl)
    return pl[idx]


@router.put("/{pid}/script")
def update_script(pid: str, body: ScriptUpdate, _: User = Depends(require_roles(["data_scientist"]))):
    """Save custom Python script for a pipeline."""
    pl = _load()
    idx = next((i for i, p in enumerate(pl) if p["id"] == pid), None)
    if idx is None:
        raise HTTPException(404, "Pipeline non trouvé")
    pl[idx]["script"] = body.script
    _save(pl)
    return {"message": "Script sauvegardé", "pipeline": pl[idx]["name"]}


@router.get("/{pid}/script")
def get_script(pid: str, _: User = Depends(require_roles(["data_scientist"]))):
    """Return the Python script for a pipeline."""
    p = next((p for p in _load() if p["id"] == pid), None)
    if not p:
        raise HTTPException(404, "Pipeline non trouvé")
    script = p.get("script") or _default_script(p["name"], p.get("type",""), p.get("steps",[]), p.get("data_source",{}))
    return {"script": script, "pipeline": p["name"]}


@router.post("/{pid}/start")
def start_pipeline(pid: str, _: User = Depends(require_roles(["data_scientist"]))):
    pl = _load()
    p = next((p for p in pl if p["id"] == pid), None)
    if not p:
        raise HTTPException(404, "Pipeline non trouvé")
    p.update({"status": "Running", "last_run": datetime.utcnow().isoformat(), "progress": 5})
    _save(pl)
    return {"message": f"Pipeline '{p['name']}' démarré"}


@router.post("/{pid}/stop")
def stop_pipeline(pid: str, _: User = Depends(require_roles(["data_scientist"]))):
    pl = _load()
    p = next((p for p in pl if p["id"] == pid), None)
    if not p:
        raise HTTPException(404, "Pipeline non trouvé")
    p.update({"status": "Idle"})
    _save(pl)
    return {"message": f"Pipeline '{p['name']}' arrêté"}


@router.delete("/{pid}", status_code=204)
def delete_pipeline(pid: str, _: User = Depends(require_roles(["data_scientist"]))):
    _save([p for p in _load() if p["id"] != pid])


@router.get("/{pid}/logs")
def get_logs(pid: str, _: User = Depends(require_roles(["data_scientist"]))):
    p = next((p for p in _load() if p["id"] == pid), None)
    if not p:
        raise HTTPException(404, "Pipeline non trouvé")
    ts = p.get("last_run") or datetime.utcnow().isoformat()
    logs = [
        f"[{ts}] Pipeline '{p['name']}' initialisé",
        f"[{ts}] Type: {p['type']}",
        f"[{ts}] Source: {p.get('data_source', {}).get('filename', 'N/A')}",
    ]
    for i, step in enumerate(p.get("steps", []), 1):
        ok = "✓ OK" if p["status"] in ("Completed", "Idle") else "..."
        logs.append(f"[{ts}] Étape {i}/{len(p['steps'])}: {step} — {ok}")
    if p["status"] == "Completed":
        logs.append(f"[{ts}] ✅ Pipeline terminé avec succès")
    elif p["status"] == "Failed":
        logs.append(f"[{ts}] ❌ Échec du pipeline")
    return {"logs": logs, "pipeline": p["name"]}
