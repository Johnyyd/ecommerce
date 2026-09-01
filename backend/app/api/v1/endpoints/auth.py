from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.core.db import get_db_session
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.crud.user import UserRepository
from app.services.user import UserService
from app.services.token import TokenService
from pydantic import BaseModel

router = APIRouter()

class LoginData(BaseModel):
    username: str
    password: str

def get_user_service(session: AsyncSession = Depends(get_db_session)) -> UserService:
    repo = UserRepository(session)
    return UserService(repo)

token_service = TokenService()

@router.post("/login")
async def login(
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
    
    # Cookie SameSite=Lax, HttpOnly, Secure
    response.set_cookie(
        key="refresh_token", 
        value=refresh_token, 
        httponly=True, 
        secure=True, 
        samesite="lax",
        max_age=7*24*3600
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh")
async def refresh_token(
    response: Response,
    refresh_token: str = Cookie(None)
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
        
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
    response.set_cookie(
        key="refresh_token", 
        value=new_rt, 
        httponly=True, 
        secure=True, 
        samesite="lax",
        max_age=7*24*3600
    )
    
    return {"access_token": new_at, "token_type": "bearer"}
