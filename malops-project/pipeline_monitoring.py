# ============================================================
#  MALOPS - Pipeline Monitoring
#  Étapes : Collect logs → Drift données → Drift modèle → Alerte
#  Commande : python3 pipeline_monitoring.py
# ============================================================

import os
from clearml import PipelineDecorator, Task

DATA_DIR = os.path.expanduser('~/malops-project/')


# ─────────────────────────────────────────────────────────────
# ÉTAPE 1 : Collecte des prédictions loggées par l'API
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.data_processing
)
def step_collect_predictions():
    import os, json
    import pandas as pd
    import numpy as np
    from datetime import datetime

    DATA_DIR  = os.path.expanduser('~/malops-project/')
    SERVE_DIR = os.path.join(DATA_DIR, 'serving')
    LOG_PATH  = os.path.join(SERVE_DIR, 'prediction_logs.jsonl')

    if not os.path.exists(LOG_PATH):
        # Simulation de logs si le fichier n'existe pas encore
        print("Aucun log trouvé — génération de données simulées pour le monitoring...")
        os.makedirs(SERVE_DIR, exist_ok=True)
        np.random.seed(42)
        n = 500
        logs = []
        for i in range(n):
            logs.append({
                'timestamp'  : datetime.now().isoformat(),
                'NDVI'       : float(np.random.uniform(0.1, 0.7)),
                'NDWI'       : float(np.random.uniform(-0.2, 0.3)),
                'MSI'        : float(np.random.uniform(0.2, 1.5)),
                'LST'        : float(np.random.uniform(20, 45)),
                'Precipitation': float(np.random.uniform(0, 50)),
                'SoilMoisture' : float(np.random.uniform(0.05, 0.4)),
                'ET0'          : float(np.random.uniform(2, 8)),
                'cwsi_pred'  : float(np.random.uniform(0, 1)),
                'stress_class': 'Stress modéré'
            })
        with open(LOG_PATH, 'w') as f:
            for log in logs:
                f.write(json.dumps(log) + '\n')
        print(f"  {n} prédictions simulées générées")

    # Lecture des logs
    records = []
    with open(LOG_PATH, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))

    df = pd.DataFrame(records)
    print(f"Prédictions collectées : {len(df)} entrées")
    print(f"  Période : {df['timestamp'].min()[:10]} → {df['timestamp'].max()[:10]}")

    dist = df['stress_class'].value_counts()
    print(f"\n── Distribution stress (prédictions) ──")
    for label, count in dist.items():
        print(f"  {label:<20} : {count:>5} ({count/len(df)*100:.1f}%)")

    preds_path = os.path.join(DATA_DIR, 'monitoring_predictions.csv')
    df.to_csv(preds_path, index=False)
    return preds_path


