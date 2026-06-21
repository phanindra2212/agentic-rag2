import os
import datetime
import bcrypt
import jwt
from typing import Union, Any

# Secure default keys (must be overridden in production .env)
JWT_SECRET = os.getenv("JWT_SECRET", "production-grade-jwt-secret-key-change-me")
JWT_REFRESH_SECRET = os.getenv("JWT_REFRESH_SECRET", "production-grade-refresh-token-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

def hash_password(password: str) -> str:
    """Hashes a password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, hashed_password: str) -> bool:
    """Verifies a password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(subject: Union[str, Any]) -> str:
    """Generates a short-lived JWT access token."""
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(subject: Union[str, Any]) -> str:
    """Generates a long-lived JWT refresh token."""
    expire = datetime.datetime.utcnow() + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, JWT_REFRESH_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Union[str, None]:
    """Decodes a JWT access token and returns the subject (user_id) if valid."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") == "access":
            return payload.get("sub")
        return None
    except jwt.PyJWTError:
        return None

def decode_refresh_token(token: str) -> Union[str, None]:
    """Decodes a JWT refresh token and returns the subject (user_id) if valid."""
    try:
        payload = jwt.decode(token, JWT_REFRESH_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") == "refresh":
            return payload.get("sub")
        return None
    except jwt.PyJWTError:
        return None
