from pydantic import BaseModel, EmailStr, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal

UserRole = Literal["admin", "data_scientist", "data_engineer", "mlops_engineer", "client"]

class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str | None = None
    role: UserRole = "data_scientist"

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None

class UserResponse(UserBase):
    id: UUID
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    expires_in: int

class TokenData(BaseModel):
    username: str | None = None
