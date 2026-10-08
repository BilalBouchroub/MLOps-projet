import json
from fastapi import APIRouter, Depends, HTTPException
from routers.auth import require_roles
from models.user import User
from utils.system_logger import log_event

REGISTRY_PATH = "/home/bilalbouch/malops-project/model_registry/registry.json"

router = APIRouter(prefix="/models", tags=["models"])


def _load_registry() -> dict:
    try:
        with open(REGISTRY_PATH, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="registry.json introuvable")


def _save_registry(data: dict) -> None:
    with open(REGISTRY_PATH, "w") as f:
        json.dump(data, f, indent=2)


@router.get("/library")
def get_model_library(_: User = Depends(require_roles(["data_scientist", "mlops_engineer"]))):
    registry = _load_registry()
    production_version = (registry.get("production") or {}).get("version")
    models = []
    for entry in registry.get("history", []):
        status = entry.get("status", "staging")
        if entry.get("version") == production_version and registry.get("production"):
            status = "production"
        models.append({
            "version": entry.get("version"),
            "name": entry.get("model_name"),
            "r2": entry.get("r2_test"),
            "status": status,
            "created_at": entry.get("created_at"),
        })
    return {"models": models}


@router.put("/{version}/activate")
def activate_model(version: str, _: User = Depends(require_roles(["mlops_engineer"]))):
    registry = _load_registry()
    target = next((m for m in registry.get("history", []) if m["version"] == version), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Modèle {version} introuvable")

    old_prod = registry.get("production")
    if old_prod:
        for m in registry["history"]:
            if m["version"] == old_prod["version"] and m["version"] != version:
                m["status"] = "staging"

    target["status"] = "production"
    registry["production"] = {
        "version": target["version"],
        "model_name": target["model_name"],
        "r2_test": target["r2_test"],
        "model_path": target["model_path"],
        "scaler_path": target["scaler_path"],
        "promoted_at": target.get("created_at"),
    }
    _save_registry(registry)
    log_event("INFO", "Model Registry", f"Modèle version '{version}' activé en production", "modèle activé")
    return {"message": f"Modèle {version} activé en production"}


@router.put("/{version}/deactivate")
def deactivate_model(version: str, _: User = Depends(require_roles(["mlops_engineer"]))):
    registry = _load_registry()
    target = next((m for m in registry.get("history", []) if m["version"] == version), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Modèle {version} introuvable")

    target["status"] = "staging"
    if (registry.get("production") or {}).get("version") == version:
        registry["production"] = None
    _save_registry(registry)
    log_event("INFO", "Model Registry", f"Modèle version '{version}' désactivé (staging)", "modèle désactivé")
    return {"message": f"Modèle {version} désactivé (staging)"}
