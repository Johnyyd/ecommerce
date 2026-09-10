from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.brand import Brand
from app.schemas.brand import BrandCreate, BrandUpdate

class BrandRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_multi(self, skip: int = 0, limit: int = 100) -> List[Brand]:
        stmt = select(Brand).where(Brand.deleted_at.is_(None)).order_by(Brand.name.asc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, brand_id: UUID) -> Optional[Brand]:
        stmt = select(Brand).where(Brand.id == brand_id, Brand.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_slug(self, slug: str) -> Optional[Brand]:
        stmt = select(Brand).where(Brand.slug == slug, Brand.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create(self, brand_in: BrandCreate) -> Brand:
        brand = Brand(
            name=brand_in.name,
            slug=brand_in.slug,
            logo_url=brand_in.logo_url,
            description=brand_in.description,
            website=brand_in.website
        )
        self.session.add(brand)
        await self.session.commit()
        await self.session.refresh(brand)
        return brand

    async def update(self, brand: Brand, brand_in: BrandUpdate) -> Brand:
        update_data = brand_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(brand, field, value)
        self.session.add(brand)
        await self.session.commit()
        await self.session.refresh(brand)
        return brand

    async def delete(self, brand: Brand) -> None:
        await self.session.delete(brand)
        await self.session.commit()
