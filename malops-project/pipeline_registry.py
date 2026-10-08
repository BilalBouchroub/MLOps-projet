# ============================================================
#  MALOPS - Pipeline Registry & Versioning Modèles (CORRIGÉ v3)
# ============================================================

import os
from clearml import PipelineDecorator, Task

DATA_DIR     = os.path.expanduser('~/malops-project/')
REGISTRY_DIR = os.path.join(DATA_DIR, 'model_registry')


# ─────────────────────────────────────────────────────────────
# ÉTAPE 1 : Évaluation complète de tous les modèles sur test
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.testing,
    return_values=['eval_path']
)
def step_evaluate_all() -> str:
    import os, json, joblib
    import pandas as pd
    import numpy as np
    from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error

    DATA_DIR = os.path.expanduser('~/malops-project/')
    FEATURES = ['NDVI', 'NDWI', 'MSI', 'LST',
                'Precipitation', 'SoilMoisture', 'ET0']
    SEQ_LEN  = 12

    test_df = pd.read_csv(os.path.join(DATA_DIR, 'test.csv'))
    scaler  = joblib.load(os.path.join(DATA_DIR, 'best_scaler.pkl'))
    X_test  = scaler.transform(test_df[FEATURES].values)
    y_test  = test_df['CWSI'].values

    eval_results = {}

    # ─────────────────────────────────────────────────────────
    # CORRECTION PRINCIPALE : détecter le nom du modèle
    # depuis son type Python, pas depuis le nom du fichier
    # ─────────────────────────────────────────────────────────
    def get_model_name(model) -> str:
        class_name = type(model).__name__
        mapping = {
            'RandomForestRegressor'     : 'RandomForest',
            'RandomForestClassifier'    : 'RandomForest',
            'XGBRegressor'              : 'XGBoost',
            'XGBClassifier'             : 'XGBoost',
            'LGBMRegressor'             : 'LightGBM',
            'LGBMClassifier'            : 'LightGBM',
            'AdaBoostRegressor'         : 'AdaBoost',
            'AdaBoostClassifier'        : 'AdaBoost',
            'GradientBoostingRegressor' : 'GradientBoosting',
            'GradientBoostingClassifier': 'GradientBoosting',
            'SVR'                       : 'SVR',
            'LinearRegression'          : 'LinearRegression',
            'Ridge'                     : 'Ridge',
            'Lasso'                     : 'Lasso',
        }
        return mapping.get(class_name, class_name)

    def evaluate_model(model, X, y, name, file_used):
        y_pred = model.predict(X)
        r2   = r2_score(y, y_pred)
        rmse = np.sqrt(mean_squared_error(y, y_pred))
        mae  = mean_absolute_error(y, y_pred)
        print(f"  {name:<20} R²={r2:>8.4f}  RMSE={rmse:>8.4f}  MAE={mae:>8.4f}  ({file_used})")
        return {'r2': round(float(r2), 6),
                'rmse': round(float(rmse), 6),
                'mae': round(float(mae), 6),
                'file': file_used}

    print(f"── Fichiers modèles disponibles ──")
    for fname in sorted(os.listdir(DATA_DIR)):
        fpath = os.path.join(DATA_DIR, fname)
        if (fname.startswith('model_') or fname == 'best_model.pkl') and os.path.isfile(fpath):
            print(f"  {fname:<40} ({os.path.getsize(fpath):,} bytes)")

    print(f"\n── Évaluation test ({len(test_df)} lignes) ──")

    # Cas 1 : fichiers model_{name}.pkl individuels
    model_files = sorted([
        f for f in os.listdir(DATA_DIR)
        if f.startswith('model_') and f.endswith('.pkl')
        and os.path.isfile(os.path.join(DATA_DIR, f))
    ])

    if model_files:
        for fname in model_files:
            fpath = os.path.join(DATA_DIR, fname)
            model = joblib.load(fpath)
            name  = get_model_name(model)
            eval_results[name] = evaluate_model(model, X_test, y_test, name, fname)

    # Cas 2 : seul best_model.pkl existe → on l'évalue directement
    best_path = os.path.join(DATA_DIR, 'best_model.pkl')
    if not eval_results and os.path.exists(best_path):
        model = joblib.load(best_path)
        name  = get_model_name(model)
        print(f"  → Seul best_model.pkl trouvé, type détecté : {type(model).__name__} → '{name}'")
        eval_results[name] = evaluate_model(model, X_test, y_test, name, 'best_model.pkl')

    # Cas 3 : GRU
    gru_dir = os.path.join(DATA_DIR, 'model_GRU')
    if os.path.exists(gru_dir):
        import tensorflow as tf

        def build_sequences(X, y, seq_len):
            Xs, ys = [], []
            for i in range(seq_len, len(X)):
                Xs.append(X[i - seq_len:i])
                ys.append(y[i])
            return np.array(Xs), np.array(ys)

        gru          = tf.keras.models.load_model(gru_dir)
        X_seq, y_seq = build_sequences(X_test, y_test, SEQ_LEN)
        y_pred_gru   = gru.predict(X_seq, verbose=0).flatten()
        r2   = r2_score(y_seq, y_pred_gru)
        rmse = np.sqrt(mean_squared_error(y_seq, y_pred_gru))
        mae  = mean_absolute_error(y_seq, y_pred_gru)
        eval_results['GRU'] = {
            'r2'  : round(float(r2),   6),
            'rmse': round(float(rmse), 6),
            'mae' : round(float(mae),  6),
            'file': 'model_GRU/'
        }
        print(f"  {'GRU':<20} R²={r2:>8.4f}  RMSE={rmse:>8.4f}  MAE={mae:>8.4f}  (model_GRU/)")

    if not eval_results:
        raise RuntimeError("Aucun modèle trouvé dans " + DATA_DIR)

    print(f"\n  {len(eval_results)} modèle(s) évalué(s) : {list(eval_results.keys())}")

    eval_path = os.path.join(DATA_DIR, 'eval_results.json')
    with open(eval_path, 'w') as f:
        json.dump(eval_results, f, indent=2)

    print(f"Résultats → {eval_path}")
    return eval_path


