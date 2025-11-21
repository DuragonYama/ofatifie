"""
Authorization and permission utilities
- Role-based access control
- Storage quota enforcement
"""
from fastapi import Depends, HTTPException, status
from app.auth import get_current_user
from app.models.user import User

def require_role(allowed_roles: list[str]):
    """
    Dependency factory for role-based access control
    
    Usage:
        @router.get("/admin/users", dependencies=[Depends(require_role(["DEVELOPER"]))])
        def get_all_users(): ...
    """
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

# Convenience dependencies for common roles
def require_developer(current_user: User = Depends(get_current_user)):
    """Only DEVELOPER role can access"""
    if current_user.role != "DEVELOPER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developer access only"
        )
    return current_user

def require_tester(current_user: User = Depends(get_current_user)):
    """DEVELOPER or TESTER roles can access"""
    if current_user.role not in ["DEVELOPER", "TESTER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tester access required"
        )
    return current_user

def check_storage_quota(current_user: User = Depends(get_current_user), file_size_mb: float = 0):
    """
    Check if user has enough storage quota for upload
    
    Usage:
        @router.post("/upload")
        def upload_file(
            file: UploadFile,
            current_user: User = Depends(get_current_user),
            db: Session = Depends(get_db)
        ):
            # Calculate file size
            file_size_mb = len(file.file.read()) / (1024 * 1024)
            file.file.seek(0)  # Reset file pointer
            
            # Check quota
            if current_user.storage_used_mb + file_size_mb > current_user.storage_quota_mb:
                raise HTTPException(403, "Storage quota exceeded")
    """
    if current_user.storage_used_mb + file_size_mb > current_user.storage_quota_mb:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Storage quota exceeded. Used: {current_user.storage_used_mb}MB / {current_user.storage_quota_mb}MB"
        )
    return current_user