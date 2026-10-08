"""
MALOPS – ClearML Pipeline Manager
Gère les 12 pipelines définis dans le projet (orchestrateur + pipelines individuels).
"""
import re
import json as _json
import subprocess
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

PIPELINE_CONFIGS_PATH = Path("/home/bilalbouch/malops-project/pipeline_configs.json")

DEFAULT_CONFIGS: Dict[str, dict] = {
    "pipeline-dataset": {
        "start_year": 1990, "end_year": 2026,
        "region_nord": True, "region_centre": True, "region_sud": True,
        "nulls_max": 20, "min_rows": 1000,
    },
    "pipeline-validation": {
        "feat_ndvi": True, "feat_ndwi": True, "feat_msi": True,
        "feat_lst": True, "feat_precip": True, "feat_soil": True, "feat_et0": True,
        "psi_threshold": 0.1, "ks_pvalue": 0.05,
        "outlier_method": "IQR", "outlier_threshold": 3.0, "autofix": False,
    },
    "pipeline-training": {
        "rf_enabled": True, "rf_n_estimators": 200, "rf_max_depth": 10, "rf_min_samples": 2,
        "xgb_enabled": True, "xgb_n_estimators": 200, "xgb_lr": 0.1, "xgb_max_depth": 6,
        "lgb_enabled": True, "lgb_n_estimators": 200, "lgb_lr": 0.1,
        "ada_enabled": True, "ada_n_estimators": 100, "ada_dt_depth": 4,
        "gru_enabled": True, "gru_epochs": 100, "gru_hidden_size": 64, "gru_seq_len": 12,
        "custom_enabled": False, "custom_file": "",
        "test_size": 20, "random_seed": 42, "target": "CWSI",
        "feat_ndvi": True, "feat_ndwi": True, "feat_msi": True,
        "feat_lst": True, "feat_precip": True, "feat_soil": True, "feat_et0": True,
        "feat_dem": False, "feat_slope": False,
        "cv_enabled": True, "cv_k": 5,
    },
    "pipeline-registry": {
        "selection_criterion": "best_r2", "r2_min": 0.85,
        "auto_archive": True, "max_versions": 5,
    },
    "pipeline-serving": {
        "model_version": "v8", "port": 8000, "workers": 4,
        "timeout": 30, "auto_scaler": True, "health_check_interval": 60,
    },
    "pipeline-monitoring": {
        "r2_drop_threshold": 5, "r2_email": True,
        "psi_threshold": 0.2, "psi_email": True,
        "check_frequency": "daily", "baseline_period": "last_30_days",
    },
    "orchestrator-predict": {
        "year": 2024, "month_all": True,
        "months": [1,2,3,4,5,6,7,8,9,10,11,12],
        "region": "all", "grid_size": 0.1,
        "output_csv": True, "output_geojson": True, "output_shapefile": False,
        "stress_low_max": 0.4, "stress_mod_max": 0.6,
    },
}
for _oid in ("orchestrator-full","orchestrator-train","orchestrator-monitor",
             "orchestrator-dataset","orchestrator-custom"):
    DEFAULT_CONFIGS[_oid] = {"stop_on_error": True}

def _load_all_configs() -> dict:
    try:
        return _json.loads(PIPELINE_CONFIGS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}

