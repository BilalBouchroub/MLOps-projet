import io
import os
import json
import re
import math
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel as _BM
from typing import Optional
from sqlalchemy.orm import Session
from routers.auth import require_roles, get_current_active_user
from models.user import User
from database import get_db
from utils.project_dirs import BASE_DIR, get_user_project_dir

DATA_DIR               = BASE_DIR
VALIDATION_SCHEMA_PATH = os.path.join(BASE_DIR, "validation_schema.json")
PRODUCTION_MODEL_PATH  = os.path.join(BASE_DIR, "production_model.json")
DATASET_REGISTRY_PATH  = os.path.join(BASE_DIR, "dataset_registry.json")

REQUIRED_FEATURES = ['NDVI', 'NDWI', 'MSI', 'LST', 'Precipitation', 'SoilMoisture', 'ET0']

router = APIRouter(prefix="/datasets", tags=["datasets"])


def _registry_path(data_dir: str) -> str:
    """Chemin du registre de datasets pour un dossier donné."""
    if data_dir == BASE_DIR:
        return DATASET_REGISTRY_PATH
    return os.path.join(data_dir, "dataset_registry.json")


def _validation_schema_path(data_dir: str) -> str:
    """Chemin du schéma de validation pour un dossier donné."""
    if data_dir == BASE_DIR:
        return VALIDATION_SCHEMA_PATH
    return os.path.join(data_dir, "validation_schema.json")


def _load_registry(path: str = None) -> dict:
    try:
        with open(path or DATASET_REGISTRY_PATH) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def _save_registry(reg: dict, path: str = None):
    p = path or DATASET_REGISTRY_PATH
    with open(p, "w") as f:
        json.dump(reg, f, indent=2)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _load_validation_schema(data_dir: str = None):
    path = _validation_schema_path(data_dir or DATA_DIR)
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return {"per_file": {}, "warnings": [], "total_files": 0, "issues": []}


def _file_row(fname, data_dir: str = None):
    d = data_dir or DATA_DIR
    val = _load_validation_schema(d)
    per_file = val.get("per_file", {})
    warnings = val.get("warnings", [])
    bad = {w.split(" : ")[0].strip() for w in warnings if "colonnes absentes" in w}
    fpath = os.path.join(d, fname)
    stat  = os.stat(fpath)
    info  = per_file.get(fname, {})
    null_rate = info.get("null_rate", 0.0)
    rows      = info.get("rows")
    status    = "RAW" if fname in bad or null_rate > 0 else "VALIDATED"
    year_m    = re.search(r"(\d{4})", fname)
    return {
        "filename":      fname,
        "year":          year_m.group(1) if year_m else None,
        "size_bytes":    stat.st_size,
        "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "rows":          rows,
        "null_pct":      round(null_rate * 100, 2),
        "status":        status,
    }


# ── List / config endpoints ───────────────────────────────────────────────────

@router.get("")
def list_datasets(
    current_user: User = Depends(require_roles(["data_engineer", "data_scientist"])),
    db: Session = Depends(get_db),
):
    registry = _load_registry()
    datasets = []

    for fname in sorted(os.listdir(DATA_DIR)):
        if not fname.endswith(".csv"):
            continue
        try:
            row = _file_row(fname, DATA_DIR)
            entry = registry.get(fname, {})
            row["uploaded_by"] = entry.get("username")
            row["region"]      = entry.get("region")
            datasets.append(row)
        except Exception:
            pass
    return {"datasets": datasets}


@router.get("/available")
def get_available_datasets(
    current_user: User = Depends(require_roles(["data_engineer", "data_scientist"])),
    db: Session = Depends(get_db),
):
    return list_datasets(current_user, db)


@router.get("/config")
def get_dataset_config(_: User = Depends(require_roles(["data_engineer"]))):
    from routers.clearml_pipelines import _get_pipeline_config
    return {"config": _get_pipeline_config("pipeline-dataset")}


class _DatasetConfigBody(_BM):
    config: dict


