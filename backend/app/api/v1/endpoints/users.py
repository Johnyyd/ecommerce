from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db_session
from app.schemas.user import UserCreate, UserResponse
from app.services.user import UserService
from app.crud.user import UserRepository
from typing import Annotated

router = APIRouter()

def get_user_service(session: AsyncSession = Depends(get_db_session)) -> UserService:
    repo = UserRepository(session)
    return UserService(repo)

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    service: Annotated[UserService, Depends(get_user_service)]
):
    try:
        user = await service.create_user(user_in)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