# ─────────────────────────────────────────────────────────────
# ÉTAPE 2 : Détection de drift sur les données d'entrée
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.data_processing
)
def step_detect_input_drift(preds_path: str):
    import os, glob, json
    import pandas as pd
    import numpy as np
    from scipy import stats as scipy_stats

    DATA_DIR = os.path.expanduser('~/malops-project/')
    FEATURES = ['NDVI', 'NDWI', 'MSI', 'LST', 'Precipitation', 'SoilMoisture', 'ET0']
    PSI_THRESHOLD = 0.2

    # Données de référence (train)
    train_df = pd.read_csv(os.path.join(DATA_DIR, 'train.csv'))
    live_df  = pd.read_csv(preds_path)

    # Garde seulement les features communes
    feat_ref  = [f for f in FEATURES if f in train_df.columns]
    feat_live = [f for f in FEATURES if f in live_df.columns]
    feats     = [f for f in feat_ref if f in feat_live]

    def compute_psi(ref, new, n_bins=10):
        bins    = np.percentile(ref, np.linspace(0, 100, n_bins + 1))
        bins[0] -= 1e-6; bins[-1] += 1e-6
        ref_pct = np.histogram(ref, bins=bins)[0] / len(ref)
        new_pct = np.histogram(new, bins=bins)[0] / len(new)
        ref_pct = np.where(ref_pct == 0, 1e-6, ref_pct)
        new_pct = np.where(new_pct == 0, 1e-6, new_pct)
        return float(np.sum((new_pct - ref_pct) * np.log(new_pct / ref_pct)))

    drift_results = {}
    drifted       = []

    print(f"\n── Drift données d'entrée (train vs live) ──")
    print(f"  {'Feature':<15} {'PSI':>8}  {'KS-p':>8}  Statut")
    print(f"  {'-'*45}")

    for feat in feats:
        ref_vals = train_df[feat].dropna().values
        new_vals = live_df[feat].dropna().values
        if len(new_vals) < 10:
            continue
        psi              = compute_psi(ref_vals, new_vals)
        _, ks_pval       = scipy_stats.ks_2samp(ref_vals, new_vals)
        has_drift        = bool(psi > PSI_THRESHOLD or ks_pval < 0.05)  # ← cast explicite
        if has_drift:
            drifted.append(feat)
        status = "DRIFT" if has_drift else "OK"
        print(f"  {feat:<15} {psi:>8.4f}  {ks_pval:>8.4f}  {status}")
        drift_results[feat] = {
            'psi'      : round(psi, 6),
            'ks_pval'  : round(float(ks_pval), 6),
            'has_drift': bool(has_drift)  # ← cast explicite
        }

    result = {
        'drifted_features' : drifted,
        'drift_results'    : drift_results,
        'n_live_samples'   : len(live_df)
    }
    out_path = os.path.join(DATA_DIR, 'monitoring_input_drift.json')
    with open(out_path, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"\n  Features en drift : {drifted if drifted else 'Aucune'}")
    return out_path


# ─────────────────────────────────────────────────────────────
# ÉTAPE 3 : Détection de drift du modèle (concept drift)
#   Compare la distribution CWSI prédit vs CWSI historique
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.data_processing
)
def step_detect_model_drift(preds_path: str):
    import os, json
    import pandas as pd
    import numpy as np
    from scipy import stats as scipy_stats

    DATA_DIR = os.path.expanduser('~/malops-project/')

    test_df = pd.read_csv(os.path.join(DATA_DIR, 'test.csv'))
    live_df = pd.read_csv(preds_path)

    ref_cwsi  = test_df['CWSI'].dropna().values
    live_cwsi = live_df['cwsi_pred'].dropna().values if 'cwsi_pred' in live_df.columns else np.array([])

    if len(live_cwsi) < 10:
        print("Pas assez de prédictions live pour détecter le drift modèle")
        out = {'model_drift': False, 'reason': 'Pas assez de données'}
        out_path = os.path.join(DATA_DIR, 'monitoring_model_drift.json')
        with open(out_path, 'w') as f:
            json.dump(out, f)
        return out_path

    # Test KS entre distribution CWSI référence et live
    ks_stat, ks_pval = scipy_stats.ks_2samp(ref_cwsi, live_cwsi)
    ref_mean   = float(ref_cwsi.mean())
    live_mean  = float(live_cwsi.mean())
    mean_shift = abs(live_mean - ref_mean)

    # ── FIX : cast explicite en bool Python natif ──────────────────────────
    # ks_pval < 0.05 et mean_shift > 0.1 retournent numpy.bool_ qui n'est
    # pas sérialisable par json.dump → on force bool()
    model_drift = bool((ks_pval < 0.05) or (mean_shift > 0.1))
    # ───────────────────────────────────────────────────────────────────────

    # Distribution classes stress live
    def classify(cwsi):
        if cwsi < 0.2:   return 'Pas de stress'
        elif cwsi < 0.4: return 'Stress léger'
        elif cwsi < 0.6: return 'Stress modéré'
        elif cwsi < 0.8: return 'Stress sévère'
        else:            return 'Stress extrême'

    live_classes = pd.Series(live_cwsi).apply(classify).value_counts().to_dict()

    print(f"\n── Drift modèle (concept drift) ──")
    print(f"  CWSI moyen référence : {ref_mean:.4f}")
    print(f"  CWSI moyen live      : {live_mean:.4f}")
    print(f"  Shift                : {mean_shift:.4f}")
    print(f"  KS-pval              : {ks_pval:.4f}")
    print(f"  Drift modèle         : {'OUI' if model_drift else 'NON'}")
    print(f"\n── Distribution stress (live) ──")
    for label, cnt in live_classes.items():
        print(f"  {label:<20} : {cnt:>5}")

    result = {
        'model_drift'      : model_drift,           # bool Python natif
        'ref_cwsi_mean'    : round(ref_mean, 6),
        'live_cwsi_mean'   : round(live_mean, 6),
        'mean_shift'       : round(mean_shift, 6),
        'ks_stat'          : round(float(ks_stat), 6),
        'ks_pval'          : round(float(ks_pval), 6),
        'live_stress_dist' : live_classes
    }
    out_path = os.path.join(DATA_DIR, 'monitoring_model_drift.json')
    with open(out_path, 'w') as f:
        json.dump(result, f, indent=2)

    return out_path


