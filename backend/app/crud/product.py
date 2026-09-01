from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.product import Product
from typing import Optional

class ProductRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id_for_update(self, product_id: UUID) -> Optional[Product]:
        # Pessimistic locking (SELECT FOR UPDATE) to avoid TOCTOU on stock decrement
        stmt = select(Product).where(Product.id == product_id).with_for_update()
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def update(self, product: Product) -> Product:
        self.session.add(product)
        # Assuming the caller will commit the transaction (since we locked it, we need to commit to release)
        return product