# ─────────────────────────────────────────────────────────────
# ÉTAPE 2 : Champion vs Challenger
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.testing,
    return_values=['cc_path', 'decision', 'best_name', 'best_r2']
)
def step_champion_challenger(eval_path: str):
    import os, json

    DATA_DIR      = os.path.expanduser('~/malops-project/')
    REGISTRY_FILE = os.path.join(DATA_DIR, 'model_registry', 'registry.json')

    with open(eval_path, 'r') as f:
        eval_results = json.load(f)

    if not eval_results:
        raise RuntimeError("eval_results est vide — aucun modèle évalué.")

    challenger_name = max(eval_results, key=lambda x: eval_results[x]['r2'])
    challenger_r2   = eval_results[challenger_name]['r2']

    if os.path.exists(REGISTRY_FILE):
        with open(REGISTRY_FILE, 'r') as f:
            registry = json.load(f)
        prod = registry.get('production')
        if prod:
            champion_name = prod['model_name']
            champion_r2   = prod['r2_test']
            promote       = challenger_r2 >= champion_r2
            print(f"\n── Champion vs Challenger ──")
            print(f"  Champion   : {champion_name:<15} R²={champion_r2:.4f}")
            print(f"  Challenger : {challenger_name:<15} R²={challenger_r2:.4f}")
            print(f"  Gain       : +{(challenger_r2 - champion_r2):.4f}")
        else:
            champion_name, champion_r2, promote = None, None, True
            print(f"\n── Premier déploiement ──")
    else:
        champion_name, champion_r2, promote = None, None, True
        print(f"\n── Registry vide → premier déploiement ──")

    print(f"\n── Classement complet ──")
    print(f"  {'Rang':<5} {'Modèle':<20} {'R²':>8}")
    print(f"  {'-'*36}")
    ranked = sorted(eval_results.items(), key=lambda x: x[1]['r2'], reverse=True)
    for i, (name, scores) in enumerate(ranked, 1):
        marker = ' ← meilleur' if i == 1 else ''
        print(f"  {i:<5} {name:<20} {scores['r2']:>8.4f}{marker}")

    decision = 'PROMOTE' if promote else 'KEEP_CHAMPION'
    print(f"\n  Décision : {decision}")

    cc = {
        'challenger_name': challenger_name,
        'challenger_r2'  : challenger_r2,
        'champion_name'  : champion_name,
        'champion_r2'    : champion_r2,
        'decision'       : decision,
        'all_scores'     : {k: v['r2'] for k, v in eval_results.items()}
    }
    cc_path = os.path.join(DATA_DIR, 'champion_challenger.json')
    with open(cc_path, 'w') as f:
        json.dump(cc, f, indent=2)

    return cc_path, decision, challenger_name, challenger_r2


