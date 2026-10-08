# ============================================================
#  MALOPS - Pipeline Validation des Données (VERSION CORRIGÉE)
# ============================================================

import os
from clearml import PipelineDecorator, Task


# ─────────────────────────────────────────────────────────────
# ÉTAPE 1 : Vérification du schéma
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.data_processing,
    return_values=['report_path']
)
def step_check_schema(data_dir: str) -> str:
    import glob, json, os
    import pandas as pd

    FEATURES = ['NDVI', 'NDWI', 'MSI', 'LST', 'Precipitation', 'SoilMoisture', 'ET0']
    REQUIRED_COLS = FEATURES + ['year', 'month', 'latitude', 'longitude']

    csv_files = sorted([
        f for f in glob.glob(os.path.join(data_dir, 'Maroc_ENV_Features_*.csv'))
        if 'Zone.Identifier' not in f
    ])

    print(f"Validation de {len(csv_files)} fichiers CSV...")

    issues, warnings, summary = [], [], {}

    for path in csv_files:
        fname = os.path.basename(path)
        df = pd.read_csv(path)

        # Colonnes manquantes
        missing_cols = [c for c in REQUIRED_COLS if c not in df.columns]
        if missing_cols:
            warnings.append(f"{fname} : colonnes absentes → {missing_cols}")

        # Features disponibles
        available_features = [f for f in FEATURES if f in df.columns]

        if available_features:
            null_rates = df[available_features].isnull().mean()
            high_null = null_rates[null_rates > 0.3].index.tolist()
        else:
            null_rates = pd.Series(dtype=float)
            high_null = []

        if high_null:
            warnings.append(f"{fname} : nulls > 30% → {high_null}")

        # LST check
        if 'LST' in df.columns:
            lst = df['LST'] * 0.1 - 273.15
            out = int(((lst < -10) | (lst > 70)).sum())
            if out > 0:
                warnings.append(f"{fname} : {out} valeurs LST hors plage")

        # NDVI check
        if 'NDVI' in df.columns:
            out = int(((df['NDVI'] < -1) | (df['NDVI'] > 1)).sum())
            if out > 0:
                warnings.append(f"{fname} : {out} valeurs NDVI hors plage")

        summary[fname] = {
            'rows': int(len(df)),
            'null_rate': float(null_rates.mean()) if not null_rates.empty else 0.0
        }

    report_path = os.path.join(data_dir, 'validation_schema.json')

    with open(report_path, 'w') as f:
        json.dump({
            'total_files': len(csv_files),
            'issues': issues,
            'warnings': warnings,
            'per_file': summary
        }, f, indent=2)

    print(f"Erreurs: {len(issues)} | Warnings: {len(warnings)}")

    return report_path


# ─────────────────────────────────────────────────────────────
# ÉTAPE 2 : Statistiques
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.data_processing,
    return_values=['stats_path']
)
def step_compute_stats(schema_report_path: str, data_dir: str) -> str:
    import glob, json, os
    import pandas as pd

    FEATURES = ['NDVI', 'NDWI', 'MSI', 'LST', 'Precipitation', 'SoilMoisture', 'ET0']

    csv_files = sorted([
        f for f in glob.glob(os.path.join(data_dir, 'Maroc_ENV_Features_*.csv'))
        if 'Zone.Identifier' not in f
    ])

    df = pd.concat([pd.read_csv(f) for f in csv_files], ignore_index=True)

    available_features = [f for f in FEATURES if f in df.columns]

    if 'LST' in df.columns:
        df['LST'] = df['LST'] * 0.1 - 273.15
        df = df[(df['LST'] > -10) & (df['LST'] < 70)]

    df = df.dropna(subset=available_features)

    import json as _json
    stats = _json.loads(df[available_features].describe().to_json())

    stats_path = os.path.join(data_dir, 'validation_stats.json')

    with open(stats_path, 'w') as f:
        _json.dump(stats, f, indent=2)

    print(f"Stats calculées sur {len(df)} lignes")

    return stats_path


