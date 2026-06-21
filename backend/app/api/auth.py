from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import User, Analytics
from backend.app.schemas import UserSignUp, UserLogin, Token, UserResponse
from backend.app.utils.security import (
    hash_password, verify_password, create_access_token, create_refresh_token, decode_refresh_token
)
from backend.app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user_data: UserSignUp, db: Session = Depends(get_db)):
    """Registers a new user and configures their initial empty analytics profile."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered."
        )
    
    hashed_pwd = hash_password(user_data.password)
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hashed_pwd
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Initialize empty analytics profile
    analytics_row = Analytics(user_id=new_user.id)
    db.add(analytics_row)
    db.commit()
    
    return new_user

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Authenticates the user and returns access and refresh JWT tokens."""
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
        
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}

@router.post("/refresh-token", response_model=Token)
def refresh_token(token_data: dict, db: Session = Depends(get_db)):
    """Exchanges a valid refresh token for a new access token and rotated refresh token."""
    refresh = token_data.get("refresh_token")
    if not refresh:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refresh token is required."
        )
        
    user_id_str = decode_refresh_token(refresh)
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token."
        )
        
    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload."
        )
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found."
        )
        
    access = create_access_token(user.id)
    new_refresh = create_refresh_token(user.id)
    return {"access_token": access, "refresh_token": new_refresh, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Retrieves current user details."""
    return current_user

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """Stateless logout endpoint (token invalidation is handled by the client clearing storage)."""
    return {"detail": "Successfully logged out."}