# ─────────────────────────────────────────────────────────────
# ÉTAPE 3 : Versioning local → registry.json (v1, v2, v3...)
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.custom,
    return_values=['registry_file', 'version']
)
def step_version_model(cc_path: str, decision: str,
                       best_name: str, best_r2: float):
    import os, json, shutil
    from datetime import datetime

    DATA_DIR      = os.path.expanduser('~/malops-project/')
    REGISTRY_DIR  = os.path.join(DATA_DIR, 'model_registry')
    REGISTRY_FILE = os.path.join(REGISTRY_DIR, 'registry.json')
    os.makedirs(REGISTRY_DIR, exist_ok=True)

    if os.path.exists(REGISTRY_FILE):
        with open(REGISTRY_FILE, 'r') as f:
            registry = json.load(f)
    else:
        registry = {'production': None, 'staging': None, 'history': []}

    history   = registry.get('history', [])
    next_ver  = f"v{len(history) + 1}"
    timestamp = datetime.now().isoformat()

    if best_name == 'GRU':
        src_path  = os.path.join(DATA_DIR, 'model_GRU')
        dest_path = os.path.join(REGISTRY_DIR, f'{next_ver}_GRU')
        if os.path.exists(dest_path):
            shutil.rmtree(dest_path)
        shutil.copytree(src_path, dest_path)
    else:
        specific_path = os.path.join(DATA_DIR, f'model_{best_name}.pkl')
        fallback_path = os.path.join(DATA_DIR, 'best_model.pkl')
        src_path  = specific_path if os.path.exists(specific_path) else fallback_path
        dest_path = os.path.join(REGISTRY_DIR, f'{next_ver}_{best_name}.pkl')
        shutil.copy2(src_path, dest_path)

    scaler_src  = os.path.join(DATA_DIR, 'best_scaler.pkl')
    scaler_dest = os.path.join(REGISTRY_DIR, f'{next_ver}_scaler.pkl')
    shutil.copy2(scaler_src, scaler_dest)

    entry = {
        'version'    : next_ver,
        'model_name' : best_name,
        'r2_test'    : best_r2,
        'model_path' : dest_path,
        'scaler_path': scaler_dest,
        'status'     : 'staging',
        'created_at' : timestamp
    }
    registry['history'].append(entry)

    if decision == 'PROMOTE':
        if registry.get('production'):
            old_ver = registry['production']['version']
            for h in registry['history']:
                if h['version'] == old_ver:
                    h['status'] = 'archived'

        prod_link = os.path.join(REGISTRY_DIR, 'production_model')
        if os.path.islink(prod_link) or os.path.exists(prod_link):
            os.remove(prod_link)
        os.symlink(dest_path, prod_link)

        entry['status'] = 'production'
        registry['production'] = {
            'version'    : next_ver,
            'model_name' : best_name,
            'r2_test'    : best_r2,
            'model_path' : dest_path,
            'scaler_path': scaler_dest,
            'promoted_at': timestamp
        }
        registry['staging'] = None

        # Export production_model.json pour pipeline_serving.py
        prod_json_path = os.path.join(DATA_DIR, 'production_model.json')
        with open(prod_json_path, 'w') as f:
            json.dump(registry['production'], f, indent=2)

        print(f"\n  {next_ver} → PRODUCTION ✓")
        print(f"  production_model.json exporté ✓")
    else:
        registry['staging'] = entry
        print(f"\n  {next_ver} → STAGING (champion conservé)")

        # Si un champion existe déjà en production → on s'assure que
        # production_model.json est toujours à jour
        if registry.get('production'):
            prod_json_path = os.path.join(DATA_DIR, 'production_model.json')
            with open(prod_json_path, 'w') as f:
                json.dump(registry['production'], f, indent=2)
            print(f"  production_model.json mis à jour (champion actuel) ✓")

    with open(REGISTRY_FILE, 'w') as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)

    print(f"\n── Historique des versions ──")
    print(f"  {'Version':<6} {'Modèle':<20} {'R²':>8}  Statut")
    print(f"  {'-'*52}")
    for h in registry['history']:
        marker = ' ←' if h['status'] == 'production' else ''
        print(f"  {h['version']:<6} {h['model_name']:<20} {h['r2_test']:>8.4f}  {h['status']}{marker}")

    print(f"\nRegistry → {REGISTRY_FILE}")
    return REGISTRY_FILE, next_ver


