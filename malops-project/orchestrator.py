# ============================================================
#  MALOPS - Orchestrateur Principal
#  Lance tous les pipelines dans l'ordre MLOps complet
#  Commande : python3 orchestrator.py [--mode full|train|monitor|dataset|predict|custom]
# ============================================================

import os
import sys
import json
import argparse
import subprocess
from datetime import datetime
from clearml import PipelineDecorator, Task   # ← ajout

DATA_DIR     = os.path.expanduser('~/malops-project/')
PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))

PIPELINES = {
    'dataset'    : 'pipeline_dataset.py',
    'validation' : 'pipeline_validation.py',
    'training'   : 'pipeline_training.py',
    'registry'   : 'pipeline_registry.py',
    'serving'    : 'pipeline_serving.py',
    'monitoring' : 'pipeline_monitoring.py',
    'predict'    : 'predict.py',
}


def banner(title: str):
    width = 54
    print("\n" + "═" * width)
    print(f"  {title}")
    print("═" * width)


def run_pipeline(name: str, script: str) -> bool:
    """Lance un pipeline et retourne True si succès."""
    path = os.path.join(PIPELINE_DIR, script)
    if not os.path.exists(path):
        print(f"  [ERREUR] Fichier introuvable : {path}")
        return False

    print(f"\n→ Lancement : {name.upper()}")
    start = datetime.now()
    result = subprocess.run(
        [sys.executable, path],
        capture_output=False,
        text=True
    )
    elapsed = (datetime.now() - start).total_seconds()

    if result.returncode == 0:
        print(f"✓ {name} terminé en {elapsed:.1f}s")
        return True
    else:
        print(f"✗ {name} ÉCHOUÉ (code {result.returncode}) après {elapsed:.1f}s")
        return False


def log_run(results: dict):
    """Sauvegarde le résumé d'exécution."""
    log_path = os.path.join(DATA_DIR, 'orchestrator_log.json')
    logs = []
    if os.path.exists(log_path):
        with open(log_path, 'r') as f:
            logs = json.load(f)
    logs.append({
        'timestamp': datetime.now().isoformat(),
        'results'  : results
    })
    with open(log_path, 'w') as f:
        json.dump(logs[-50:], f, indent=2)
    print(f"\nLog → {log_path}")


# ─────────────────────────────────────────────────────────────
# MODES D'EXÉCUTION (logique originale inchangée)
# ─────────────────────────────────────────────────────────────

def mode_full():
    banner("MALOPS — Run complet MLOps")
    results = {}
    sequence = ['dataset', 'validation', 'training', 'registry', 'serving', 'monitoring', 'predict']
    for name in sequence:
        ok = run_pipeline(name, PIPELINES[name])
        results[name] = 'OK' if ok else 'FAILED'
        if not ok and name in ('dataset', 'validation', 'training'):
            print(f"\n[STOP] Étape critique {name} échouée — arrêt de l'orchestration")
            break
    return results


def mode_train():
    banner("MALOPS — Run Training & Déploiement")
    results = {}
    sequence = ['dataset', 'validation', 'training', 'registry', 'serving', 'predict']
    for name in sequence:
        ok = run_pipeline(name, PIPELINES[name])
        results[name] = 'OK' if ok else 'FAILED'
        if not ok and name in ('dataset', 'validation', 'training'):
            print(f"\n[STOP] Étape critique {name} échouée")
            break
    return results


def mode_monitor():
    banner("MALOPS — Run Monitoring")
    ok = run_pipeline('monitoring', PIPELINES['monitoring'])
    return {'monitoring': 'OK' if ok else 'FAILED'}


def mode_dataset():
    banner("MALOPS — Run Dataset Versioning")
    ok = run_pipeline('dataset', PIPELINES['dataset'])
    return {'dataset': 'OK' if ok else 'FAILED'}


def mode_predict():
    banner("MALOPS — Run Prédiction CWSI")
    ok = run_pipeline('predict', PIPELINES['predict'])
    return {'predict': 'OK' if ok else 'FAILED'}


def mode_custom(steps: list):
    banner(f"MALOPS — Run personnalisé : {', '.join(steps)}")
    results = {}
    for name in steps:
        if name not in PIPELINES:
            print(f"  [WARN] Pipeline inconnu : {name} — ignoré")
            continue
        ok = run_pipeline(name, PIPELINES[name])
        results[name] = 'OK' if ok else 'FAILED'
    return results


# ─────────────────────────────────────────────────────────────
# ÉTAPES CLEARML — chaque mode devient une étape visible
# ─────────────────────────────────────────────────────────────

@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.data_processing
)
def clearml_step_dataset() -> str:
    import os, sys, subprocess
    PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(PIPELINE_DIR, 'pipeline_dataset.py')
    r = subprocess.run([sys.executable, path], text=True)
    return 'OK' if r.returncode == 0 else 'FAILED'


@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.data_processing
)
def clearml_step_validation() -> str:
    import os, sys, subprocess
    PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(PIPELINE_DIR, 'pipeline_validation.py')
    r = subprocess.run([sys.executable, path], text=True)
    return 'OK' if r.returncode == 0 else 'FAILED'


@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.training
)
def clearml_step_training() -> str:
    import os, sys, subprocess
    PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(PIPELINE_DIR, 'pipeline_training.py')
    r = subprocess.run([sys.executable, path], text=True)
    return 'OK' if r.returncode == 0 else 'FAILED'


