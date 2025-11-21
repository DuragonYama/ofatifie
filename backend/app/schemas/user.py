"""
Pydantic schemas for User API requests/responses
"""
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    """Schema for user registration"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    
class UserLogin(BaseModel):
    """Schema for user login"""
    username: str
    password: str

class UserResponse(BaseModel):
    """Schema for user data in responses (no password!)"""
    id: int
    username: str
    email: str
    role: str
    storage_quota_mb: int
    storage_used_mb: float
    created_at: datetime
    avatar_path: Optional[str] = None
    
    class Config:
        from_attributes = True  # Allows creating from SQLAlchemy models

class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    """Schema for data stored in JWT token"""
    username: Optional[str] = None

class PasswordChange(BaseModel):
    """Schema for changing password"""
    current_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "current_password": "oldpassword123",
                "new_password": "newpassword456"
            }
        }
    )