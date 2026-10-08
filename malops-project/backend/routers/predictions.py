from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.prediction import Prediction
from models.user import User
from schemas.prediction import PredictionCreate, PredictionResponse, GlobalStats
from routers.auth import get_current_active_user
from typing import List
from sqlalchemy import func

router = APIRouter(prefix="/predictions", tags=["predictions"])

@router.get("", response_model=List[PredictionResponse])
def get_predictions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role == "admin":
        return db.query(Prediction).offset(skip).limit(limit).all()
    return db.query(Prediction).filter(Prediction.user_id == current_user.id).offset(skip).limit(limit).all()

@router.post("", response_model=PredictionResponse)
def create_prediction(pred_in: PredictionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    new_pred = Prediction(user_id=current_user.id, **pred_in.model_dump())
    db.add(new_pred)
    db.commit()
    db.refresh(new_pred)
    return new_pred

@router.get("/stats", response_model=GlobalStats)
def get_prediction_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role == "admin":
        total = db.query(Prediction).count()
        classes = db.query(Prediction.stress_class, func.count(Prediction.id)).group_by(Prediction.stress_class).all()
    else:
        total = db.query(Prediction).filter(Prediction.user_id == current_user.id).count()
        classes = db.query(Prediction.stress_class, func.count(Prediction.id)).filter(Prediction.user_id == current_user.id).group_by(Prediction.stress_class).all()
    return GlobalStats(total_predictions=total, by_class={c[0]: c[1] for c in classes})
