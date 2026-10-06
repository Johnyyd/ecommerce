from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt
from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def get_jwt_algorithm() -> str:
    """Get JWT algorithm - supports HS256 (default) or RS256 if keys configured."""
    if hasattr(settings, 'JWT_PRIVATE_KEY') and settings.JWT_PRIVATE_KEY:
        return "RS256"
    return "HS256"


def get_jwt_signing_key():
    """Get JWT signing key based on algorithm."""
    algorithm = get_jwt_algorithm()
    if algorithm == "RS256":
        return settings.JWT_PRIVATE_KEY
    return settings.SECRET_KEY


def get_jwt_verification_key():
    """Get JWT verification key based on algorithm."""
    algorithm = get_jwt_algorithm()
    if algorithm == "RS256":
        return settings.JWT_PUBLIC_KEY
    return settings.SECRET_KEY


def create_access_token(subject: str, family_id: str = None, jti: str = None, expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + \
            timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    if family_id:
        to_encode["family_id"] = family_id
    if jti:
        to_encode["jti"] = jti
    encoded_jwt = jwt.encode(to_encode, get_jwt_signing_key(), algorithm=get_jwt_algorithm())
    return encoded_jwt


def create_refresh_token(subject: str, family_id: str, jti: str, expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(
        subject), "type": "refresh", "family_id": family_id, "jti": jti}
    encoded_jwt = jwt.encode(to_encode, get_jwt_signing_key(), algorithm=get_jwt_algorithm())
    return encoded_jwt


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_jwt_verification_key(), algorithms=[get_jwt_algorithm()])
    except jwt.PyJWTError:
        return None
