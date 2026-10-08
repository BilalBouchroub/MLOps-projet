import json
import os
from sqlalchemy.orm import Session

BASE_DIR          = "/home/bilalbouch/malops-project"
PROJECTS_DATA_DIR = os.path.join(BASE_DIR, "data")

# Fichiers initiaux créés dans chaque nouveau dossier projet
_INIT_FILES = {
    "dataset_registry.json":  {},
    "validation_schema.json": {"per_file": {}, "warnings": [], "total_files": 0, "issues": []},
    "validation_stats.json":  {},
    "validation_drift.json":  {},
}


def _init_project_dir(path: str):
    """Crée les fichiers vides nécessaires dans un nouveau dossier projet."""
    for fname, content in _INIT_FILES.items():
        fpath = os.path.join(path, fname)
        if not os.path.exists(fpath):
            with open(fpath, "w") as f:
                json.dump(content, f, indent=2)


def get_project_dir(clearml_project_name: str) -> str:
    """
    Retourne le dossier de données d'un projet.
    MALOPS (ou vide) → dossier racine pour compatibilité avec l'existant.
    Tout autre projet → data/{safe_name}/ (créé + initialisé si absent).
    """
    if not clearml_project_name or clearml_project_name == "MALOPS":
        return BASE_DIR
    safe = clearml_project_name.replace("/", "_").replace(" ", "_")
    path = os.path.join(PROJECTS_DATA_DIR, safe)
    is_new = not os.path.exists(path)
    os.makedirs(path, exist_ok=True)
    if is_new:
        _init_project_dir(path)
    return path


def get_user_project_dir(current_user, db: Session) -> str:
    """Retourne le dossier de données du projet assigné à l'utilisateur connecté."""
    from models.project import Project

    role_map = {
        "data_engineer":  Project.data_engineer_id,
        "data_scientist": Project.mlops_engineer_id,
        "mlops_engineer": Project.client_user_id,
    }
    col = role_map.get(current_user.role)
    if col is None:
        return BASE_DIR  # admin → dossier racine

    project = db.query(Project).filter(col == current_user.id).first()
    if project and project.clearml_project_name:
        return get_project_dir(project.clearml_project_name)
    return BASE_DIR  # pas de projet assigné → fallback racine
