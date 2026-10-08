# ============================================================
#  MALOPS - Pipeline Versioning Données (ClearML + Agent)
#  Commande : python3 pipeline_dataset.py
# ============================================================

import os
import sys

DATA_DIR      = os.path.expanduser('~/malops-project/')
REGISTRY_FILE = os.path.join(DATA_DIR, 'model_registry', 'registry.json')


# ─────────────────────────────────────────────────────────────
# ÉTAPE 1 : Scan et validation des CSV disponibles
# ─────────────────────────────────────────────────────────────
def step_scan_csv():
    import glob, json, re
    import pandas as pd

    cfg_path = os.path.join(DATA_DIR, 'pipeline_config.json')
    cfg = {}
    if os.path.exists(cfg_path):
        with open(cfg_path) as f:
            cfg = json.load(f).get('dataset', {})

    START_YEAR     = int(cfg.get('start_year', 1900))
    END_YEAR       = int(cfg.get('end_year', 2100))
    NULL_THRESHOLD = float(cfg.get('nulls_max', 30)) / 100
    MIN_ROWS       = int(cfg.get('min_rows', 0))
    FEATURES       = ['NDVI', 'NDWI', 'MSI', 'LST', 'Precipitation', 'SoilMoisture', 'ET0']

    # Tous les CSV enregistrés
    registry_path = os.path.join(DATA_DIR, 'dataset_registry.json')
    registered = {}
    if os.path.exists(registry_path):
        with open(registry_path) as f:
            registered = json.load(f)

    # + les Maroc_ENV_Features_*.csv classiques
    for path in glob.glob(os.path.join(DATA_DIR, 'Maroc_ENV_Features_*.csv')):
        fname = os.path.basename(path)
        if 'Zone.Identifier' not in fname and fname not in registered:
            registered[fname] = {}

    def year_from_name(name):
        m = re.search(r'((?:19|20)\d{2})', name)
        return int(m.group(1)) if m else 0

    csv_files = sorted([
        os.path.join(DATA_DIR, fname)
        for fname in registered
        if START_YEAR <= year_from_name(fname) <= END_YEAR
        and os.path.isfile(os.path.join(DATA_DIR, fname))
    ])

    print(f"── Étape 1 : Scan des CSV ──")
    print(f"  Filtre {START_YEAR}–{END_YEAR} → {len(csv_files)} fichiers")

    summary, total_rows = [], 0
    for path in csv_files:
        fname = os.path.basename(path)
        try:
            df = pd.read_csv(path)
            rows = len(df)
            total_rows += rows
            null_rate = df[FEATURES].isnull().mean().mean() if all(
                c in df.columns for c in FEATURES) else -1
            size_kb = os.path.getsize(path) // 1024
            flags = []
            if null_rate > NULL_THRESHOLD: flags.append(f'nulls>{NULL_THRESHOLD:.0%}')
            if rows < MIN_ROWS:           flags.append(f'rows<{MIN_ROWS}')
            flag_str = f'  ⚠ {", ".join(flags)}' if flags else ''
            print(f"  {fname} → {rows:>6} lignes | {size_kb:>5} KB | nulls={null_rate:.2%}{flag_str}")
            summary.append({
                'filename': fname, 'year': str(year_from_name(fname) or '?'),
                'rows': rows, 'size_kb': size_kb,
                'null_rate': round(float(null_rate), 4), 'flags': flags,
                'region': registered.get(fname, {}).get('region'),
            })
        except Exception as e:
            print(f"  ⚠ {fname} — {e}")

    years = [s['year'] for s in summary if s['year'] != '?']
    scan_result = {
        'total_files': len(summary), 'total_rows': total_rows,
        'years': years,
        'year_range': f"{min(years)}–{max(years)}" if years else '—',
        'files': summary,
    }
    scan_path = os.path.join(DATA_DIR, 'dataset_scan.json')
    with open(scan_path, 'w') as f:
        json.dump(scan_result, f, indent=2)

    print(f"\n  Total : {total_rows:,} lignes | {len(summary)} fichiers")
    print(f"  ✅ Scan → {scan_path}")
    return scan_path


# ─────────────────────────────────────────────────────────────
# ÉTAPE 2 : Hash MD5
# ─────────────────────────────────────────────────────────────
def step_compute_hashes(scan_path: str):
    import hashlib, json

    with open(scan_path) as f:
        scan = json.load(f)

    print(f"\n── Étape 2 : Hash MD5 ──")
    hashes = {}
    for entry in scan['files']:
        path = os.path.join(DATA_DIR, entry['filename'])
        if not os.path.isfile(path): continue
        md5 = hashlib.md5()
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                md5.update(chunk)
        hashes[entry['filename']] = md5.hexdigest()
        print(f"  {entry['filename']} → {hashes[entry['filename']][:12]}…")

    hash_file = os.path.join(DATA_DIR, 'dataset_hashes.json')
    prev = {}
    if os.path.exists(hash_file):
        with open(hash_file) as f:
            prev = json.load(f).get('hashes', {})

    changed  = [k for k, v in hashes.items() if prev.get(k) != v]
    new_ones = [k for k in hashes if k not in prev]
    print(f"\n  Modifiés : {len(changed)} | Nouveaux : {len(new_ones)}")

    result = {'hashes': hashes, 'changed_files': changed, 'total_files': len(hashes)}
    with open(hash_file, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"  ✅ Hash → {hash_file}")
    return hash_file


