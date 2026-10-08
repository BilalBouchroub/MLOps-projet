import math
import os
import glob
import subprocess
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from typing import Optional
from pydantic import BaseModel
from routers.auth import require_roles, get_current_admin_user
from models.user import User

DATASETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Which year ranges each demo experiment used
_EXP_DATASET_RANGES = {
    "exp001": (1990, 2024),   # RandomForest — full dataset
    "exp002": (2000, 2024),   # LightGBM     — 25 years recent
    "exp003": (2010, 2023),   # XGBoost      — 14 years (failed: trop petit)
    "exp004": (1995, 2022),   # AdaBoost     — 28 years
}


def _scan_csv_files():
    """Scan all CSV files registered via upload, from the root datasets dir."""
    import json as _json
    import re

    registry = {}
    reg_path = os.path.join(DATASETS_DIR, "dataset_registry.json")
    try:
        with open(reg_path) as f:
            registry = _json.load(f)
    except Exception:
        pass

    result = []
    for fname, meta in registry.items():
        if ":Zone.Identifier" in fname:
            continue
        filepath = os.path.join(DATASETS_DIR, fname)
        if not os.path.isfile(filepath):
            continue
        size_bytes = os.path.getsize(filepath)
        try:
            out = subprocess.check_output(["wc", "-l", filepath], text=True)
            rows = int(out.strip().split()[0]) - 1
        except Exception:
            rows = None
        year_m = re.search(r"((?:19|20)\d{2})", fname)
        year = int(year_m.group(1)) if year_m else None
        result.append({
            "name":       fname,
            "year":       year,
            "size_bytes": size_bytes,
            "size_mb":    round(size_bytes / 1024 / 1024, 2),
            "rows":       rows,
            "region":     meta.get("region"),
            "uploaded_by": meta.get("username"),
            "uploaded_at": meta.get("uploaded_at"),
            "path":       filepath,
        })
    result.sort(key=lambda x: (x["year"] or 0, x["name"]))
    return result

def _clearml_server_reachable(host: str = 'localhost', port: int = 8008, timeout: float = 1.0) -> bool:
    import socket
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False

CLEARML_AVAILABLE = False
if _clearml_server_reachable():
    try:
        from clearml import Task
        CLEARML_AVAILABLE = True
    except ImportError:
        pass


def _get_real_experiments(project_name: str = None):
    """Fetch experiments from ClearML server using the SDK."""
    try:
        tasks = Task.query_tasks(
            project_name=project_name or None,
            task_filter={"status": ["completed", "in_progress", "failed", "created"]},
        )
        result = []
        for t in tasks[:20]:
            result.append({
                "id":        str(t),
                "name":      t.name,
                "project":   t.project_name or "MALOPS",
                "status":    t.status,
                "created":   str(t.data.created)   if t.data.created   else None,
                "started":   str(t.data.started)   if t.data.started   else None,
                "completed": str(t.data.completed) if t.data.completed else None,
                "tags":      list(t.get_tags() or []),
                "hyperparams": {},
                "metrics":   {},
            })
        return result if result else None
    except Exception:
        return None

router = APIRouter(prefix="/clearml", tags=["clearml"])

# ── Demo data ──────────────────────────────────────────────────────────────────
DEMO_EXPERIMENTS = [
    {
        "id": "exp001",
        "name": "RandomForest CWSI Training v8",
        "project": "MALOPS/Stress Hydrique",
        "status": "completed",
        "created": "2026-04-18T02:10:00",
        "started": "2026-04-18T02:10:30",
        "completed": "2026-04-18T02:33:16",
        "tags": ["production", "randomforest"],
        "hyperparams": {"n_estimators": "200", "max_depth": "15", "min_samples_split": "5", "random_state": "42"},
        "metrics": {"r2": 0.973404, "rmse": 0.0553, "mae": 0.035083},
    },
    {
        "id": "exp002",
        "name": "LightGBM CWSI Training v7",
        "project": "MALOPS/Stress Hydrique",
        "status": "completed",
        "created": "2026-04-05T16:00:00",
        "started": "2026-04-05T16:01:00",
        "completed": "2026-04-05T16:13:45",
        "tags": ["staging", "lightgbm"],
        "hyperparams": {"num_leaves": "31", "learning_rate": "0.05", "n_estimators": "300"},
        "metrics": {"r2": 0.971382, "rmse": 0.057364, "mae": 0.039607},
    },
    {
        "id": "exp003",
        "name": "XGBoost CWSI Training v6",
        "project": "MALOPS/Stress Hydrique",
        "status": "failed",
        "created": "2026-04-04T19:50:00",
        "started": "2026-04-04T19:51:00",
        "completed": "2026-04-04T20:00:00",
        "tags": ["failed", "xgboost"],
        "hyperparams": {"max_depth": "6", "learning_rate": "0.1", "n_estimators": "100"},
        "metrics": {"r2": 0.9635, "rmse": 0.064741, "mae": 0.045241},
    },
    {
        "id": "exp004",
        "name": "AdaBoost CWSI Training v5",
        "project": "MALOPS/Stress Hydrique",
        "status": "completed",
        "created": "2026-04-04T19:00:00",
        "started": "2026-04-04T19:05:00",
        "completed": "2026-04-04T19:30:00",
        "tags": ["archived", "adaboost"],
        "hyperparams": {"n_estimators": "50", "learning_rate": "1.0"},
        "metrics": {"r2": 0.964593, "rmse": 0.063807, "mae": 0.052936},
    },
]


