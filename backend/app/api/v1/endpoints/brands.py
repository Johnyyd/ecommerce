from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from app.core.db import get_db_session
from app.models.user import User
from app.schemas.brand import BrandCreate, BrandUpdate, BrandResponse
from app.crud.brand import BrandRepository
from app.api.deps import get_current_staff

router = APIRouter()

def get_brand_repo(session: AsyncSession = Depends(get_db_session)) -> BrandRepository:
    return BrandRepository(session)

@router.get("/", response_model=List[BrandResponse])
async def list_brands(
    skip: int = 0,
    limit: int = 100,
    repo: BrandRepository = Depends(get_brand_repo)
):
    return await repo.get_multi(skip=skip, limit=limit)

@router.post("/", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def create_brand(
    brand_in: BrandCreate,
    current_staff: User = Depends(get_current_staff),
    repo: BrandRepository = Depends(get_brand_repo)
):
    existing = await repo.get_by_slug(brand_in.slug)
    if existing:
        raise HTTPException(status_code=400, detail="Brand slug already exists")
    return await repo.create(brand_in)

@router.patch("/{id}", response_model=BrandResponse)
async def update_brand(
    id: UUID,
    brand_in: BrandUpdate,
    current_staff: User = Depends(get_current_staff),
    repo: BrandRepository = Depends(get_brand_repo)
):
    brand = await repo.get_by_id(id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return await repo.update(brand, brand_in)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_brand(
    id: UUID,
    current_staff: User = Depends(get_current_staff),
    repo: BrandRepository = Depends(get_brand_repo)
):
    brand = await repo.get_by_id(id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    await repo.delete(brand)
    return None
