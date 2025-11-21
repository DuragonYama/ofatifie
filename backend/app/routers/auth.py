"""
Authentication endpoints
- Register new users
- Login (get JWT token)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from fastapi.security import OAuth2PasswordRequestForm  # Add this import at top

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.auth import hash_password, verify_password, create_access_token, get_current_user

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