@router.put("/config")
def save_dataset_config(body: _DatasetConfigBody,
                        _: User = Depends(require_roles(["data_engineer"]))):
    from routers.clearml_pipelines import _load_all_configs, _save_all_configs
    all_cfgs = _load_all_configs()
    all_cfgs["pipeline-dataset"] = body.config
    _save_all_configs(all_cfgs)
    return {"message": "Configuration dataset sauvegardée."}


# ── Upload CSV ────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    year: Optional[int] = Form(None),
    custom_name: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    clearml_project: Optional[str] = Form(None),
    current_user: User = Depends(require_roles(["data_engineer", "data_scientist", "mlops_engineer"])),
    db: Session = Depends(get_db),
):
    """
    Upload a CSV file with NDVI, NDWI, MSI, LST, Precipitation, SoilMoisture, ET0 columns.
    Saves it to the project directory and returns a preview with column validation.
    """
    import pandas as pd

    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Seuls les fichiers .csv sont acceptés.")

    content = await file.read()
    if len(content) > 200 * 1024 * 1024:  # 200 MB
        raise HTTPException(413, "Fichier trop volumineux (max 200 MB).")

    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Impossible de lire le CSV : {e}")

    # Validate required columns
    missing = [c for c in REQUIRED_FEATURES if c not in df.columns]

    # Auto-detect year from data if not provided
    if year is None and 'year' in df.columns:
        try:
            year = int(df['year'].mode()[0])
        except Exception:
            pass

    # Determine save filename — keep original name
    if custom_name:
        save_name = custom_name if custom_name.endswith(".csv") else custom_name + ".csv"
    else:
        save_name = os.path.basename(file.filename)

    # Sauvegarder directement dans le dossier racine (visible partout)
    save_path = os.path.join(DATA_DIR, save_name)
    with open(save_path, "wb") as f_out:
        f_out.write(content)

    # Enregistrer dans le registre racine
    registry = _load_registry()
    registry[save_name] = {
        "user_id":     str(current_user.id),
        "username":    current_user.username,
        "uploaded_at": datetime.utcnow().isoformat(),
        "region":      region or None,
    }
    _save_registry(registry)

    # Statistics
    available = [c for c in REQUIRED_FEATURES if c in df.columns]
    null_pct  = round(df[available].isnull().mean().mean() * 100, 2) if available else 100.0

    # Preview — first 5 rows of feature columns only
    preview_cols = [c for c in REQUIRED_FEATURES if c in df.columns]
    extra_cols   = [c for c in ['latitude', 'longitude', 'year', 'month'] if c in df.columns]
    preview_df   = df[extra_cols + preview_cols].head(5)
    preview      = preview_df.fillna("").astype(str).to_dict("records")

    return {
        "filename":       save_name,
        "original_name":  file.filename,
        "year":           year,
        "rows":           len(df),
        "columns":        list(df.columns),
        "missing_required": missing,
        "available_features": available,
        "null_pct":       null_pct,
        "preview":        preview,
        "saved":          True,
        "can_predict":    len(missing) == 0,
        "message":        f"Fichier sauvegardé sous '{save_name}'."
                          + (f" Colonnes manquantes : {missing}." if missing else ""),
    }


# ── Predict from uploaded file ────────────────────────────────────────────────