def _save_all_configs(data: dict):
    PIPELINE_CONFIGS_PATH.write_text(_json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

def _get_pipeline_config(pid: str) -> dict:
    saved = _load_all_configs().get(pid, {})
    return {**DEFAULT_CONFIGS.get(pid, {}), **saved}

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from routers.auth import require_roles
from models.user import User

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

PROJECT_DIR = Path("/home/bilalbouch/malops-project")

# ── Pipeline registry ─────────────────────────────────────────────────────────
PIPELINES = [
    {
        "id": "orchestrator-full",
        "name": "MALOPS Orchestrator",
        "subtitle": "Mode Complet",
        "description": "Exécute toute la chaîne MLOps : dataset → validation → training → registry → serving → monitoring → predict",
        "script": "orchestrator.py",
        "args": ["--mode", "full"],
        "type": "Orchestrator",
        "color": "#7c3aed",
        "clearml_name": "MALOPS Orchestrator",
        "steps": [
            {"id": "dataset",    "name": "Dataset",     "queue": "data_processing"},
            {"id": "validation", "name": "Validation",  "queue": "data_processing"},
            {"id": "training",   "name": "Training",    "queue": "training"},
            {"id": "registry",   "name": "Registry",    "queue": "testing"},
            {"id": "serving",    "name": "Serving",     "queue": "custom"},
            {"id": "monitoring", "name": "Monitoring",  "queue": "monitor"},
            {"id": "predict",    "name": "Predict",     "queue": "inference"},
        ],
    },
    {
        "id": "pipeline-dataset",
        "name": "Dataset Versioning Pipeline",
        "subtitle": "",
        "description": "Scan, validation et versioning des 35 CSV dans ClearML Dataset",
        "script": "pipeline_dataset.py",
        "args": [],
        "type": "Data",
        "color": "#0891b2",
        "clearml_name": "Dataset Versioning Pipeline",
        "steps": [
            {"id": "scan",     "name": "Scan CSV",          "queue": "data_processing"},
            {"id": "validate", "name": "Validate",          "queue": "data_processing"},
            {"id": "version",  "name": "Version Dataset",   "queue": "data_processing"},
            {"id": "upload",   "name": "Upload to ClearML", "queue": "data_processing"},
        ],
    },
    {
        "id": "pipeline-validation",
        "name": "Validation Pipeline",
        "subtitle": "",
        "description": "Vérification schéma, stats, détection de drift sur les données CSV",
        "script": "pipeline_validation.py",
        "args": [],
        "type": "Validation",
        "color": "#0891b2",
        "clearml_name": "Validation Pipeline",
        "steps": [
            {"id": "schema",  "name": "Check Schema",    "queue": "data_processing"},
            {"id": "stats",   "name": "Statistics",      "queue": "data_processing"},
            {"id": "drift",   "name": "Drift Detection", "queue": "data_processing"},
            {"id": "report",  "name": "Report",          "queue": "data_processing"},
        ],
    },
    {
        "id": "pipeline-training",
        "name": "MLOps Pipeline",
        "subtitle": "Training",
        "description": "RandomForest, XGBoost, LightGBM, AdaBoost, GRU – avec tracking ClearML",
        "script": "pipeline_training.py",
        "args": [],
        "type": "Training",
        "color": "#16a34a",
        "clearml_name": "MLOps Pipeline",
        "steps": [
            {"id": "load",      "name": "Load & Clean",       "queue": "data_processing"},
            {"id": "features",  "name": "Feature Engineering", "queue": "data_processing"},
            {"id": "split",     "name": "Train/Test Split",    "queue": "data_processing"},
            {"id": "train_rf",  "name": "Train RandomForest",  "queue": "training"},
            {"id": "train_xgb", "name": "Train XGBoost",       "queue": "training"},
            {"id": "train_lgb", "name": "Train LightGBM",      "queue": "training"},
            {"id": "train_ada", "name": "Train AdaBoost",      "queue": "training"},
            {"id": "train_gru", "name": "Train GRU",           "queue": "training"},
            {"id": "evaluate",  "name": "Evaluate",            "queue": "testing"},
            {"id": "save",      "name": "Save Best Model",     "queue": "custom"},
        ],
    },
    {
        "id": "pipeline-registry",
        "name": "Registry Pipeline",
        "subtitle": "",
        "description": "Évaluation, champion/challenger, versioning et push vers ClearML Model Store",
        "script": "pipeline_registry.py",
        "args": [],
        "type": "Registry",
        "color": "#d97706",
        "clearml_name": "Registry Pipeline",
        "steps": [
            {"id": "evaluate", "name": "Evaluate All",       "queue": "testing"},
            {"id": "champion", "name": "Champion/Challenger", "queue": "testing"},
            {"id": "version",  "name": "Version Model",       "queue": "custom"},
            {"id": "push",     "name": "Push to ClearML",     "queue": "custom"},
        ],
    },
    {
        "id": "pipeline-serving",
        "name": "Serving Pipeline",
        "subtitle": "",
        "description": "Chargement registry → Warmup → Déploiement API FastAPI CWSI",
        "script": "pipeline_serving.py",
        "args": [],
        "type": "Serving",
        "color": "#dc2626",
        "clearml_name": "Serving Pipeline",
        "steps": [
            {"id": "load",   "name": "Load from Registry", "queue": "data_processing"},
            {"id": "warmup", "name": "Warmup",             "queue": "testing"},
            {"id": "api",    "name": "Generate API",       "queue": "custom"},
        ],
    },
    {
        "id": "pipeline-monitoring",
        "name": "Monitoring Pipeline",
        "subtitle": "",
        "description": "Détection de drift (PSI, KS test) et alerte/retraining automatique",
        "script": "pipeline_monitoring.py",
        "args": [],
        "type": "Monitoring",
        "color": "#db2777",
        "clearml_name": "Monitoring Pipeline",
        "steps": [
            {"id": "collect",     "name": "Collect Predictions", "queue": "data_processing"},
            {"id": "input_drift", "name": "Detect Input Drift",  "queue": "monitor"},
            {"id": "model_drift", "name": "Detect Model Drift",  "queue": "monitor"},
            {"id": "alert",       "name": "Alert & Retrain",     "queue": "monitor"},
        ],
    },
]

# ── Config schemas ────────────────────────────────────────────────────────────
# Each field: key, label, hint, type (slider|number|select|boolean),
#             min/max/step (slider/number), options (select), default,
#             read_regex (capture group 1 = current value),
#             write_regex + write_tpl (for patching the script)

def _field(key, label, ftype, default, *, hint="", group="", min=None, max=None,
           step=None, options=None, rr=None, wr=None, wt=None):
    f = {"key": key, "label": label, "type": ftype, "default": default,
         "hint": hint, "group": group}
    if min is not None: f["min"] = min
    if max is not None: f["max"] = max
    if step is not None: f["step"] = step
    if options is not None: f["options"] = options
    if rr:  f["read_regex"] = rr
    if wr:  f["write_regex"] = wr
    if wt:  f["write_tpl"]   = wt
    return f


CONFIG_SCHEMAS: Dict[str, dict] = {

    "pipeline-training": {
        "title": "MLOps Pipeline — Hyperparamètres",
        "sections": [
            {
                "id": "randomforest", "title": "RandomForest", "icon": "🌲",
                "fields": [
                    _field("rf_n_estimators", "n_estimators", "slider", 200,
                           hint="Nombre d'arbres dans la forêt", min=50, max=600, step=50,
                           rr=r"RandomForestRegressor\([^\n]*n_estimators\s*=\s*(\d+)",
                           wr=r"(RandomForestRegressor\([^\n]*n_estimators\s*=\s*)\d+",  wt=r"\g<1>{v}"),
                    _field("rf_max_depth", "max_depth", "slider", 10,
                           hint="Profondeur maximale des arbres (None = illimité)", min=3, max=30, step=1,
                           rr=r"RandomForestRegressor\([^\n]*max_depth\s*=\s*(\d+)",
                           wr=r"(RandomForestRegressor\([^\n]*max_depth\s*=\s*)\d+",    wt=r"\g<1>{v}"),
                    _field("rf_min_samples_split", "min_samples_split", "slider", 2,
                           hint="Nb min d'échantillons pour diviser un nœud", min=2, max=20, step=1,
                           rr=r"RandomForestRegressor\([^\n]*min_samples_split\s*=\s*(\d+)",
                           wr=r"(RandomForestRegressor\([^\n]*min_samples_split\s*=\s*)\d+", wt=r"\g<1>{v}"),
                ],
            },
            {
                "id": "xgboost", "title": "XGBoost", "icon": "⚡",
                "fields": [
                    _field("xgb_n_estimators", "n_estimators", "slider", 200,
                           min=50, max=600, step=50,
                           rr=r"XGBRegressor\([^\n]*n_estimators\s*=\s*(\d+)",
                           wr=r"(XGBRegressor\([^\n]*n_estimators\s*=\s*)\d+",          wt=r"\g<1>{v}"),
                    _field("xgb_max_depth", "max_depth", "slider", 6,
                           min=2, max=15, step=1,
                           rr=r"XGBRegressor\([^\n]*max_depth\s*=\s*(\d+)",
                           wr=r"(XGBRegressor\([^\n]*max_depth\s*=\s*)\d+",             wt=r"\g<1>{v}"),
                    _field("xgb_lr", "learning_rate", "slider", 0.1,
                           hint="Taux d'apprentissage", min=0.01, max=0.5, step=0.01,
                           rr=r"XGBRegressor\([\s\S]*?learning_rate\s*=\s*([\d.]+)",
                           wr=r"(XGBRegressor\([\s\S]*?learning_rate\s*=\s*)[\d.]+",    wt=r"\g<1>{v}"),
                ],
            },
            {
                "id": "lightgbm", "title": "LightGBM", "icon": "💡",
                "fields": [
                    _field("lgb_n_estimators", "n_estimators", "slider", 200,
                           min=50, max=600, step=50,
                           rr=r"LGBMRegressor\([^\n]*n_estimators\s*=\s*(\d+)",
                           wr=r"(LGBMRegressor\([^\n]*n_estimators\s*=\s*)\d+",         wt=r"\g<1>{v}"),
                    _field("lgb_lr", "learning_rate", "slider", 0.1,
                           min=0.01, max=0.5, step=0.01,
                           rr=r"LGBMRegressor\([\s\S]*?learning_rate\s*=\s*([\d.]+)",
                           wr=r"(LGBMRegressor\([\s\S]*?learning_rate\s*=\s*)[\d.]+",   wt=r"\g<1>{v}"),
                ],
            },
            {
                "id": "adaboost", "title": "AdaBoost", "icon": "🔄",
                "fields": [
                    _field("ada_dt_depth", "DecisionTree max_depth", "slider", 4,
                           hint="Profondeur des arbres de base d'AdaBoost", min=1, max=10, step=1,
                           rr=r"DecisionTreeRegressor\(max_depth\s*=\s*(\d+)",
                           wr=r"(DecisionTreeRegressor\(max_depth\s*=\s*)\d+",          wt=r"\g<1>{v}"),
                    _field("ada_n_estimators", "n_estimators", "slider", 100,
                           min=10, max=300, step=10,
                           rr=r"AdaBoostRegressor\([\s\S]*?n_estimators\s*=\s*(\d+)",
                           wr=r"(AdaBoostRegressor\([\s\S]*?n_estimators\s*=\s*)\d+",   wt=r"\g<1>{v}"),
                ],
            },
            {
                "id": "gru", "title": "GRU (Deep Learning)", "icon": "🧠",
                "fields": [
                    _field("gru_seq_len", "seq_len", "slider", 12,
                           hint="Longueur des séquences temporelles en entrée", min=4, max=32, step=2,
                           rr=r"SEQ_LEN\s*=\s*(\d+)",
                           wr=r"(SEQ_LEN\s*=\s*)\d+",                                   wt=r"\g<1>{v}"),
                    _field("gru_epochs", "epochs", "slider", 100,
                           hint="Nombre d'epochs d'entraînement", min=10, max=300, step=10,
                           rr=r"epochs\s*=\s*(\d+)",
                           wr=r"(epochs\s*=\s*)\d+",                                    wt=r"\g<1>{v}"),
                    _field("gru_batch_size", "batch_size", "select", 256,
                           hint="Taille du batch", options=[32, 64, 128, 256, 512],
                           rr=r"batch_size\s*=\s*(\d+)",
                           wr=r"(batch_size\s*=\s*)\d+",                                wt=r"\g<1>{v}"),
                    _field("gru_lr", "Adam learning_rate", "slider", 0.001,
                           hint="Taux d'apprentissage de l'optimiseur Adam", min=0.0001, max=0.01, step=0.0001,
                           rr=r"Adam\(learning_rate\s*=\s*([\d.e-]+)",
                           wr=r"(Adam\(learning_rate\s*=\s*)[\d.e-]+",                  wt=r"\g<1>{v}"),
                ],
            },
        ],
    },

    "pipeline-monitoring": {
        "title": "Monitoring Pipeline — Seuils de drift",
        "sections": [
            {
                "id": "drift", "title": "Seuils de détection", "icon": "📊",
                "fields": [
                    _field("psi_threshold", "Seuil PSI", "slider", 0.2,
                           hint="Population Stability Index — drift données d'entrée. Plus faible = plus sensible.",
                           min=0.05, max=0.5, step=0.05,
                           rr=r"PSI_THRESHOLD\s*=\s*([\d.]+)",
                           wr=r"(PSI_THRESHOLD\s*=\s*)[\d.]+",                          wt=r"\g<1>{v}"),
                    _field("ks_pvalue", "Seuil KS p-value", "slider", 0.05,
                           hint="Kolmogorov-Smirnov — niveau de significativité statistique",
                           min=0.01, max=0.2, step=0.01,
                           rr=r"ks_pval\s*<\s*([\d.]+)",
                           wr=r"(ks_pval\s*<\s*)[\d.]+",                                wt=r"\g<1>{v}"),
                    _field("mean_shift", "Seuil mean shift", "slider", 0.1,
                           hint="Décalage moyen des prédictions CWSI — concept drift",
                           min=0.02, max=0.5, step=0.02,
                           rr=r"mean_shift\s*>\s*([\d.]+)",
                           wr=r"(mean_shift\s*>\s*)[\d.]+",                             wt=r"\g<1>{v}"),
                ],
            },
        ],
    },

    "pipeline-registry": {
        "title": "Registry Pipeline — Stratégie de promotion",
        "sections": [
            {
                "id": "champion", "title": "Champion / Challenger", "icon": "🏆",
                "fields": [
                    _field("r2_gain", "Gain R² min pour promotion", "slider", 0.001,
                           hint="Le challenger doit dépasser le champion d'au moins cette valeur pour être promu",
                           min=0.0, max=0.05, step=0.001,
                           rr=r"challenger_r2\s*>\s*champion_r2\s*\+\s*([\d.]+)",
                           wr=r"(challenger_r2\s*>\s*champion_r2\s*\+\s*)[\d.]+",       wt=r"\g<1>{v}"),
                ],
            },
        ],
    },

    "pipeline-validation": {
        "title": "Validation Pipeline — Règles de qualité",
        "sections": [
            {
                "id": "quality", "title": "Seuils de qualité données", "icon": "🛡️",
                "fields": [
                    _field("null_rate_max", "Taux nuls max autorisé (%)", "slider", 5,
                           hint="Pourcentage max de valeurs nulles par colonne avant alerte",
                           min=0, max=30, step=1,
                           rr=r"null_rate.*?>\s*([\d.]+)",
                           wr=r"(null_rate.*?>\s*)[\d.]+",                              wt=r"\g<1>{v}"),
                    _field("lst_min", "LST min (°C)", "slider", -10,
                           hint="Température de surface minimale valide", min=-30, max=0, step=1,
                           rr=r"df\['LST'\]\s*<\s*([-\d]+)",
                           wr=r"(df\['LST'\]\s*<\s*)[-\d]+",                           wt=r"\g<1>{v}"),
                    _field("lst_max", "LST max (°C)", "slider", 70,
                           hint="Température de surface maximale valide", min=40, max=90, step=1,
                           rr=r"df\['LST'\]\s*>\s*(\d+)",
                           wr=r"(df\['LST'\]\s*>\s*)\d+",                              wt=r"\g<1>{v}"),
                ],
            },
        ],
    },

    "pipeline-dataset": {
        "title": "Dataset Versioning — Configuration",
        "sections": [
            {
                "id": "versioning", "title": "Versioning", "icon": "🗄️",
                "fields": [
                    _field("csv_pattern", "Pattern CSV", "text", "Maroc_ENV_Features_*.csv",
                           hint="Glob pattern pour sélectionner les fichiers CSV"),
                ],
            },
        ],
    },
}

# ── Config helpers ─────────────────────────────────────────────────────────────

def _parse_config_values(pipeline_id: str, script: str) -> dict:
    """Reads current parameter values from the script using regex."""
    schema = CONFIG_SCHEMAS.get(pipeline_id)
    if not schema:
        return {}
    values = {}
    for sec in schema["sections"]:
        for f in sec["fields"]:
            rr = f.get("read_regex")
            if not rr:
                values[f["key"]] = f["default"]
                continue
            try:
                m = re.search(rr, script, re.MULTILINE | re.DOTALL)
                if m:
                    raw = m.group(1).strip()
                    # Try to convert to appropriate type
                    try:
                        if f["type"] in ("slider", "number"):
                            values[f["key"]] = float(raw) if "." in raw else int(raw)
                        else:
                            values[f["key"]] = raw
                    except ValueError:
                        values[f["key"]] = f["default"]
                else:
                    values[f["key"]] = f["default"]
            except Exception:
                values[f["key"]] = f["default"]
    return values


def _apply_config_values(pipeline_id: str, script: str, values: dict) -> str:
    """Patches the script with new parameter values using regex substitution."""
    schema = CONFIG_SCHEMAS.get(pipeline_id)
    if not schema:
        return script
    patched = script
    for sec in schema["sections"]:
        for f in sec["fields"]:
            wr = f.get("write_regex")
            wt = f.get("write_tpl")
            if not wr or not wt:
                continue
            key = f["key"]
            if key not in values:
                continue
            v = values[key]
            # Format float values cleanly
            if isinstance(v, float):
                v_str = f"{v:.4f}".rstrip("0").rstrip(".")
                if "." not in v_str and f["type"] == "slider" and f.get("step", 1) < 1:
                    v_str = f"{v:.4f}"
            else:
                v_str = str(v)
            replacement = wt.replace("{v}", v_str)
            try:
                patched = re.sub(wr, replacement, patched, flags=re.MULTILINE | re.DOTALL)
            except Exception:
                pass  # Leave unchanged if regex fails
    return patched


# ── Runtime run state (in-memory) ─────────────────────────────────────────────
_runs: Dict[str, dict] = {}


def _get_pipeline(pid: str) -> dict:
    p = next((p for p in PIPELINES if p["id"] == pid), None)
    if not p:
        raise HTTPException(404, f"Pipeline '{pid}' introuvable")
    return p


def _read_script(script: str) -> str:
    path = PROJECT_DIR / script
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return f"# Fichier '{script}' introuvable dans {PROJECT_DIR}"


def _clearml_last_run(clearml_name: str) -> dict:
    """Tries to fetch last ClearML task status for the pipeline."""
    if not CLEARML_AVAILABLE:
        return {}
    try:
        tasks = Task.query_tasks(
            project_name="MALOPS",
            task_filter={"name": [clearml_name], "status": ["completed", "failed", "in_progress"]},
        )
        if not tasks:
            return {}
        t = tasks[0]
        status_map = {
            "completed":   "Completed",
            "failed":      "Failed",
            "in_progress": "Running",
            "created":     "Queued",
        }
        return {
            "clearml_task_id": str(t),
            "clearml_status":  status_map.get(t.status, t.status),
            "clearml_started": str(t.data.started)   if t.data.started   else None,
            "clearml_ended":   str(t.data.completed) if t.data.completed else None,
        }
    except Exception:
        return {}


def _enrich_pipeline(p: dict) -> dict:
    """Adds last run info (ClearML or local) to a pipeline definition."""
    run = _runs.get(p["id"], {})
    clearml_info = _clearml_last_run(p["clearml_name"])
    script_path = PROJECT_DIR / p["script"]
    return {
        **p,
        "script_exists": script_path.exists(),
        "status": run.get("status") or clearml_info.get("clearml_status") or "Idle",
        "last_run": run.get("started_at") or clearml_info.get("clearml_started"),
        "current_run": {
            "status":       run.get("status"),
            "steps_status": run.get("steps_status", {}),
            "logs":         run.get("logs", [])[-100:],
            "started_at":   run.get("started_at"),
            "ended_at":     run.get("ended_at"),
            "run_id":       run.get("run_id"),
        } if run else None,
        **clearml_info,
    }


# ── Detect step progress from stdout ─────────────────────────────────────────

_STEP_START_PATTERNS = [
    r"→\s+lancement\s*:\s*(\w+)",          # orchestrator "→ Lancement : DATASET"
    r"starting\s+pipeline.*?:\s*([\w\s]+)", # generic
    r"step_(\w+)\s+start",
    r"\[step\]\s*(\w+)",
    r"étape\s+\d+.*?:\s*([\w\s]+?)\s*[-–]",
]

_STEP_OK_PATTERNS = [
    r"✓\s+(\w+)\s+termin",    # orchestrator "✓ dataset terminé"
    r"step_(\w+).*?completed",
    r"(\w+).*?pipeline completed",
    r"✅.*?(\w+)",
]

_STEP_FAIL_PATTERNS = [
    r"✗\s+(\w+)",
    r"step_(\w+).*?failed",
    r"(\w+)\s+échoué",
    r"❌.*?(\w+)",
]


def _detect_steps(pipeline_id: str, line: str):
    run = _runs.get(pipeline_id)
    if not run:
        return
    pipeline = next((p for p in PIPELINES if p["id"] == pipeline_id), None)
    if not pipeline:
        return

    steps = pipeline["steps"]
    ss = run["steps_status"]
    step_ids = [s["id"] for s in steps]
    step_names_lc = {s["name"].lower(): s["id"] for s in steps}
    line_lc = line.lower()

    def _match_step(token: str) -> Optional[str]:
        token = token.strip().lower()
        if token in step_ids:
            return token
        # partial match on step id
        for sid in step_ids:
            if sid.startswith(token) or token.startswith(sid[:4]):
                return sid
        # match on step name
        for name, sid in step_names_lc.items():
            if token in name or name in token:
                return sid
        return None

    # Check start
    for pat in _STEP_START_PATTERNS:
        m = re.search(pat, line_lc)
        if m:
            sid = _match_step(m.group(1))
            if sid and ss.get(sid) == "pending":
                ss[sid] = "running"
                # Mark previous pending steps as completed (pipeline moved past them)
                for s in steps:
                    if s["id"] == sid:
                        break
                    if ss.get(s["id"]) in ("pending", "running"):
                        ss[s["id"]] = "completed"
                break

    # Check success
    for pat in _STEP_OK_PATTERNS:
        m = re.search(pat, line_lc)
        if m:
            sid = _match_step(m.group(1))
            if sid:
                ss[sid] = "completed"
            # If "pipeline completed" → mark all remaining as completed
            if "pipeline completed" in line_lc or "pipeline terminé" in line_lc:
                for s in steps:
                    if ss.get(s["id"]) != "failed":
                        ss[s["id"]] = "completed"
            break

    # Check failure
    for pat in _STEP_FAIL_PATTERNS:
        m = re.search(pat, line_lc)
        if m:
            sid = _match_step(m.group(1))
            if sid:
                ss[sid] = "failed"
            break


def _run_thread(pipeline_id: str, script: str, args: list, extra_env: dict = None):
    run = _runs[pipeline_id]
    pipeline = next((p for p in PIPELINES if p["id"] == pipeline_id), None)
    steps = pipeline["steps"] if pipeline else []

    # Start first step
    if steps:
        run["steps_status"][steps[0]["id"]] = "running"

    cmd = ["python3", str(PROJECT_DIR / script)] + args

    # Environnement : hérite du processus parent + variables projet
    import os as _os
    env = _os.environ.copy()
    if extra_env:
        env.update(extra_env)

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=str(PROJECT_DIR),
            bufsize=1,
            env=env,
        )
        run["pid"] = proc.pid

        for raw_line in proc.stdout:
            line = raw_line.rstrip()
            ts = datetime.now().strftime("%H:%M:%S")
            run["logs"].append(f"[{ts}] {line}")
            _detect_steps(pipeline_id, line)

            # Heuristic: if we see a "✓" or step completion, advance to next pending step
            ss = run["steps_status"]
            running_ids = [s["id"] for s in steps if ss.get(s["id"]) == "running"]
            for rid in running_ids:
                if "✓" in line or "termin" in line.lower() or "completed" in line.lower():
                    ss[rid] = "completed"
                    # Activate next pending step
                    idx = next((i for i, s in enumerate(steps) if s["id"] == rid), -1)
                    if idx >= 0 and idx + 1 < len(steps):
                        nxt = steps[idx + 1]["id"]
                        if ss.get(nxt) == "pending":
                            ss[nxt] = "running"

        proc.wait()
        run["return_code"] = proc.returncode
        run["ended_at"] = datetime.utcnow().isoformat()

        if proc.returncode == 0:
            run["status"] = "completed"
            for s in steps:
                if ss.get(s["id"]) != "failed":
                    ss[s["id"]] = "completed"
        else:
            run["status"] = "failed"
            for s in steps:
                if ss.get(s["id"]) == "running":
                    ss[s["id"]] = "failed"

    except Exception as exc:
        run["status"] = "failed"
        run["ended_at"] = datetime.utcnow().isoformat()
        run["logs"].append(f"[ERROR] {exc}")