# ─────────────────────────────────────────────────────────────
# ÉTAPE 4 : Push ClearML
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.custom,
    return_values=['success']
)
def step_push_clearml(registry_file: str, version: str,
                      best_name: str, best_r2: float, decision: str) -> bool:
    import os, json
    from clearml import Task, OutputModel
    from datetime import datetime

    with open(registry_file, 'r') as f:
        registry = json.load(f)

    entry = next((h for h in registry['history'] if h['version'] == version), None)
    if not entry:
        print("Version introuvable dans le registry")
        return False

    task = Task.current_task()
    if not task:
        print("Pas de tâche ClearML active — skip push")
        return False

    logger = task.get_logger()
    logger.report_scalar('Test Metrics', 'R2',   best_r2,              0)
    logger.report_scalar('Test Metrics', 'RMSE', entry.get('rmse', 0), 0)
    logger.report_scalar('Test Metrics', 'MAE',  entry.get('mae',  0), 0)

    output_model = OutputModel(
        task      = task,
        name      = f'MALOPS_{best_name}_{version}',
        framework = 'TensorFlow' if best_name == 'GRU' else 'scikit-learn',
        tags      = [version, best_name, entry['status'], f"r2_{str(best_r2)[:4]}"]
    )
    output_model.update_weights(entry['model_path'])
    output_model.update_design(config_dict={
        'version'    : version,
        'model_type' : best_name,
        'r2_test'    : best_r2,
        'features'   : ['NDVI', 'NDWI', 'MSI', 'LST',
                        'Precipitation', 'SoilMoisture', 'ET0'],
        'target'     : 'CWSI',
        'status'     : entry['status'],
        'trained_at' : datetime.now().isoformat()
    })

    print(f"\n── ClearML Model Store ──")
    print(f"  Nom  : MALOPS_{best_name}_{version}")
    print(f"  Tags : {version} | {best_name} | {entry['status']}")
    print(f"  R²   : {best_r2:.4f}")
    return True


# ─────────────────────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.pipeline(
    name='Registry Pipeline',
    project='MALOPS',
    version='1.0',
    add_pipeline_tags=True,
    pipeline_execution_queue='default',
)
def registry_pipeline():
    print("═" * 50)
    print("MALOPS — Registry & Versioning Pipeline")
    print("═" * 50)

    eval_path                              = step_evaluate_all()
    cc_path, decision, best_name, best_r2 = step_champion_challenger(eval_path)
    registry_file, version                = step_version_model(cc_path, decision, best_name, best_r2)
    step_push_clearml(registry_file, version, best_name, best_r2, decision)

    print(f"\nRegistry Pipeline terminé !")
    print(f"  Version  : {version}")
    print(f"  Modèle   : {best_name}  R²={float(best_r2):.4f}")
    print(f"  Décision : {decision}")


# ─────────────────────────────────────────────────────────────
# LANCEMENT
# ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    PipelineDecorator.run_locally()
    registry_pipeline()