@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.testing
)
def clearml_step_registry() -> str:
    import os, sys, subprocess
    PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(PIPELINE_DIR, 'pipeline_registry.py')
    r = subprocess.run([sys.executable, path], text=True)
    return 'OK' if r.returncode == 0 else 'FAILED'


@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.custom
)
def clearml_step_serving() -> str:
    import os, sys, subprocess
    PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(PIPELINE_DIR, 'pipeline_serving.py')
    r = subprocess.run([sys.executable, path], text=True)
    return 'OK' if r.returncode == 0 else 'FAILED'


@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.monitor
)
def clearml_step_monitoring() -> str:
    import os, sys, subprocess
    PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(PIPELINE_DIR, 'pipeline_monitoring.py')
    r = subprocess.run([sys.executable, path], text=True)
    return 'OK' if r.returncode == 0 else 'FAILED'


@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.inference
)
def clearml_step_predict() -> str:
    import os, sys, subprocess
    PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(PIPELINE_DIR, 'predict.py')
    r = subprocess.run([sys.executable, path], text=True)
    return 'OK' if r.returncode == 0 else 'FAILED'


# ─────────────────────────────────────────────────────────────
# PIPELINE CLEARML PRINCIPAL — visible dans localhost:8080/pipelines
# ─────────────────────────────────────────────────────────────

@PipelineDecorator.pipeline(
    name='MALOPS Orchestrator',
    project='MALOPS',
    version='1.0',
    add_pipeline_tags=True,
    pipeline_execution_queue='default',
)
def orchestrator_pipeline(mode: str = 'full', steps: list = None):
    print(f"\n══ MALOPS Orchestrator — mode={mode} ══")

    if mode == 'full':
        s1 = clearml_step_dataset();    print(f"dataset    → {s1}")
        if s1 == 'FAILED': return
        s2 = clearml_step_validation(); print(f"validation → {s2}")
        if s2 == 'FAILED': return
        s3 = clearml_step_training();   print(f"training   → {s3}")
        if s3 == 'FAILED': return
        clearml_step_registry();   print("registry   → done")
        clearml_step_serving();    print("serving    → done")
        clearml_step_monitoring(); print("monitoring → done")
        clearml_step_predict();    print("predict    → done")

    elif mode == 'train':
        s1 = clearml_step_dataset();    print(f"dataset    → {s1}")
        if s1 == 'FAILED': return
        s2 = clearml_step_validation(); print(f"validation → {s2}")
        if s2 == 'FAILED': return
        s3 = clearml_step_training();   print(f"training   → {s3}")
        if s3 == 'FAILED': return
        clearml_step_registry(); print("registry → done")
        clearml_step_serving();  print("serving  → done")
        clearml_step_predict();  print("predict  → done")

    elif mode == 'monitor':
        clearml_step_monitoring(); print("monitoring → done")

    elif mode == 'dataset':
        clearml_step_dataset(); print("dataset → done")

    elif mode == 'predict':
        clearml_step_predict(); print("predict → done")


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description='MALOPS — Orchestrateur MLOps',
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument(
        '--mode', default='full',
        choices=['full', 'train', 'monitor', 'dataset', 'predict', 'custom'],
        help=(
            "full    : Dataset → Validation → Training → Registry → Serving → Monitoring → Predict\n"
            "train   : Dataset → Validation → Training → Registry → Serving → Predict\n"
            "monitor : Monitoring uniquement (cron)\n"
            "dataset : Dataset versioning uniquement\n"
            "predict : Prédiction CWSI uniquement\n"
            "custom  : Utilise --steps pour choisir"
        )
    )
    parser.add_argument(
        '--steps', nargs='+',
        choices=list(PIPELINES.keys()),
        help='Pipelines à exécuter (mode custom uniquement)'
    )
    args = parser.parse_args()

    banner("MALOPS MLOps Platform")
    print(f"Mode      : {args.mode}")
    print(f"Démarré   : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Data dir  : {DATA_DIR}")
    print(f"ClearML   : http://localhost:8080")

    # ── Exécution locale (logique originale) ──────────────────
    if args.mode == 'full':
        results = mode_full()
    elif args.mode == 'train':
        results = mode_train()
    elif args.mode == 'monitor':
        results = mode_monitor()
    elif args.mode == 'dataset':
        results = mode_dataset()
    elif args.mode == 'predict':
        results = mode_predict()
    elif args.mode == 'custom':
        if not args.steps:
            parser.error("--steps requis avec --mode custom")
        results = mode_custom(args.steps)

    # Résumé final
    banner("Résumé d'exécution")
    all_ok = all(v == 'OK' for v in results.values())
    for name, status in results.items():
        icon = "✓" if status == 'OK' else "✗"
        print(f"  {icon} {name:<15} {status}")

    log_run(results)

    print(f"\nStatut global : {'SUCCÈS' if all_ok else 'ÉCHEC PARTIEL'}")
    print(f"Terminé       : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"\nDashboard ClearML  → http://localhost:8080")
    print(f"API FastAPI        → http://localhost:8000/docs")

    # ── Enregistrement dans ClearML Pipelines ─────────────────
    PipelineDecorator.run_locally()
    orchestrator_pipeline(mode=args.mode)

    sys.exit(0 if all_ok else 1)


if __name__ == '__main__':
    main()