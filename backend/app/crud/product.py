from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate
from typing import Optional, List

class ProductRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, product_id: UUID) -> Optional[Product]:
        stmt = select(Product).where(Product.id == product_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_id_for_update(self, product_id: UUID) -> Optional[Product]:
        # Pessimistic locking (SELECT FOR UPDATE) to avoid TOCTOU on stock decrement
        stmt = select(Product).where(Product.id == product_id).with_for_update()
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_multi(
        self, 
        skip: int = 0, 
        limit: int = 100,
        category_id: Optional[UUID] = None,
        brand: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        q: Optional[str] = None
    ) -> List[Product]:
        stmt = select(Product)
        if category_id:
            stmt = stmt.where(Product.category_id == category_id)
        if brand:
            stmt = stmt.where(Product.brand == brand)
        if min_price is not None:
            stmt = stmt.where(Product.price >= min_price)
        if max_price is not None:
            stmt = stmt.where(Product.price <= max_price)
        if q:
            stmt = stmt.where(Product.name.ilike(f"%{q}%"))
            
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_count(
        self,
        category_id: Optional[UUID] = None,
        brand: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        q: Optional[str] = None
    ) -> int:
        from sqlalchemy import func
        stmt = select(func.count()).select_from(Product)
        if category_id:
            stmt = stmt.where(Product.category_id == category_id)
        if brand:
            stmt = stmt.where(Product.brand == brand)
        if min_price is not None:
            stmt = stmt.where(Product.price >= min_price)
        if max_price is not None:
            stmt = stmt.where(Product.price <= max_price)
        if q:
            stmt = stmt.where(Product.name.ilike(f"%{q}%"))
            
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def create(self, obj_in: ProductCreate) -> Product:
        db_obj = Product(**obj_in.model_dump())
        self.session.add(db_obj)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def update(self, db_obj: Product, obj_in: ProductUpdate) -> Product:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        # Increment version for optimistic locking if needed
        db_obj.version += 1
        
        self.session.add(db_obj)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete(self, product_id: UUID) -> bool:
        stmt = delete(Product).where(Product.id == product_id)
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount > 0
