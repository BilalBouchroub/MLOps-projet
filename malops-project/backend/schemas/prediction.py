from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

class PredictionBase(BaseModel):
    ndvi: float
    ndwi: float
    msi: float
    lst: float
    precipitation: float
    soil_moisture: float
    et0: float
    cwsi: float
    stress_class: str
    latitude: float | None = None
    longitude: float | None = None

class PredictionCreate(PredictionBase):
    pass

class PredictionResponse(PredictionBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GlobalStats(BaseModel):
    total_predictions: int
    by_class: dict[str, int]
