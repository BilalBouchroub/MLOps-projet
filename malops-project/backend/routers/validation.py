import json
import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from routers.auth import require_roles
from models.user import User
from database import get_db
from utils.project_dirs import BASE_DIR, get_user_project_dir

SCHEMA_PATH = os.path.join(BASE_DIR, "validation_schema.json")
STATS_PATH  = os.path.join(BASE_DIR, "validation_stats.json")
DRIFT_PATH  = os.path.join(BASE_DIR, "validation_drift.json")

router = APIRouter(prefix="/validation", tags=["validation"])

# Structures vides retournées si le pipeline de validation n'a pas encore tourné
_EMPTY_SCHEMA = {"per_file": {}, "warnings": [], "total_files": 0, "issues": []}
_EMPTY_STATS  = {}
_EMPTY_DRIFT  = {}


def _load_optional(path: str, default: dict) -> dict:
    """Charge un fichier JSON ; retourne le défaut si absent (projet sans données)."""
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def _report_paths(data_dir: str):
    if data_dir == BASE_DIR:
        return SCHEMA_PATH, STATS_PATH, DRIFT_PATH
    return (
        os.path.join(data_dir, "validation_schema.json"),
        os.path.join(data_dir, "validation_stats.json"),
        os.path.join(data_dir, "validation_drift.json"),
    )


@router.get("/report")
def get_validation_report(
    current_user: User = Depends(require_roles(["data_engineer", "data_scientist"])),
    db: Session = Depends(get_db),
):
    from datetime import datetime

    data_dir = get_user_project_dir(current_user, db)
    schema_p, stats_p, drift_p = _report_paths(data_dir)

    schema = _load_optional(schema_p, _EMPTY_SCHEMA)
    stats  = _load_optional(stats_p,  _EMPTY_STATS)
    drift  = _load_optional(drift_p,  _EMPTY_DRIFT)

    # Si le dossier projet a des fichiers vides (nouveau projet),
    # utiliser les résultats de BASE_DIR (où le pipeline écrit toujours)
    if schema.get("total_files", 0) == 0 and not schema.get("per_file") and data_dir != BASE_DIR:
        schema = _load_optional(SCHEMA_PATH, _EMPTY_SCHEMA)
        stats  = _load_optional(STATS_PATH,  _EMPTY_STATS)
        drift  = _load_optional(DRIFT_PATH,  _EMPTY_DRIFT)

    # Comptage live : uniquement les fichiers dataset (registre + Maroc_ENV_Features_*)
    try:
        import glob as _glob
        counted = set()
        # Fichiers Maroc_ENV_Features_*.csv
        for p in _glob.glob(os.path.join(BASE_DIR, 'Maroc_ENV_Features_*.csv')):
            f = os.path.basename(p)
            if 'Zone.Identifier' not in f:
                counted.add(f)
        # Fichiers uploadés via l'interface (registre)
        reg_path = os.path.join(BASE_DIR, 'dataset_registry.json')
        if os.path.exists(reg_path):
            with open(reg_path) as _f:
                import json as _j
                for fname in _j.load(_f):
                    if fname.endswith('.csv') and 'Zone.Identifier' not in fname:
                        if os.path.isfile(os.path.join(BASE_DIR, fname)):
                            counted.add(fname)
        schema["total_files"] = len(counted)
    except Exception:
        pass

    # Timestamp du dernier run = date de modification du fichier le plus récent
    last_updated = None
    for p in [schema_p, stats_p, drift_p]:
        if os.path.exists(p):
            mtime = os.path.getmtime(p)
            ts = datetime.fromtimestamp(mtime).isoformat()
            if last_updated is None or ts > last_updated:
                last_updated = ts

    # Métadonnées pipeline (si disponibles)
    pipeline_meta = {}
    meta_path = os.path.join(BASE_DIR, "validation_run_meta.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path) as f:
                pipeline_meta = json.load(f)
        except Exception:
            pass

    return {
        "schema":        schema,
        "stats":         stats,
        "drift":         drift,
        "last_updated":  last_updated,
        "pipeline_meta": pipeline_meta,
    }


@router.get("/config")
def get_validation_config(_: User = Depends(require_roles(["data_engineer"]))):
    from routers.clearml_pipelines import _get_pipeline_config
    return {"config": _get_pipeline_config("pipeline-validation")}


class ConfigBody(BaseModel):
    config: dict


@router.put("/config")
def save_validation_config(body: ConfigBody, _: User = Depends(require_roles(["data_engineer"]))):
    from routers.clearml_pipelines import _load_all_configs, _save_all_configs
    all_cfgs = _load_all_configs()
    all_cfgs["pipeline-validation"] = body.config
    _save_all_configs(all_cfgs)
    return {"message": "Configuration validation sauvegardée."}
