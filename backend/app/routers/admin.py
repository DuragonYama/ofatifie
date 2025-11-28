"""
Admin-only endpoints
- Only accessible by DEVELOPER role
- User management
- System statistics
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional 
from datetime import datetime, timedelta 

from app.database import get_db
from app.models.user import User
from app.models.activity import ImportRequest
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

@router.get("/storage", dependencies=[Depends(require_developer)])
def get_storage_breakdown(db: Session = Depends(get_db)):
    """
    Get storage usage breakdown by user (DEVELOPER only)
    
    Shows how much storage each user is using with quota info
    """
    users = db.query(User).order_by(User.storage_used_mb.desc()).all()
    
    total_used = sum(u.storage_used_mb for u in users)
    total_quota = sum(u.storage_quota_mb for u in users)
    
    user_breakdown = [
        {
            "user_id": u.id,
            "username": u.username,
            "role": u.role,
            "used_mb": u.storage_used_mb,
            "used_gb": round(u.storage_used_mb / 1024, 2),
            "quota_mb": u.storage_quota_mb,
            "quota_gb": round(u.storage_quota_mb / 1024, 2),
            "usage_percentage": round((u.storage_used_mb / u.storage_quota_mb * 100), 1) if u.storage_quota_mb > 0 else 0,
            "is_near_limit": u.storage_used_mb >= u.storage_quota_mb * 0.9  # 90%+ used
        }
        for u in users
    ]
    
    return {
        "total_users": len(users),
        "total_used_mb": total_used,
        "total_used_gb": round(total_used / 1024, 2),
        "total_quota_mb": total_quota,
        "total_quota_gb": round(total_quota / 1024, 2),
        "system_usage_percentage": round((total_used / total_quota * 100), 1) if total_quota > 0 else 0,
        "users": user_breakdown
    }


@router.get("/failed-downloads", dependencies=[Depends(require_developer)])
def get_failed_downloads(
    limit: int = 50,
    days: Optional[int] = 7,
    db: Session = Depends(get_db)
):
    """
    Get recent failed download requests (DEVELOPER only)
    
    Shows Spotify/YouTube downloads that failed with error messages
    
    Query params:
    - limit: Max number of results (default 50)
    - days: Look back N days (default 7, null for all time)
    """
    query = db.query(ImportRequest).filter(ImportRequest.status == 'FAILED')
    
    # Filter by date if specified
    if days is not None:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        query = query.filter(ImportRequest.created_at >= cutoff_date)
    
    # Order by most recent first
    failed_requests = query.order_by(ImportRequest.created_at.desc()).limit(limit).all()
    
    # Group by error message to see common issues
    error_counts = {}
    for req in failed_requests:
        error = req.error_message or "Unknown error"
        error_counts[error] = error_counts.get(error, 0) + 1
    
    # Sort errors by frequency
    common_errors = sorted(
        [{"error": err, "count": cnt} for err, cnt in error_counts.items()],
        key=lambda x: x["count"],
        reverse=True
    )
    
    return {
        "total_failed": len(failed_requests),
        "date_range_days": days,
        "common_errors": common_errors[:10],  # Top 10 error types
        "failed_requests": [
            {
                "id": req.id,
                "url": req.url,
                "user_id": req.requested_by_id,
                "username": req.user.username if req.user else "Unknown",
                "error_message": req.error_message,
                "created_at": req.created_at,
                "completed_at": req.completed_at
            }
            for req in failed_requests
        ]
    }