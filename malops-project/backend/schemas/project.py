from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional


class UserSummary(BaseModel):
    id: UUID
    username: str
    full_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(BaseModel):
    name: str
    clearml_project_name: Optional[str] = None
    description: Optional[str] = None
    client_user_id: Optional[UUID] = None
    data_engineer_id: Optional[UUID] = None
    mlops_engineer_id: Optional[UUID] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    clearml_project_name: Optional[str] = None
    description: Optional[str] = None
    client_user_id: Optional[UUID] = None
    data_engineer_id: Optional[UUID] = None
    mlops_engineer_id: Optional[UUID] = None


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    clearml_project_name: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    created_by: Optional[UUID] = None
    client_user_id: Optional[UUID] = None
    data_engineer_id: Optional[UUID] = None
    mlops_engineer_id: Optional[UUID] = None
    client_user: Optional[UserSummary] = None
    data_engineer: Optional[UserSummary] = None
    mlops_engineer: Optional[UserSummary] = None

    model_config = ConfigDict(from_attributes=True)