# ── Router ────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/clearml-pipelines", tags=["clearml-pipelines"])


class ScriptBody(BaseModel):
    script: str


class RunConfig(BaseModel):
    args: list = []


@router.get("")
def list_pipelines(_: User = Depends(require_roles(["data_scientist", "mlops_engineer"]))):
    return {"pipelines": [_enrich_pipeline(p) for p in PIPELINES]}


@router.get("/{pid}")
def get_pipeline(pid: str, _: User = Depends(require_roles(["data_scientist"]))):
    return _enrich_pipeline(_get_pipeline(pid))


@router.get("/{pid}/script")
def get_script(pid: str, _: User = Depends(require_roles(["data_scientist"]))):
    p = _get_pipeline(pid)
    return {"script": _read_script(p["script"]), "filename": p["script"]}


@router.put("/{pid}/script")
def save_script(pid: str, body: ScriptBody, _: User = Depends(require_roles(["data_scientist"]))):
    p = _get_pipeline(pid)
    path = PROJECT_DIR / p["script"]
    try:
        path.write_text(body.script, encoding="utf-8")
        return {"message": f"Script '{p['script']}' sauvegardé."}
    except Exception as exc:
        raise HTTPException(500, f"Erreur écriture : {exc}")


@router.post("/{pid}/run")
def run_pipeline(pid: str, _: User = Depends(require_roles(["data_scientist"]))):
    p = _get_pipeline(pid)
    run = _runs.get(pid, {})
    if run.get("status") == "running":
        raise HTTPException(409, "Pipeline déjà en cours d'exécution")

    run_id = f"run-{pid}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
    _runs[pid] = {
        "run_id":       run_id,
        "status":       "running",
        "steps_status": {s["id"]: "pending" for s in p["steps"]},
        "logs":         [],
        "pid":          None,
        "return_code":  None,
        "started_at":   datetime.utcnow().isoformat(),
        "ended_at":     None,
    }
    t = threading.Thread(
        target=_run_thread,
        args=(pid, p["script"], p["args"]),
        daemon=True,
    )
    t.start()
    return {"run_id": run_id, "message": f"Pipeline '{p['name']}' lancé."}


