"""
Admin-only endpoints
- Only accessible by DEVELOPER role
- User management
- System statistics
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.permissions import require_developer
from app.schemas.user import UserResponse

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/users", response_model=List[UserResponse], dependencies=[Depends(require_developer)])
def get_all_users(db: Session = Depends(get_db)):
    """
    Get all users (DEVELOPER only)
    
    Returns list of all registered users with their details
    """
    users = db.query(User).all()
    return users

@router.put("/users/{user_id}/role", dependencies=[Depends(require_developer)])
def update_user_role(
    user_id: int,
    new_role: str,
    db: Session = Depends(get_db)
):
    """
    Update user role (DEVELOPER only)
    
    Valid roles: DEVELOPER, TESTER, USER
    """
    # Validate role
    valid_roles = ["DEVELOPER", "TESTER", "USER"]
    if new_role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )
    
    # Find user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update role
    old_role = user.role
    user.role = new_role
    db.commit()
    
    return {
        "message": f"User role updated from {old_role} to {new_role}",
        "user_id": user_id,
        "username": user.username,
        "new_role": new_role
    }

@router.put("/users/{user_id}/quota", dependencies=[Depends(require_developer)])
def update_storage_quota(
    user_id: int,
    new_quota_mb: int,
    db: Session = Depends(get_db)
):
    """
    Update user storage quota (DEVELOPER only)
    
    Set custom storage limit for specific users
    """
    if new_quota_mb < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quota must be positive"
        )
    
    # Find user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update quota
    old_quota = user.storage_quota_mb
    user.storage_quota_mb = new_quota_mb
    db.commit()
    
    return {
        "message": f"Storage quota updated from {old_quota}MB to {new_quota_mb}MB",
        "user_id": user_id,
        "username": user.username,
        "new_quota_mb": new_quota_mb,
        "used_mb": user.storage_used_mb
    }

@router.get("/stats", dependencies=[Depends(require_developer)])
def get_system_stats(db: Session = Depends(get_db)):
    """
    Get system statistics (DEVELOPER only)
    """
    total_users = db.query(User).count()
    total_storage_used = db.query(func.sum(User.storage_used_mb)).scalar() or 0
    
    return {
        "total_users": total_users,
        "total_storage_used_mb": total_storage_used,
        "total_storage_used_gb": round(total_storage_used / 1024, 2)
    }