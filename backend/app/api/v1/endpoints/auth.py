from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated, Optional
import logging
import secrets

from app.core.db import get_db_session
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.crud.user import UserRepository
from app.services.user import UserService
from app.services.token import TokenService
from pydantic import BaseModel
from app.schemas.user import UserResponse
from app.api.deps import get_current_user
from app.models.user import User
from app.core.rate_limiter import limiter

router = APIRouter()
logger = logging.getLogger(__name__)

class LoginData(BaseModel):
    username: str
    password: str

def get_user_service(session: AsyncSession = Depends(get_db_session)) -> UserService:
    repo = UserRepository(session)
    return UserService(repo)

token_service = TokenService()

from app.schemas.user import UserCreate

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    user_service: UserService = Depends(get_user_service)
):
    try:
        user = await user_service.create_user(user_in)
        try:
            from app.core.queue import enqueue_email_job
            import asyncio
            asyncio.create_task(enqueue_email_job(
                user.email,
                "Welcome to Enterprise E-Commerce",
                "welcome",
                {"username": user.username}
            ))
        except Exception as err:
            logger.warning("Could not dispatch welcome email for %s: %s", user.username, err)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    data: LoginData,
    response: Response,
    user_service: UserService = Depends(get_user_service)
):
    user = await user_service.user_repo.get_by_username(data.username)
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    family_id = await token_service.create_family()
    import uuid
    jti = str(uuid.uuid4())

    access_token = create_access_token(user.id, family_id, jti)
    refresh_token = create_refresh_token(user.id, family_id, jti)

    await token_service.set_active_rt(family_id, jti)

    # Generate CSRF token for double-submit cookie pattern
    csrf_token = secrets.token_urlsafe(32)

    # Cookie SameSite=Lax, HttpOnly, Secure
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7*24*3600
    )

    # Set CSRF token cookie (accessible by JavaScript for double-submit)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,  # Must be readable by JavaScript
        secure=True,
        samesite="lax",
        max_age=7*24*3600
    )

    return {"access_token": access_token, "token_type": "bearer", "csrf_token": csrf_token}  # nosec B105 - standard OAuth2 token type

@router.post("/refresh")
async def refresh_token(
    response: Response,
    request: Request,
    refresh_token: str = Cookie(None),
    x_csrf_token: Optional[str] = Header(None, alias="X-CSRF-Token")
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    # Validate CSRF token from header against cookie
    csrf_cookie = request.cookies.get("csrf_token")
    if not csrf_cookie or not x_csrf_token or csrf_cookie != x_csrf_token:
        raise HTTPException(status_code=403, detail="Invalid CSRF token")

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token")

    family_id = payload.get("family_id")
    jti = payload.get("jti")
    sub = payload.get("sub")

    if not family_id or not jti:
        raise HTTPException(status_code=401, detail="Invalid token structure")

    def generate_tokens(f_id, new_jti):
        return create_access_token(sub, f_id, new_jti), create_refresh_token(sub, f_id, new_jti)

    tokens = await token_service.rotate_token(family_id, jti, generate_tokens)
    if not tokens:
        raise HTTPException(status_code=401, detail="Token revoked or reused outside grace period")

    new_at, new_rt = tokens

    # Generate new CSRF token for rotated refresh token
    new_csrf_token = secrets.token_urlsafe(32)

    response.set_cookie(
        key="refresh_token",
        value=new_rt,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7*24*3600
    )

    # Update CSRF token cookie
    response.set_cookie(
        key="csrf_token",
        value=new_csrf_token,
        httponly=False,
        secure=True,
        samesite="lax",
        max_age=7*24*3600
    )

    return {"access_token": new_at, "token_type": "bearer", "csrf_token": new_csrf_token}  # nosec B105 - standard OAuth2 token type

@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: User = Depends(get_current_user)
):
    return current_user