# ─────────────────────────────────────────────────────────────
# ÉTAPE 3 : Création version ClearML Dataset
# ─────────────────────────────────────────────────────────────
def step_create_dataset_version(scan_path: str, hash_file: str):
    import json
    from datetime import datetime

    with open(scan_path) as f:  scan   = json.load(f)
    with open(hash_file)  as f: hashes = json.load(f)

    ds_version_file = os.path.join(DATA_DIR, 'dataset_version.json')
    if os.path.exists(ds_version_file):
        with open(ds_version_file) as f:
            ds_meta = json.load(f)
        major, minor = map(int, ds_meta.get('current_version', '1.0').split('.'))
        new_files    = [k for k in hashes['hashes'] if k not in ds_meta.get('files', {})]
        new_version  = f"{major+1}.0" if new_files else f"{major}.{minor+1}"
        parent_id    = ds_meta.get('clearml_dataset_id')
    else:
        new_version, parent_id, ds_meta = "1.0", None, {}

    print(f"\n── Étape 3 : ClearML Dataset v{new_version} ──")

    # Tentative ClearML Dataset (si serveur dispo)
    dataset_id = None
    try:
        from clearml import Dataset
        kwargs = dict(
            dataset_name    = 'MALOPS_Hydric_Stress_Dataset',
            dataset_project = 'MALOPS',
            dataset_version = new_version,
            description     = f"MALOPS v{new_version} — {scan['year_range']} — {scan['total_files']} CSV — {scan['total_rows']:,} lignes",
        )
        if parent_id:
            kwargs['parent_datasets'] = [parent_id]
        dataset = Dataset.create(**kwargs)

        for entry in scan['files']:
            path = os.path.join(DATA_DIR, entry['filename'])
            if os.path.isfile(path):
                dataset.add_files(path=path, dataset_path='csv/')
                print(f"  + {entry['filename']}")

        dataset.add_tags([f"v{new_version}", scan['year_range'], 'CWSI', 'Maroc'])
        dataset.finalize(auto_upload=True)
        dataset_id = dataset.id
        print(f"  ✅ ClearML Dataset ID : {dataset_id}")
    except Exception as e:
        dataset_id = f"local-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        print(f"  ⚠ ClearML Dataset non disponible ({e}) — ID local : {dataset_id}")

    ds_meta_new = {
        'current_version':    new_version,
        'clearml_dataset_id': dataset_id,
        'year_range':         scan['year_range'],
        'total_files':        scan['total_files'],
        'total_rows':         scan['total_rows'],
        'created_at':         datetime.now().isoformat(),
        'files':              hashes['hashes'],
        'file_details':       scan['files'],
    }
    with open(ds_version_file, 'w') as f:
        json.dump(ds_meta_new, f, indent=2)
    print(f"  ✅ Version → {ds_version_file}")
    return dataset_id, new_version


# ─────────────────────────────────────────────────────────────
# ÉTAPE 4 : Lien dataset ↔ modèle
# ─────────────────────────────────────────────────────────────
def step_link_dataset_to_model(dataset_id: str, dataset_version: str):
    import json
    from datetime import datetime

    model_info = "Aucun modèle en production"
    if os.path.exists(REGISTRY_FILE):
        with open(REGISTRY_FILE) as f:
            registry = json.load(f)
        prod = registry.get('production')
        if prod:
            model_info = f"{prod['model_name']} {prod['version']} (R²={prod['r2_test']:.4f})"
            prod.update({'dataset_id': dataset_id, 'dataset_version': dataset_version})
            registry['production'] = prod
            with open(REGISTRY_FILE, 'w') as f:
                json.dump(registry, f, indent=2)

    lineage_path = os.path.join(DATA_DIR, 'dataset_model_lineage.json')
    history = []
    if os.path.exists(lineage_path):
        with open(lineage_path) as f:
            history = json.load(f).get('history', [])
    history.append({
        'dataset_version': dataset_version, 'dataset_id': dataset_id,
        'model_in_prod': model_info, 'linked_at': datetime.now().isoformat(),
    })
    with open(lineage_path, 'w') as f:
        import json as _j
        _j.dump({'history': history}, f, indent=2)

    print(f"\n── Étape 4 : Traçabilité ──")
    print(f"  Dataset : v{dataset_version} ({dataset_id})")
    print(f"  Modèle  : {model_info}")
    print(f"  ✅ Lignée → {lineage_path}")
    return lineage_path


# ─────────────────────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────────────────────
def run_pipeline():
    print("═" * 52)
    print("  MALOPS — Dataset Versioning Pipeline")
    print("═" * 52)

    # Init ClearML Task pour tracking
    try:
        from clearml import Task
        task = Task.init(
            project_name = 'MALOPS',
            task_name    = 'Dataset Versioning Pipeline',
            task_type    = Task.TaskTypes.data_processing,
            reuse_last_task_id = False,
        )
        print(f"  ClearML Task : {task.id}")
    except Exception as e:
        print(f"  ⚠ ClearML Task non disponible : {e}")

    scan_path               = step_scan_csv()
    hash_file               = step_compute_hashes(scan_path)
    dataset_id, ds_version  = step_create_dataset_version(scan_path, hash_file)
    lineage_path            = step_link_dataset_to_model(dataset_id, ds_version)

    print(f"\n{'═'*52}")
    print(f"  ✅ Pipeline terminé !")
    print(f"  Version : v{ds_version}  |  ID : {dataset_id}")
    print(f"{'═'*52}")


if __name__ == '__main__':
    run_pipeline()