@router.post("/{filename}/predict")
def predict_from_file(
    filename: str,
    current_user: User = Depends(require_roles(["data_engineer", "data_scientist", "mlops_engineer"])),
    db: Session = Depends(get_db),
):
    """
    Run CWSI predictions on a CSV file using the production model.
    Returns stress distribution, verdicts, and geographic sample.
    """
    import pandas as pd
    import numpy as np

    # --- Load production model ---
    try:
        with open(PRODUCTION_MODEL_PATH) as f:
            prod = json.load(f)
        import joblib
        model  = joblib.load(prod["model_path"])
        scaler = joblib.load(prod["scaler_path"])
    except Exception as e:
        raise HTTPException(500, f"Erreur chargement modèle : {e}")

    # --- Read CSV : chercher d'abord dans DATA_DIR (root), puis dans le dossier projet ---
    csv_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(csv_path):
        data_dir = get_user_project_dir(current_user, db)
        csv_path = os.path.join(data_dir, filename)
    if not os.path.exists(csv_path):
        raise HTTPException(404, f"Fichier '{filename}' introuvable.")

    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        raise HTTPException(400, f"Impossible de lire le CSV : {e}")

    missing = [c for c in REQUIRED_FEATURES if c not in df.columns]
    if missing:
        raise HTTPException(400, f"Colonnes manquantes pour la prédiction : {missing}")

    # --- Pre-process: auto-convert LST if raw Kelvin×10 format (values >> 100) ---
    # Remplacer les valeurs NoData sentinelle par NaN
    df = _clean_nodata(df, REQUIRED_FEATURES)

    # Conversion LST automatique
    df = df.copy()
    df['LST'], lst_conversion = _convert_lst(df['LST'])
    if lst_conversion:
        df = df[(df['LST'] > -10) & (df['LST'] < 80)]

    # --- Predict ---
    df_clean = df.dropna(subset=REQUIRED_FEATURES).copy()
    if len(df_clean) == 0:
        raise HTTPException(400, "Le fichier ne contient aucune ligne complète (valeurs nulles ou LST hors limites).")

    X      = df_clean[REQUIRED_FEATURES].values
    X_sc   = scaler.transform(X)
    cwsi   = model.predict(X_sc)

    df_clean["cwsi"]  = cwsi
    df_clean["stress_class"] = pd.cut(
        cwsi,
        bins=[-0.001, 0.4, 0.6, 1.001],
        labels=["Faible", "Modéré", "Sévère"],
    )

    # --- Statistics ---
    n         = len(df_clean)
    mean_cwsi = float(cwsi.mean())
    std_cwsi  = float(cwsi.std())

    counts = df_clean["stress_class"].value_counts()
    faible_n  = int(counts.get("Faible",  0))
    modere_n  = int(counts.get("Modéré",  0))
    severe_n  = int(counts.get("Sévère",  0))

    def pct(v): return round(v / n * 100, 1)

    # Overall verdict
    if pct(severe_n) >= 40:
        verdict   = "⚠️ Stress sévère"
        verdict_color = "#dc2626"
    elif pct(severe_n) + pct(modere_n) >= 50:
        verdict   = "⚡ Stress modéré"
        verdict_color = "#d97706"
    else:
        verdict   = "✅ Faible stress hydrique"
        verdict_color = "#16a34a"

    # Distribution per feature (mean)
    feature_stats = {
        feat: {
            "mean": round(float(df_clean[feat].mean()), 4),
            "std":  round(float(df_clean[feat].std()),  4),
        }
        for feat in REQUIRED_FEATURES
    }

    # Per-month distribution if available
    monthly = []
    if 'month' in df_clean.columns:
        for month, grp in df_clean.groupby('month'):
            monthly.append({
                "month":      int(month),
                "mean_cwsi":  round(float(grp["cwsi"].mean()), 4),
                "stress_pct": round(float((grp["cwsi"] > 0.4).mean() * 100), 1),
                "n":          len(grp),
            })

    # Geographic sample (max 500 points)
    geo_sample = []
    if 'latitude' in df_clean.columns and 'longitude' in df_clean.columns:
        sample_n = min(500, n)
        step = max(1, n // sample_n)
        sample = df_clean.iloc[::step][['latitude', 'longitude', 'cwsi', 'stress_class']].head(sample_n)
        for _, row in sample.iterrows():
            if not (math.isnan(row['latitude']) or math.isnan(row['longitude'])):
                geo_sample.append({
                    "lat":   round(float(row['latitude']),  4),
                    "lon":   round(float(row['longitude']), 4),
                    "cwsi":  round(float(row['cwsi']),      4),
                    "class": str(row['stress_class']),
                })

    # Auto-detect year from data
    year = None
    if 'year' in df_clean.columns:
        try:
            year = int(df_clean['year'].mode()[0])
        except Exception:
            pass

    return {
        "filename":        filename,
        "year":            year,
        "total_rows":      len(df),
        "analyzed_rows":   n,
        "excluded_rows":   len(df) - n,
        "mean_cwsi":       round(mean_cwsi, 4),
        "std_cwsi":        round(std_cwsi,  4),
        "faible_n":        faible_n,
        "modere_n":        modere_n,
        "severe_n":        severe_n,
        "faible_pct":      pct(faible_n),
        "modere_pct":      pct(modere_n),
        "severe_pct":      pct(severe_n),
        "verdict":         verdict,
        "verdict_color":   verdict_color,
        "feature_stats":   feature_stats,
        "monthly":         monthly,
        "geo_sample":      geo_sample,
        "model_version":   prod.get("version", "v8"),
        "model_name":      prod.get("model_name", "RandomForest"),
        "r2_test":         prod.get("r2_test", 0.973),
        "lst_conversion_applied": lst_conversion,
    }


# ── Helpers ──────────────────────────────────────────────────────────────────

def _convert_lst(series):
    """
    Auto-détecte et convertit LST en °C.
    Formats supportés :
      - Kelvin×10   (ex. 3000 → 26.85°C)  : multiply by 0.1, subtract 273.15
      - Celsius×100 (ex. 4426 → 44.26°C)  : divide by 100
      - Kelvin      (ex. 310  → 36.85°C)  : subtract 273.15
    Retourne (series_celsius, conversion_applied: bool)
    """
    import pandas as pd
    median = series.median()
    if -10 <= median <= 70:          # déjà en °C
        return series, False

    # Essai Kelvin×10
    c = series * 0.1 - 273.15
    if -10 <= c.median() <= 70:
        return c, True

    # Essai Celsius×100
    c = series / 100.0
    if -10 <= c.median() <= 70:
        return c, True

    # Essai Kelvin direct
    c = series - 273.15
    if -10 <= c.median() <= 70:
        return c, True

    # Aucune conversion valide — renvoyer tel quel
    return series, False


def _clean_nodata(df, features, nodata_vals=(-9999, -9999.0)):
    """Remplace les valeurs sentinelle NoData par NaN dans les colonnes features."""
    import numpy as np
    df = df.copy()
    for col in features:
        if col in df.columns:
            df[col] = df[col].replace(list(nodata_vals), np.nan)
    return df


# ── Client: predict directly from uploaded CSV (no storage) ──────────────────

@router.post("/predict-upload")
async def client_predict_upload(
    file: UploadFile = File(...),
    region: Optional[str] = Form(None),
    current_user: User = Depends(get_current_active_user),
):
    """
    Client endpoint: upload a CSV, run predictions immediately, return results.
    The file is processed in memory and never saved to disk.
    Accessible to all authenticated users.
    """
    import pandas as pd
    import numpy as np

    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Seuls les fichiers .csv sont acceptés.")

    content = await file.read()
    if len(content) > 200 * 1024 * 1024:
        raise HTTPException(413, "Fichier trop volumineux (max 200 MB).")

    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Impossible de lire le CSV : {e}")

    missing = [c for c in REQUIRED_FEATURES if c not in df.columns]
    if missing:
        raise HTTPException(400, f"Colonnes manquantes : {missing}. Requis : {REQUIRED_FEATURES}")

    # Load production model
    try:
        with open(PRODUCTION_MODEL_PATH) as f:
            prod = json.load(f)
        import joblib
        model  = joblib.load(prod["model_path"])
        scaler = joblib.load(prod["scaler_path"])
    except Exception as e:
        raise HTTPException(500, f"Erreur chargement modèle : {e}")

    # Remplacer les valeurs NoData sentinelle par NaN
    df = _clean_nodata(df, REQUIRED_FEATURES)

    # Conversion LST automatique (Kelvin×10, Celsius×100, Kelvin direct…)
    df = df.copy()
    df['LST'], lst_conversion = _convert_lst(df['LST'])
    if lst_conversion:
        df = df[(df['LST'] > -10) & (df['LST'] < 80)]

    df_clean = df.dropna(subset=REQUIRED_FEATURES).copy()
    if len(df_clean) == 0:
        raise HTTPException(400, "Aucune ligne complète (valeurs nulles ou LST hors limites). "
                                 "Vérifiez que les colonnes NDVI, NDWI, MSI, LST, "
                                 "Precipitation, SoilMoisture, ET0 ont des valeurs valides.")

    X    = df_clean[REQUIRED_FEATURES].values
    X_sc = scaler.transform(X)
    cwsi = model.predict(X_sc)

    df_clean = df_clean.copy()
    df_clean["cwsi"] = cwsi
    df_clean["stress_class"] = pd.cut(
        cwsi, bins=[-0.001, 0.4, 0.6, 1.001], labels=["Faible", "Modéré", "Sévère"],
    )

    n         = len(df_clean)
    mean_cwsi = float(cwsi.mean())
    std_cwsi  = float(cwsi.std())
    counts    = df_clean["stress_class"].value_counts()
    faible_n  = int(counts.get("Faible",  0))
    modere_n  = int(counts.get("Modéré",  0))
    severe_n  = int(counts.get("Sévère",  0))

    def pct(v): return round(v / n * 100, 1)

    if pct(severe_n) >= 40:
        verdict, verdict_color = "⚠️ Stress sévère", "#dc2626"
    elif pct(severe_n) + pct(modere_n) >= 50:
        verdict, verdict_color = "⚡ Stress modéré", "#d97706"
    else:
        verdict, verdict_color = "✅ Faible stress hydrique", "#16a34a"

    # Monthly stats
    monthly = []
    if 'month' in df_clean.columns:
        for month, grp in df_clean.groupby('month'):
            monthly.append({
                "month": int(month),
                "mean_cwsi": round(float(grp["cwsi"].mean()), 4),
                "n": len(grp),
            })

    # Detect zone column (commune > region)
    zone_col = next((c for c in ["commune", "region"] if c in df_clean.columns), None)

    # Geographic sample for map (up to 3000 points, includes zone name)
    geo_sample = []
    if 'latitude' in df_clean.columns and 'longitude' in df_clean.columns:
        cols = ['latitude', 'longitude', 'cwsi', 'stress_class']
        if zone_col:
            cols.append(zone_col)
        sample_n = min(3000, n)
        step = max(1, n // sample_n)
        sample = df_clean.iloc[::step][cols].head(sample_n)
        for _, row in sample.iterrows():
            try:
                lat, lon = float(row['latitude']), float(row['longitude'])
                if math.isfinite(lat) and math.isfinite(lon):
                    pt = {
                        "lat":   round(lat,  4),
                        "lon":   round(lon,  4),
                        "cwsi":  round(float(row['cwsi']), 4),
                        "class": str(row['stress_class']),
                    }
                    if zone_col:
                        pt["zone"] = str(row[zone_col])
                    geo_sample.append(pt)
            except Exception:
                pass

    # Centroides approx. des régions marocaines (fallback si CSV sans lat/lon)
    _REGION_CENTROIDS = {
        "tanger":      (35.77, -5.80), "tétouan":    (35.57, -5.37),
        "tetouan":     (35.57, -5.37), "kenitra":    (34.26, -6.59),
        "kénitra":     (34.26, -6.59), "rabat":      (34.02, -6.84),
        "khémisset":   (33.82, -6.06), "khemisset":  (33.82, -6.06),
        "meknes":      (33.89, -5.55), "meknès":     (33.89, -5.55),
        "fes":         (34.03, -5.00), "fès":        (34.03, -5.00),
        "oujda":       (34.68, -1.91), "casablanca": (33.57, -7.59),
        "settat":      (33.00, -7.62), "el jadida":  (33.23, -8.51),
        "eljadida":    (33.23, -8.51), "doukkala":   (32.89, -8.30),
        "safi":        (32.30, -9.24), "beni mellal":(32.34, -6.36),
        "benimellal":  (32.34, -6.36), "marrakech":  (31.63, -8.00),
        "agadir":      (30.43, -9.60), "tiznit":     (29.69, -9.73),
        "ouarzazate":  (30.93, -6.89), "errachidia": (31.93, -4.43),
    }

    def _normalise_key(s):
        import unicodedata
        s = unicodedata.normalize('NFD', s.lower().strip())
        return ''.join(c for c in s if unicodedata.category(c) != 'Mn')

    # Breakdown by region or commune — inclut centroïde pour Voronoï
    breakdown = []
    breakdown_type = "global"
    has_coords = 'latitude' in df_clean.columns and 'longitude' in df_clean.columns
    for col, btype in [("commune", "commune"), ("region", "region")]:
        if col in df_clean.columns:
            breakdown_type = btype
            for name, grp in df_clean.groupby(col):
                g_cwsi = grp["cwsi"]
                g_n = len(grp)
                g_counts = grp["stress_class"].value_counts()
                g_mean = float(g_cwsi.mean())
                g_severe_pct = round(int(g_counts.get("Sévère", 0)) / g_n * 100, 1)
                g_modere_pct = round(int(g_counts.get("Modéré", 0)) / g_n * 100, 1)
                g_faible_pct = round(int(g_counts.get("Faible", 0)) / g_n * 100, 1)
                if g_severe_pct >= 40:
                    g_verdict, g_color = "⚠️ Stress sévère", "#dc2626"
                elif g_severe_pct + g_modere_pct >= 50:
                    g_verdict, g_color = "⚡ Stress modéré", "#d97706"
                else:
                    g_verdict, g_color = "✅ Faible stress", "#16a34a"
                entry = {
                    "name":          str(name),
                    "mean_cwsi":     round(g_mean, 4),
                    "verdict":       g_verdict,
                    "verdict_color": g_color,
                    "faible_pct":    g_faible_pct,
                    "modere_pct":    g_modere_pct,
                    "severe_pct":    g_severe_pct,
                }
                # Centroïde: priorité données réelles, sinon table de référence
                if has_coords:
                    try:
                        lat_vals = grp['latitude'].dropna()
                        lon_vals = grp['longitude'].dropna()
                        if len(lat_vals) > 0:
                            entry["centroid_lat"] = round(float(lat_vals.mean()), 6)
                            entry["centroid_lon"] = round(float(lon_vals.mean()), 6)
                    except Exception:
                        pass
                if "centroid_lat" not in entry and btype == "region":
                    key = _normalise_key(str(name))
                    if key in _REGION_CENTROIDS:
                        entry["centroid_lat"], entry["centroid_lon"] = _REGION_CENTROIDS[key]
                breakdown.append(entry)
            break

    # ── Breakdown par mois (pour le filtre mensuel de la carte) ──────────────
    breakdown_by_month = {}
    if zone_col and 'month' in df_clean.columns and breakdown:
        # Récupérer les centroïdes depuis le breakdown annuel (déjà calculés)
        centroid_map = {
            b['name']: (b.get('centroid_lat'), b.get('centroid_lon'))
            for b in breakdown
        }
        for month_val, month_grp in df_clean.groupby('month'):
            month_bd = []
            for name, grp in month_grp.groupby(zone_col):
                g_cwsi   = grp["cwsi"]
                g_n      = len(grp)
                g_counts = grp["stress_class"].value_counts()
                g_mean   = float(g_cwsi.mean())
                g_severe_pct = round(int(g_counts.get("Sévère", 0)) / g_n * 100, 1)
                g_modere_pct = round(int(g_counts.get("Modéré", 0)) / g_n * 100, 1)
                g_faible_pct = round(int(g_counts.get("Faible", 0)) / g_n * 100, 1)
                if g_severe_pct >= 40:
                    g_verdict, g_color = "⚠️ Stress sévère", "#dc2626"
                elif g_severe_pct + g_modere_pct >= 50:
                    g_verdict, g_color = "⚡ Stress modéré", "#d97706"
                else:
                    g_verdict, g_color = "✅ Faible stress", "#16a34a"
                entry = {
                    "name":          str(name),
                    "mean_cwsi":     round(g_mean, 4),
                    "verdict":       g_verdict,
                    "verdict_color": g_color,
                    "faible_pct":    g_faible_pct,
                    "modere_pct":    g_modere_pct,
                    "severe_pct":    g_severe_pct,
                }
                # Centroïde : réutiliser celui du breakdown annuel
                clat, clon = centroid_map.get(str(name), (None, None))
                if clat is not None:
                    entry["centroid_lat"] = clat
                    entry["centroid_lon"] = clon
                month_bd.append(entry)
            if month_bd:
                breakdown_by_month[int(month_val)] = month_bd

    # ── Données analytics pour le dashboard ─────────────────────────────────
    # 1. Évolution mensuelle de tous les indices
    monthly_indices = []
    if 'month' in df_clean.columns:
        idx_cols = [c for c in REQUIRED_FEATURES + ['cwsi'] if c in df_clean.columns]
        for mv, mg in df_clean.groupby('month'):
            row = {'month': int(mv)}
            for c in idx_cols:
                row[c] = round(float(mg[c].mean()), 4)
            monthly_indices.append(row)
        monthly_indices.sort(key=lambda x: x['month'])

    # 2. Distribution CWSI
    import numpy as np
    bins   = [0, 0.2, 0.4, 0.6, 0.8, 1.01]
    labels = ['0.0–0.2', '0.2–0.4', '0.4–0.6', '0.6–0.8', '0.8–1.0']
    counts, _ = np.histogram(df_clean['cwsi'].dropna(), bins=bins)
    cwsi_distribution = [
        {'range': labels[i], 'count': int(counts[i]),
         'pct': round(int(counts[i]) / n * 100, 1)}
        for i in range(len(labels))
    ]

    # 3. Échantillon pour scatter (max 600 lignes)
    scatter_cols = [c for c in
                    REQUIRED_FEATURES + ['cwsi', 'stress_class', 'latitude', 'longitude']
                    if c in df_clean.columns]
    samp_n  = min(600, len(df_clean))
    step_s  = max(1, len(df_clean) // samp_n)
    scatter_raw = df_clean.iloc[::step_s][scatter_cols].head(samp_n)
    scatter_sample = [
        {k: (round(float(v), 4) if isinstance(v, float) else str(v))
         for k, v in row.items() if v is not None and str(v) != 'nan'}
        for row in scatter_raw.to_dict('records')
    ]

    # 4. Matrice de corrélation
    corr_cols = [c for c in
                 ['NDVI', 'NDWI', 'MSI', 'LST', 'Precipitation', 'SoilMoisture', 'ET0', 'cwsi']
                 if c in df_clean.columns]
    try:
        correlations = df_clean[corr_cols].corr().round(3).to_dict()
    except Exception:
        correlations = {}

    year = None
    if 'year' in df_clean.columns:
        try:
            year = int(df_clean['year'].mode()[0])
        except Exception:
            pass

    return {
        "filename":          file.filename,
        "year":              year,
        "region":            region,
        "analyzed_rows":     n,
        "total_rows":        len(df),
        "mean_cwsi":         round(mean_cwsi, 4),
        "std_cwsi":          round(std_cwsi,  4),
        "faible_pct":        pct(faible_n),
        "modere_pct":        pct(modere_n),
        "severe_pct":        pct(severe_n),
        "verdict":           verdict,
        "verdict_color":     verdict_color,
        "monthly":           monthly,
        "geo_sample":        geo_sample,
        "breakdown":          breakdown,
        "breakdown_by_month": breakdown_by_month,
        "breakdown_type":     breakdown_type,
        "monthly_indices":    monthly_indices,
        "cwsi_distribution":  cwsi_distribution,
        "scatter_sample":     scatter_sample,
        "correlations":       correlations,
        "model_name":         prod.get("model_name", "RandomForest"),
        "model_version":      prod.get("version", "v8"),
        "r2_test":            prod.get("r2_test", 0.973),
        "lst_conversion_applied": lst_conversion,
    }


# ── Download dataset file ─────────────────────────────────────────────────────

@router.get("/{filename}/download")
def download_dataset(
    filename: str,
    current_user: User = Depends(require_roles(["data_engineer", "data_scientist"])),
):
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(404, f"Fichier '{filename}' introuvable.")
    return FileResponse(
        path=file_path,
        media_type="text/csv",
        filename=filename,
    )


# ── Delete dataset file ───────────────────────────────────────────────────────

@router.delete("/{filename}")
def delete_dataset(
    filename: str,
    current_user: User = Depends(require_roles(["data_engineer", "data_scientist"])),
):
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(404, f"Fichier '{filename}' introuvable.")
    os.remove(file_path)
    registry = _load_registry()
    registry.pop(filename, None)
    _save_registry(registry)
    return {"message": f"Fichier '{filename}' supprimé avec succès."}
