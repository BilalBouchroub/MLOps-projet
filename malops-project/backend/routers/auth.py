from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from schemas.user import Token, UserCreate, UserResponse
from core.security import verify_password, get_password_hash, create_access_token, SECRET_KEY, ALGORITHM
from typing import Annotated
import jwt

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Impossible de valider les identifiants",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("username")
        if username is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_active_user(current_user: Annotated[User, Depends(get_current_user)]):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Utilisateur inactif")
    return current_user

def get_current_admin_user(current_user: Annotated[User, Depends(get_current_active_user)]):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Privilèges insuffisants")
    return current_user

def require_roles(roles: list[str]):
    """Factory: returns a dependency that accepts admin + any listed roles."""
    allowed = set(roles) | {"admin"}
    def checker(current_user: Annotated[User, Depends(get_current_active_user)]):
        if current_user.role not in allowed:
            raise HTTPException(status_code=403, detail="Privilèges insuffisants")
        return current_user
    return checker

@router.post("/token", response_model=Token)
def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nom d'utilisateur ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"username": user.username, "role": user.role})
    return Token(access_token=access_token, token_type="bearer", role=user.role, expires_in=3600)

@router.post("/register", response_model=UserResponse)
def register_user(user_in: UserCreate, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    db_user = db.query(User).filter((User.username == user_in.username) | (User.email == user_in.email)).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur ou email déjà enregistré")
    hashed_password = get_password_hash(user_in.password)
    new_user = User(username=user_in.username, email=user_in.email, full_name=user_in.full_name, hashed_password=hashed_password, role=user_in.role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
