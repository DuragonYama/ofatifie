"""
Authentication endpoints
- Register new users
- Login (get JWT token)
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm 
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import timedelta, datetime

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token, PasswordChange
from app.auth import hash_password, verify_password, create_access_token, get_current_user

from pathlib import Path
import shutil


router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account
    
    - Checks if username/email already exists
    - Hashes password with bcrypt
    - Creates user in database
    - Returns user data (without password!)
    """
    
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash the password
    hashed_password = hash_password(user_data.password)
    
    # Create new user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password=hashed_password,
        role="USER"  # Default role
    )
    
    db.add(new_user)
    db.commit()
    
    # Build response from raw data to avoid relationship loading
    from datetime import datetime
    return UserResponse(
        id=new_user.id,
        username=user_data.username,
        email=user_data.email,
        role="USER",
        storage_quota_mb=5000,
        storage_used_mb=0,
        created_at=datetime.utcnow()
    )

@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login and get JWT access token
    
    - Validates username and password
    - Returns JWT token valid for 7 days
    - Token should be included in future requests: Authorization: Bearer {token}
    """
    
    # Find user by username
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token (valid for 7 days)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(days=7)
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Get current logged-in user's profile
    
    This endpoint is protected - requires valid JWT token
    Example: Authorization: Bearer eyJhbGci...
    """
    return current_user
@router.put("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change user's password
    
    - Requires authentication (must be logged in)
    - Verifies current password
    - Updates to new password
    """
    
    # Verify current password
    if not verify_password(password_data.current_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Check new password is different
    if password_data.current_password == password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )
    
    # Hash new password and update
    new_hashed_password = hash_password(password_data.new_password)
    current_user.password = new_hashed_password
    
    db.commit()
    
    return {"message": "Password changed successfully"}

@router.post("/upload-avatar", status_code=status.HTTP_200_OK)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload user avatar image
    
    - Accepts: jpg, jpeg, png, gif, webp
    - Max size: 5MB (enforced by FastAPI default)
    - Saves as: user_{id}.{extension}
    """
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: jpg, png, gif, webp"
        )
    
    # Get file extension
    file_extension = file.filename.split(".")[-1].lower()
    
    # Create uploads directory if it doesn't exist
    upload_dir = Path("uploads/avatars")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Delete old avatar if exists
    if current_user.avatar_path:
        old_avatar = Path(current_user.avatar_path)
        if old_avatar.exists():
            old_avatar.unlink()
    
    # Save with unique filename: user_{id}.{ext}
    filename = f"user_{current_user.id}.{file_extension}"
    file_path = upload_dir / filename
    
    # Save file
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update user's avatar_path in database
    current_user.avatar_path = str(file_path)
    db.commit()
    
    return {
        "message": "Avatar uploaded successfully",
        "avatar_path": str(file_path)
    }

@router.get("/avatar/{user_id}")
def get_avatar(user_id: int, db: Session = Depends(get_db)):
    """
    Get user's avatar image
    
    Returns the avatar image file or 404 if not found
    """
    
    # Find user
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user has avatar
    if not user.avatar_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User has no avatar"
        )
    
    # Check if file exists
    avatar_path = Path(user.avatar_path)
    if not avatar_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Avatar file not found"
        )
    
    # Return the image file
    return FileResponse(avatar_path)