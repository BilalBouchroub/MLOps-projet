import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.project import Project
from models.user import User
from schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, UserSummary
from routers.auth import get_current_admin_user, get_current_active_user
from utils.system_logger import log_event
from utils.project_dirs import get_project_dir

router = APIRouter(prefix="/projects", tags=["projects"])


def _create_clearml_project(name: str, description: str = "") -> bool:
    """Crée le projet dans ClearML si le SDK est disponible. Retourne True si créé/existant."""
    try:
        from clearml.backend_api.services import projects as projects_svc
        from clearml import Task
        session = Task._get_default_session()
        res = session.send(projects_svc.GetAllRequest(name=name, only_fields=["id", "name"]))
        for p in (res.response.projects or []):
            if p.name == name:
                return True  # déjà présent
        session.send(projects_svc.CreateRequest(name=name, description=description or ""))
        return True
    except Exception:
        return False


def _create_clearml_empty_dataset(project_name: str) -> bool:
    """Crée un dataset vide dans ClearML pour marquer le projet comme prêt."""
    try:
        from clearml import Dataset
        ds = Dataset.create(
            dataset_name="Dataset initial",
            dataset_project=project_name,
            description="Dataset vide — en attente des données du Data Engineer",
        )
        ds.finalize(verbose=False)
        return True
    except Exception:
        return False


def _delete_clearml_project(name: str) -> bool:
    """Supprime le projet dans ClearML si le SDK est disponible. Retourne True si supprimé."""
    try:
        from clearml.backend_api.services import projects as projects_svc
        from clearml import Task
        session = Task._get_default_session()
        res = session.send(projects_svc.GetAllRequest(name=name, only_fields=["id", "name"]))
        for p in (res.response.projects or []):
            if p.name == name:
                session.send(projects_svc.DeleteRequest(project=p.id))
                return True
        return False  # projet introuvable dans ClearML
    except Exception:
        return False


def _enrich(project: Project, db: Session) -> ProjectResponse:
    pr = ProjectResponse.model_validate(project)
    if project.client_user_id:
        u = db.query(User).filter(User.id == project.client_user_id).first()
        if u:
            pr.client_user = UserSummary.model_validate(u)
    if project.data_engineer_id:
        u = db.query(User).filter(User.id == project.data_engineer_id).first()
        if u:
            pr.data_engineer = UserSummary.model_validate(u)
    if project.mlops_engineer_id:
        u = db.query(User).filter(User.id == project.mlops_engineer_id).first()
        if u:
            pr.mlops_engineer = UserSummary.model_validate(u)
    return pr


@router.get("/my-project", response_model=Optional[ProjectResponse])
def get_my_project(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retourne le projet assigné à l'utilisateur connecté selon son rôle."""
    role_col = {
        "data_engineer":  Project.data_engineer_id,
        "data_scientist": Project.mlops_engineer_id,
        "mlops_engineer": Project.client_user_id,
    }
    col = role_col.get(current_user.role)
    if col is None:
        raise HTTPException(status_code=404, detail="Aucun projet assigné")
    project = db.query(Project).filter(col == current_user.id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Aucun projet assigné")
    return _enrich(project, db)


@router.get("", response_model=List[ProjectResponse])
def get_projects(db: Session = Depends(get_db), _: User = Depends(get_current_admin_user)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return [_enrich(p, db) for p in projects]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    # Nom ClearML : utilise le champ dédié, ou le nom du projet par défaut
    clearml_name = project_in.clearml_project_name or project_in.name

    new_project = Project(
        name=project_in.name,
        clearml_project_name=clearml_name,
        description=project_in.description,
        client_user_id=project_in.client_user_id,
        data_engineer_id=project_in.data_engineer_id,
        mlops_engineer_id=project_in.mlops_engineer_id,
        created_by=current_admin.id,
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    # Créer le dossier de données isolé pour ce projet
    project_dir = get_project_dir(clearml_name)
    os.makedirs(project_dir, exist_ok=True)

    # Créer le projet dans ClearML (silencieux si SDK indisponible)
    clearml_ok = _create_clearml_project(clearml_name, project_in.description or "")
    if clearml_ok:
        # Créer aussi un dataset vide pour marquer le projet comme initialisé
        _create_clearml_empty_dataset(clearml_name)
    status_msg = "projet créé + ClearML" if clearml_ok else "projet créé (ClearML indisponible)"
    log_event("INFO", "Project Service", f"Projet '{new_project.name}' créé → ClearML: {clearml_ok}", status_msg)

    return _enrich(new_project, db)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    for key, value in project_in.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)

    # Créer/vérifier le projet dans ClearML si le nom ClearML est défini
    if project.clearml_project_name:
        _create_clearml_project(project.clearml_project_name, project.description or "")

    log_event("INFO", "Project Service", f"Projet '{project.name}' modifié", "projet modifié")
    return _enrich(project, db)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    name = project.name
    clearml_name = project.clearml_project_name

    db.delete(project)
    db.commit()

    # Supprimer le dossier de données du projet (sauf si c'est MALOPS/root)
    if clearml_name:
        project_dir = get_project_dir(clearml_name)
        from utils.project_dirs import BASE_DIR
        if project_dir != BASE_DIR and os.path.exists(project_dir):
            shutil.rmtree(project_dir, ignore_errors=True)

    # Supprimer aussi dans ClearML si un nom de projet est défini
    clearml_ok = False
    if clearml_name:
        clearml_ok = _delete_clearml_project(clearml_name)

    status_msg = "projet supprimé + ClearML" if clearml_ok else "projet supprimé (ClearML non affecté)"
    log_event("WARNING", "Project Service", f"Projet '{name}' supprimé → ClearML: {clearml_ok}", status_msg)
