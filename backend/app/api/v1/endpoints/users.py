from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db_session
from app.schemas.user import UserCreate, UserResponse, UserAdminUpdate
from app.services.user import UserService
from app.crud.user import UserRepository
from app.api.deps import get_current_admin
from app.models.user import User
from typing import Annotated, List
from uuid import UUID

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

@router.get("/", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_admin: User = Depends(get_current_admin),
    service: UserService = Depends(get_user_service)
):
    return await service.get_users(skip=skip, limit=limit)

@router.patch("/{id}", response_model=UserResponse)
async def update_user_admin(
    id: UUID,
    user_in: UserAdminUpdate,
    current_admin: User = Depends(get_current_admin),
    service: UserService = Depends(get_user_service)
):
    try:
        return await service.update_user(id, role=user_in.role, is_active=user_in.is_active)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