# ─────────────────────────────────────────────────────────────
# ÉTAPE 4 : Alerte et déclenchement retraining si nécessaire
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.custom
)
def step_alert_and_retrain(input_drift_path: str, model_drift_path: str):
    import os, json, subprocess
    from datetime import datetime

    DATA_DIR = os.path.expanduser('~/malops-project/')

    with open(input_drift_path,  'r') as f: input_drift  = json.load(f)
    with open(model_drift_path,  'r') as f: model_drift  = json.load(f)

    n_input_drift   = len(input_drift.get('drifted_features', []))
    has_model_drift = bool(model_drift.get('model_drift', False))  # ← cast défensif

    # Décision de retraining
    should_retrain = bool((n_input_drift >= 3) or has_model_drift)

    status_lines = [
        f"── Rapport Monitoring MALOPS ──",
        f"  Date           : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"  Drift features : {n_input_drift} feature(s) → {input_drift.get('drifted_features', [])}",
        f"  Drift modèle   : {'OUI' if has_model_drift else 'NON'}",
        f"  CWSI shift     : {model_drift.get('mean_shift', 0):.4f}",
        f"  Retraining     : {'DÉCLENCHÉ' if should_retrain else 'Non nécessaire'}",
    ]

    for line in status_lines:
        print(line)

    # Rapport JSON
    report = {
        'timestamp'        : datetime.now().isoformat(),
        'input_drift'      : input_drift,
        'model_drift'      : model_drift,
        'should_retrain'   : should_retrain,
        'retrain_triggered': False
    }

    if should_retrain:
        print(f"\n  → Déclenchement automatique du pipeline training...")
        pipeline_script = os.path.expanduser('~/malops-project/pipeline_training.py')
        if os.path.exists(pipeline_script):
            subprocess.Popen(['python3', pipeline_script])
            report['retrain_triggered'] = True
            print(f"  → Training pipeline lancé en arrière-plan")
        else:
            print(f"  → pipeline_training.py introuvable — déclenchement manuel requis")
            print(f"     Commande : python3 ~/malops-project/pipeline_training.py")

    # Rapport final
    report_path = os.path.join(DATA_DIR, 'monitoring_report.json')
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\nRapport monitoring → {report_path}")
    return report_path, should_retrain


# ─────────────────────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.pipeline(
    name='Monitoring Pipeline',
    project='MALOPS',
    version='1.0'
)
def monitoring_pipeline():
    print("═" * 50)
    print("MALOPS — Monitoring Pipeline démarré")
    print("═" * 50)

    preds_path        = step_collect_predictions()
    input_drift_path  = step_detect_input_drift(preds_path)
    model_drift_path  = step_detect_model_drift(preds_path)
    report_path, retrain = step_alert_and_retrain(input_drift_path, model_drift_path)

    print(f"\nMonitoring terminé !")
    print(f"Retraining déclenché : {'OUI' if retrain else 'NON'}")
    print("Ouvre http://localhost:8080/pipelines pour voir le graphe !")


# ─────────────────────────────────────────────────────────────
# LANCEMENT
# ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    PipelineDecorator.run_locally()
    monitoring_pipeline()