# ─────────────────────────────────────────────────────────────
# ÉTAPE 3 : Drift
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.data_processing,
    return_values=['drift_path']
)
def step_detect_drift(stats_path: str, data_dir: str) -> str:
    import glob, json, os
    import pandas as pd
    import numpy as np
    from scipy import stats as scipy_stats

    # ── Chargement config persistante ────────────────────────
    _cfg_path = os.path.join(data_dir, 'pipeline_config.json')
    _cfg = {}
    if os.path.exists(_cfg_path):
        with open(_cfg_path) as _f:
            _cfg = json.load(_f).get('validation', {})
    PSI_THRESHOLD = float(_cfg.get('psi_threshold', 0.2))
    KS_PVALUE     = float(_cfg.get('ks_pvalue', 0.05))

    FEATURES = ['NDVI', 'NDWI', 'MSI', 'LST', 'Precipitation', 'SoilMoisture', 'ET0']

    csv_files = sorted([
        f for f in glob.glob(os.path.join(data_dir, 'Maroc_ENV_Features_*.csv'))
        if 'Zone.Identifier' not in f
    ])

    df = pd.concat([pd.read_csv(f) for f in csv_files], ignore_index=True)

    available_features = [f for f in FEATURES if f in df.columns]

    if 'LST' in df.columns:
        df['LST'] = df['LST'] * 0.1 - 273.15
        df = df[(df['LST'] > -10) & (df['LST'] < 70)]

    df = df.dropna(subset=available_features)
    df['year'] = df['year'].astype(int)

    ref = df[df['year'] <= 2019]
    new = df[df['year'] >= 2020]

    def psi(a, b):
        bins = np.percentile(a, np.linspace(0, 100, 11))
        bins[0] -= 1e-6
        bins[-1] += 1e-6
        pa = np.histogram(a, bins)[0] / len(a)
        pb = np.histogram(b, bins)[0] / len(b)
        pa = np.where(pa == 0, 1e-6, pa)
        pb = np.where(pb == 0, 1e-6, pb)
        return float(np.sum((pb - pa) * np.log(pb / pa)))

    results = {}

    for f in available_features:
        p = psi(ref[f], new[f])
        ks = scipy_stats.ks_2samp(ref[f], new[f])

        results[f] = {
            'psi': float(p),
            'ks_pval': float(ks.pvalue),
            'drift': bool(p > PSI_THRESHOLD or ks.pvalue < KS_PVALUE)
        }

    path = os.path.join(data_dir, 'validation_drift.json')

    with open(path, 'w') as f:
        json.dump(results, f, indent=2)

    return path


# ─────────────────────────────────────────────────────────────
# ÉTAPE 4 : Rapport
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.data_processing,
    return_values=['report_path']
)
def step_generate_report(schema: str, stats: str, drift: str, data_dir: str) -> str:
    import os

    report_path = os.path.join(data_dir, 'report.txt')

    with open(report_path, 'w') as f:
        f.write("=" * 50 + "\n")
        f.write("   MALOPS - RAPPORT DE VALIDATION\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Schema rapport : {schema}\n")
        f.write(f"Stats rapport  : {stats}\n")
        f.write(f"Drift rapport  : {drift}\n")
        f.write("\nValidation terminée avec succès.\n")

    print(f"Rapport généré : {report_path}")

    return report_path


# ─────────────────────────────────────────────────────────────
# PIPELINE
# CORRECTION CLÉ : Task.init() DOIT être dans le pipeline,
# PAS avant PipelineDecorator.run_locally()
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.pipeline(
    name='Validation Pipeline',
    project='MALOPS',
    version='1.0',
    # Ces paramètres forcent l'enregistrement dans ClearML
    add_pipeline_tags=True,
    pipeline_execution_queue='default',
)
def validation_pipeline():
    import json as _json
    from datetime import datetime as _dt

    data_dir = os.path.expanduser('~/malops-project/')

    s  = step_check_schema(data_dir)
    st = step_compute_stats(s, data_dir)
    d  = step_detect_drift(st, data_dir)
    r  = step_generate_report(s, st, d, data_dir)

    # Écriture des métadonnées de run pour l'UI temps réel
    meta = {
        "run_at":      _dt.now().isoformat(),
        "status":      "completed",
        "pipeline":    "Validation Pipeline",
        "version":     "1.0",
        "output":      str(r),
    }
    meta_path = os.path.join(data_dir, 'validation_run_meta.json')
    with open(meta_path, 'w') as _f:
        _json.dump(meta, _f, indent=2)

    print("Pipeline terminé :", r)


# ─────────────────────────────────────────────────────────────
# RUN
# CORRECTION CLÉ : l'ordre correct est :
#   1. PipelineDecorator.run_locally()   ← EN PREMIER
#   2. validation_pipeline()             ← appel du pipeline
# Task.init() est géré automatiquement par ClearML
# ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    PipelineDecorator.run_locally()   # ← DOIT être avant l'appel du pipeline
    validation_pipeline()