@router.post("/{pid}/stop")
def stop_pipeline(pid: str, _: User = Depends(require_roles(["data_scientist"]))):
    run = _runs.get(pid)
    if not run or run.get("status") != "running":
        raise HTTPException(404, "Aucun pipeline en cours")
    proc_pid = run.get("pid")
    if proc_pid:
        try:
            import signal, os
            os.kill(proc_pid, signal.SIGTERM)
        except Exception:
            pass
    run["status"] = "failed"
    run["ended_at"] = datetime.utcnow().isoformat()
    run["logs"].append(f"[{datetime.now().strftime('%H:%M:%S')}] ⛔ Pipeline arrêté manuellement.")
    for sid, s in run["steps_status"].items():
        if s == "running":
            run["steps_status"][sid] = "failed"
    return {"message": "Pipeline arrêté."}


@router.get("/{pid}/run-status")
def run_status(pid: str, _: User = Depends(require_roles(["data_scientist"]))):
    run = _runs.get(pid)
    if not run:
        return {"status": "idle", "steps_status": {}, "logs": [], "run_id": None}
    return {
        "run_id":       run["run_id"],
        "status":       run["status"],
        "steps_status": run["steps_status"],
        "logs":         run["logs"][-200:],
        "started_at":   run["started_at"],
        "ended_at":     run["ended_at"],
    }