class ConnectionConfig(BaseModel):
    api_server: str = "http://localhost:8080"
    web_ui: str = "http://localhost:8080"
    api_key: str = ""
    api_secret: str = ""


class LaunchConfig(BaseModel):
    project: str
    name: str
    queue: str = "default"
    hyperparams: dict = {}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/projects")
def list_clearml_projects(_: User = Depends(get_current_admin_user)):
    """Retourne la liste des projets ClearML pour le formulaire de création."""
    if CLEARML_AVAILABLE:
        try:
            projects = Task.get_projects()
            return {
                "projects": [{"id": p.id, "name": p.name} for p in projects],
                "mode": "live",
            }
        except Exception:
            pass
    return {
        "projects": [{"id": "demo-malops", "name": "MALOPS"}],
        "mode": "demo",
    }


@router.get("/status")
def clearml_status(_: User = Depends(require_roles(["data_scientist"]))):
    if CLEARML_AVAILABLE:
        try:
            from clearml.backend_api import Session
            Session.get_api_server_host()
            return {"connected": True, "mode": "live",
                    "web_url": "http://localhost:8080",
                    "api_url": "http://localhost:8008"}
        except Exception as e:
            return {"connected": False, "mode": "demo", "error": str(e)}
    return {"connected": False, "mode": "demo",
            "message": "ClearML SDK non installé."}


@router.post("/test-connection")
def test_connection(config: ConnectionConfig, _: User = Depends(require_roles(["data_scientist"]))):
    if CLEARML_AVAILABLE:
        return {"success": True, "message": "Connexion ClearML établie"}
    return {"success": False, "message": "ClearML SDK non installé — mode démo actif"}


@router.get("/experiments")
def list_experiments(
    project: Optional[str] = Query(None),
    _: User = Depends(require_roles(["data_scientist"])),
):
    if CLEARML_AVAILABLE:
        real = _get_real_experiments(project_name=project)
        if real is not None:
            return {"experiments": real, "mode": "live"}
    # Mode démo : filtrer par projet si fourni
    if project:
        exps = [e for e in DEMO_EXPERIMENTS if project.lower() in e.get("project", "").lower()]
        # Nouveau projet sans expériences → liste vide, pas de fallback vers MALOPS
        return {"experiments": exps, "mode": "demo"}
    return {"experiments": DEMO_EXPERIMENTS, "mode": "demo"}


@router.get("/experiments/{exp_id}")
def get_experiment(exp_id: str, _: User = Depends(require_roles(["data_scientist"]))):
    exp = next((e for e in DEMO_EXPERIMENTS if e["id"] == exp_id), None)
    if not exp:
        raise HTTPException(404, "Expérience non trouvée")
    return exp


@router.get("/experiments/{exp_id}/metrics")
def get_metrics(exp_id: str, _: User = Depends(require_roles(["data_scientist"]))):
    exp = next((e for e in DEMO_EXPERIMENTS if e["id"] == exp_id), None)
    if not exp:
        raise HTTPException(404, "Expérience non trouvée")
    n, r2_final = 20, exp["metrics"]["r2"]
    rmse_final = exp["metrics"]["rmse"]

    def conv(start, end, seed, n=n):
        return [round(start + (end - start) / (1 + math.exp(-8 * (i/n - 0.4))) + math.sin(seed+i) * 0.001, 4) for i in range(n)]

    r2_curve    = conv(0.48, r2_final, 1)
    train_loss  = conv(0.5, rmse_final * 0.9, 2)
    val_loss    = conv(0.52, rmse_final, 3)
    cpu_usage   = [round(45 + 30 * abs(math.sin(i * 0.5)) + i * 0.5, 1) for i in range(n)]
    mem_usage   = [round(512 + 256 * (i / n), 1) for i in range(n)]

    epochs = [
        {"epoch": i+1, "train_loss": train_loss[i], "val_loss": val_loss[i],
         "r2": r2_curve[i], "cpu": cpu_usage[i], "memory": mem_usage[i]}
        for i in range(n)
    ]
    return {"epochs": epochs}


