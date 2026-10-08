import json
import os
from fastapi import APIRouter, Depends
from routers.auth import get_current_admin_user
from models.user import User

SYSTEM_LOGS_PATH = "/home/bilalbouch/malops-project/system_logs.json"
ORCHESTRATOR_LOG = "/home/bilalbouch/malops-project/orchestrator_log.json"

router = APIRouter(prefix="/admin", tags=["admin"])

_PIPELINE_SERVICE = {
    "dataset":    "Pipeline Dataset",
    "validation": "Pipeline Validation",
    "training":   "Pipeline Training",
    "registry":   "Pipeline Registry",
    "serving":    "Pipeline Serving",
    "monitoring": "Pipeline Monitoring",
    "predict":    "Pipeline Predict",
}


def _pipeline_logs():
    entries = []
    try:
        with open(ORCHESTRATOR_LOG) as f:
            raw = json.load(f)
        for run in raw:
            ts = run.get("timestamp", "")
            for name, status in run.get("results", {}).items():
                level = "INFO" if status == "OK" else "ERROR"
                service = _PIPELINE_SERVICE.get(name, f"Pipeline {name}")
                entries.append({
                    "timestamp": ts,
                    "level": level,
                    "service": service,
                    "message": f"Pipeline '{name}' terminé avec le statut {status}",
                    "log_type": "lancement du pipeline",
                })
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return entries


def _system_logs():
    try:
        with open(SYSTEM_LOGS_PATH) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


@router.get("/logs")
def get_system_logs(_: User = Depends(get_current_admin_user)):
    all_logs = _pipeline_logs() + _system_logs()
    all_logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return {"logs": all_logs[:300]}
