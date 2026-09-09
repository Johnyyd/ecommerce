from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List

from app.core.db import get_db_session
from app.models.product import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse
from app.api.deps import get_current_admin

router = APIRouter()

@router.get("/", response_model=List[CategoryResponse])
async def list_categories(session: AsyncSession = Depends(get_db_session)):
    stmt = select(Category).order_by(Category.name.asc())
    result = await session.execute(stmt)
    return list(result.scalars().all())

@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_in: CategoryCreate,
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db_session)
):
    # Check if slug or name already exists
    stmt = select(Category).where((Category.slug == category_in.slug) | (Category.name == category_in.name))
    result = await session.execute(stmt)
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Category name or slug already exists")
    
    cat = Category(name=category_in.name, slug=category_in.slug)
    session.add(cat)
    await session.commit()
    await session.refresh(cat)
    return cat

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    id: UUID,
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db_session)
):
    stmt = select(Category).where(Category.id == id)
    result = await session.execute(stmt)
    cat = result.scalars().first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    
    await session.delete(cat)
    await session.commit()
    return None