@router.get("/experiments/{exp_id}/logs")
def get_exp_logs(exp_id: str, _: User = Depends(require_roles(["data_scientist"]))):
    exp = next((e for e in DEMO_EXPERIMENTS if e["id"] == exp_id), None)
    if not exp:
        raise HTTPException(404, "Expérience non trouvée")
    ts = exp.get("started", datetime.utcnow().isoformat())
    logs = [
        f"[{ts}] Starting experiment '{exp['name']}'...",
        f"[{ts}] Project: {exp['project']}",
        f"[{ts}] Loading dataset... 58437 rows × 9 columns",
        f"[{ts}] Hyperparameters: {exp['hyperparams']}",
        f"[{ts}] Training started...",
    ]
    for i in range(1, 11):
        r2 = round(0.5 + (exp["metrics"]["r2"] - 0.5) * i / 10, 4)
        logs.append(f"[{ts}] Epoch {i}/20 – R²: {r2} – RMSE: {round(exp['metrics']['rmse'] * (2 - i/10), 4)}")
    icon = "✅" if exp["status"] == "completed" else "❌"
    logs.append(f"[{ts}] {icon} Experiment {exp['status']}. Final R²={exp['metrics']['r2']}")
    return {"logs": logs}


@router.get("/experiments/{exp_id}/artifacts")
def get_artifacts(exp_id: str, _: User = Depends(require_roles(["data_scientist"]))):
    return {
        "artifacts": [
            {"name": "model.pkl",               "type": "model",  "size": "4.2 MB"},
            {"name": "feature_importance.csv",   "type": "csv",    "size": "12 KB"},
            {"name": "confusion_matrix.png",     "type": "image",  "size": "85 KB"},
            {"name": "requirements.txt",         "type": "text",   "size": "2 KB"},
        ]
    }


@router.post("/launch")
def launch_experiment(config: LaunchConfig, _: User = Depends(require_roles(["data_scientist"]))):
    return {
        "message": f"Expérience '{config.name}' dans '{config.project}'",
        "experiment_id": f"exp_new_{config.name[:8].replace(' ','_')}",
        "note": "Mode démo — installez et configurez ClearML pour des vraies exécutions.",
    }


@router.get("/datasets")
def list_datasets(_: User = Depends(require_roles(["data_engineer"]))):
    """List all Maroc_ENV_Features_*.csv datasets available on disk."""
    datasets = _scan_csv_files()
    return {
        "datasets": datasets,
        "total": len(datasets),
        "total_size_mb": round(sum(d["size_mb"] for d in datasets), 2),
        "year_range": [min(d["year"] for d in datasets), max(d["year"] for d in datasets)] if datasets else [],
    }


def _find_csv_path(filename: str) -> str | None:
    """Find the full path of a Maroc_ENV_Features_*.csv across root and project subdirs."""
    for f in _scan_csv_files():
        if f["name"] == filename:
            return f["path"]
    return None


@router.get("/datasets/{filename}/download")
def download_dataset(filename: str, _: User = Depends(require_roles(["data_engineer"]))):
    """Download a Maroc_ENV_Features_*.csv file."""
    if not filename.startswith("Maroc_ENV_Features_") or not filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Nom de fichier invalide.")
    filepath = _find_csv_path(filename)
    if not filepath:
        raise HTTPException(status_code=404, detail="Fichier introuvable.")
    return FileResponse(path=filepath, media_type="text/csv", filename=filename)


@router.delete("/datasets/{filename}")
def delete_dataset(filename: str, _: User = Depends(require_roles(["data_engineer"]))):
    """Delete a Maroc_ENV_Features_*.csv file from disk."""
    if not filename.startswith("Maroc_ENV_Features_") or not filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Nom de fichier invalide.")
    filepath = _find_csv_path(filename)
    if not filepath:
        raise HTTPException(status_code=404, detail="Fichier introuvable.")
    os.remove(filepath)
    # Remove from registry if present
    reg_path = os.path.join(os.path.dirname(filepath), "dataset_registry.json")
    try:
        import json as _json
        with open(reg_path) as f:
            reg = _json.load(f)
        if filename in reg:
            del reg[filename]
            with open(reg_path, "w") as f:
                _json.dump(reg, f, indent=2)
    except Exception:
        pass
    return {"message": f"Fichier '{filename}' supprimé avec succès."}


@router.get("/experiments/{exp_id}/datasets")
def get_experiment_datasets(exp_id: str, _: User = Depends(require_roles(["data_scientist"]))):
    """Return which CSV datasets were used for a given experiment."""
    year_range = _EXP_DATASET_RANGES.get(exp_id)
    all_files = _scan_csv_files()
    if year_range:
        y_min, y_max = year_range
        used = [d for d in all_files if y_min <= d["year"] <= y_max]
    else:
        used = all_files  # si expérience inconnue, supposer tout
    return {
        "exp_id": exp_id,
        "datasets": used,
        "total": len(used),
        "total_size_mb": round(sum(d["size_mb"] for d in used), 2),
        "year_range": [year_range[0], year_range[1]] if year_range else [],
    }
