import json
import os
import threading
from datetime import datetime
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional
from routers.auth import require_roles
from models.user import User
from database import get_db
from utils.project_dirs import BASE_DIR, get_user_project_dir

ORCHESTRATOR_LOG     = os.path.join(BASE_DIR, "orchestrator_log.json")
PIPELINE_CONFIG_PATH = os.path.join(BASE_DIR, "pipeline_config.json")


def _project_config_path(data_dir: str) -> str:
    if data_dir == BASE_DIR:
        return PIPELINE_CONFIG_PATH
    return os.path.join(data_dir, "pipeline_config.json")


def _project_log_path(data_dir: str) -> str:
    if data_dir == BASE_DIR:
        return ORCHESTRATOR_LOG
    return os.path.join(data_dir, "orchestrator_log.json")

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

PIPELINE_NAMES = ["dataset", "validation", "training", "registry", "serving", "monitoring", "predict"]

PIPELINE_ID_MAP = {
    "dataset":    "pipeline-dataset",
    "validation": "pipeline-validation",
    "training":   "pipeline-training",
    "registry":   "pipeline-registry",
    "serving":    "pipeline-serving",
    "monitoring": "pipeline-monitoring",
    "predict":    "orchestrator-predict",
}


@router.get("/config")
def get_pipeline_config(
    current_user: User = Depends(require_roles(["mlops_engineer", "data_scientist", "data_engineer"])),
    db: Session = Depends(get_db),
):
    cfg_path = _project_config_path(get_user_project_dir(current_user, db))
    if not os.path.exists(cfg_path):
        return {}
    with open(cfg_path) as f:
        return json.load(f)


@router.post("/config")
def save_pipeline_config(
    body: Dict[str, Any] = Body(...),
    current_user: User = Depends(require_roles(["data_scientist", "data_engineer"])),
    db: Session = Depends(get_db),
):
    data_dir = get_user_project_dir(current_user, db)
    os.makedirs(data_dir, exist_ok=True)
    cfg_path = _project_config_path(data_dir)
    existing: Dict[str, Any] = {}
    if os.path.exists(cfg_path):
        with open(cfg_path) as f:
            existing = json.load(f)
    for key, val in body.items():
        if isinstance(val, dict):
            existing.setdefault(key, {})
            existing[key].update(val)
        else:
            existing[key] = val
    with open(cfg_path, "w") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
    return {"message": "Configuration sauvegardée", "config": existing}


@router.get("/status")
def get_pipelines_status(
    current_user: User = Depends(require_roles(["mlops_engineer", "data_scientist", "data_engineer"])),
    db: Session = Depends(get_db),
):
    log_path = _project_log_path(get_user_project_dir(current_user, db))
    try:
        with open(log_path) as f:
            logs = json.load(f)
    except FileNotFoundError:
        raise HTTPException(404, "orchestrator_log.json introuvable")

    last_status: dict = {}
    for entry in logs:
        ts = entry.get("timestamp", "")
        for name, status in entry.get("results", {}).items():
            last_status[name] = {"status": status, "last_run": ts}

    pipelines = []
    for name in PIPELINE_NAMES:
        info = last_status.get(name, {"status": "UNKNOWN", "last_run": None})
        pipelines.append({"name": name, "status": info["status"], "last_run": info["last_run"]})

    return {"pipelines": pipelines}


class RunBody(BaseModel):
    mode: str = "custom"
    pipelines: List[str] = []
    configs: dict = {}
    clearml_project: Optional[str] = None


@router.post("/run")
def run_pipeline(
    body: RunBody,
    current_user: User = Depends(require_roles(["data_engineer", "data_scientist"])),
    db: Session = Depends(get_db),
):
    """Trigger one or more pipelines with optional config overrides."""
    from routers.clearml_pipelines import (
        _runs, PIPELINES, _run_thread,
        _load_all_configs, _save_all_configs, DEFAULT_CONFIGS,
    )

    # Dossier de données du projet de l'utilisateur (transmis aux scripts)
    data_dir = get_user_project_dir(current_user, db)
    os.makedirs(data_dir, exist_ok=True)
    project_name = body.clearml_project or ""
    extra_env = {
        "PROJECT_DATA_DIR":    data_dir,
        "CLEARML_PROJECT":     project_name,
        "PIPELINE_CONFIG_PATH": _project_config_path(data_dir),
    }

    results = {}
    for name in body.pipelines:
        pid = PIPELINE_ID_MAP.get(name)
        if not pid:
            results[name] = {"error": f"Pipeline inconnu : '{name}'"}
            continue

        p = next((p for p in PIPELINES if p["id"] == pid), None)
        if not p:
            results[name] = {"error": "Définition pipeline introuvable"}
            continue

        # Save config override to JSON store
        if name in body.configs:
            all_cfgs = _load_all_configs()
            all_cfgs[pid] = {**DEFAULT_CONFIGS.get(pid, {}), **body.configs[name]}
            _save_all_configs(all_cfgs)

        # Check not already running
        if _runs.get(pid, {}).get("status") == "running":
            results[name] = {"status": "already_running", "run_id": _runs[pid]["run_id"]}
            continue

        run_id = f"run-{pid}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
        _runs[pid] = {
            "run_id": run_id, "status": "running",
            "steps_status": {s["id"]: "pending" for s in p["steps"]},
            "logs": [], "pid": None, "return_code": None,
            "started_at": datetime.utcnow().isoformat(), "ended_at": None,
        }
        threading.Thread(
            target=_run_thread, args=(pid, p["script"], p["args"], extra_env), daemon=True,
        ).start()
        results[name] = {"status": "started", "run_id": run_id}

    return {"results": results, "mode": body.mode}


@router.get("/{pid}/run-status")
def pipeline_run_status(pid: str,
                        _: User = Depends(require_roles(["data_engineer", "data_scientist"]))):
    """Check run status for a pipeline by short name (e.g. 'dataset')."""
    from routers.clearml_pipelines import _runs
    full_pid = PIPELINE_ID_MAP.get(pid, pid)
    run = _runs.get(full_pid, {})
    return {
        "status":       run.get("status", "idle"),
        "run_id":       run.get("run_id"),
        "steps_status": run.get("steps_status", {}),
        "logs":         run.get("logs", [])[-50:],
        "started_at":   run.get("started_at"),
        "ended_at":     run.get("ended_at"),
    }
