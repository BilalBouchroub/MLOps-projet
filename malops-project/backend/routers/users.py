from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.prediction import Prediction
from models.api_log import APILog
from schemas.user import UserResponse, UserUpdate, UserCreate
from routers.auth import get_current_admin_user
from typing import List
from core.security import get_password_hash
from utils.system_logger import log_event
from utils.email_service import send_welcome_email

router = APIRouter(prefix="/users", tags=["users"])

@router.get("", response_model=List[UserResponse])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    return db.query(User).offset(skip).limit(limit).all()

@router.get("/{user_id}", response_model=UserResponse)
def read_user(user_id: str, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    return user

@router.post("", response_model=UserResponse)
def create_user(user_in: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    db_user = db.query(User).filter((User.username == user_in.username) | (User.email == user_in.email)).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur ou email déjà enregistré")
    new_user = User(username=user_in.username, email=user_in.email, full_name=user_in.full_name, hashed_password=get_password_hash(user_in.password), role=user_in.role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    log_event("INFO", "User Service", f"Utilisateur '{new_user.username}' créé (rôle: {new_user.role})", "utilisateur créé")
    background_tasks.add_task(
        send_welcome_email,
        to_email=user_in.email,
        full_name=user_in.full_name or user_in.username,
        username=user_in.username,
        password=user_in.password,
    )
    return new_user

@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, user_in: UserUpdate, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    # Empêcher la dégradation du compte admin principal
    if user.username == "admin":
        if user_in.role is not None and user_in.role != "admin":
            raise HTTPException(status_code=400, detail="Le rôle du compte admin principal ne peut pas être modifié.")
        if user_in.is_active is False:
            raise HTTPException(status_code=400, detail="Le compte admin principal ne peut pas être désactivé.")
    for key, value in user_in.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    log_event("INFO", "User Service", f"Utilisateur '{user.username}' modifié", "utilisateur modifié")
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    username = user.username
    db.query(Prediction).filter(Prediction.user_id == user.id).delete()
    db.query(APILog).filter(APILog.user_id == user.id).delete()
    db.delete(user)
    db.commit()
    log_event("WARNING", "User Service", f"Utilisateur '{username}' supprimé", "utilisateur supprimé")