# ── Config endpoints ─────────────────────────────────────────────────────────

class ConfigBody(BaseModel):
    values: dict


@router.get("/{pid}/config")
def get_config(pid: str, _: User = Depends(require_roles(["data_scientist"]))):
    """Return current config values for a pipeline (from JSON store + defaults)."""
    _get_pipeline(pid)  # validate pid exists
    values = _get_pipeline_config(pid)
    # Also try regex-parsed values for numeric script params and merge
    p = next(p for p in PIPELINES if p["id"] == pid)
    script = _read_script(p["script"])
    script_vals = _parse_config_values(pid, script)
    # Script values take precedence for params that exist in regex schema
    merged = {**values, **{k: v for k, v in script_vals.items() if k in script_vals}}
    return {"pipeline_id": pid, "values": merged}


@router.put("/{pid}/config")
def save_config(pid: str, body: ConfigBody, _: User = Depends(require_roles(["data_scientist"]))):
    """Save config to JSON store and patch the Python script for numeric params."""
    p = _get_pipeline(pid)
    # 1. Save to JSON store
    all_cfgs = _load_all_configs()
    all_cfgs[pid] = body.values
    _save_all_configs(all_cfgs)
    # 2. Also patch script for params that have regex patterns (numeric params)
    patched_count = 0
    if pid in CONFIG_SCHEMAS:
        script = _read_script(p["script"])
        if not script.startswith("# Fichier"):
            patched = _apply_config_values(pid, script, body.values)
            if patched != script:
                try:
                    (PROJECT_DIR / p["script"]).write_text(patched, encoding="utf-8")
                    patched_count = sum(
                        1 for sec in CONFIG_SCHEMAS[pid]["sections"]
                        for f in sec["fields"] if f.get("write_regex") and f["key"] in body.values
                    )
                except Exception:
                    pass
    return {"message": f"Configuration sauvegardée. {patched_count} paramètre(s) appliqué(s) au script."}
