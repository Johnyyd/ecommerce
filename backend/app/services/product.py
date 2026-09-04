from uuid import UUID
from typing import List, Optional
from app.crud.product import ProductRepository
from app.schemas.product import ProductCreate, ProductUpdate
from app.models.product import Product

class ProductService:
    def __init__(self, repository: ProductRepository):
        self.repository = repository

    async def get_product(self, product_id: UUID) -> Optional[Product]:
        return await self.repository.get(product_id)

    async def get_products(
        self, 
        skip: int = 0, 
        limit: int = 100,
        category_id: Optional[UUID] = None,
        brand: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        q: Optional[str] = None
    ) -> List[Product]:
        return await self.repository.get_multi(
            skip=skip, limit=limit, category_id=category_id, brand=brand, min_price=min_price, max_price=max_price, q=q
        )

    async def get_products_count(
        self,
        category_id: Optional[UUID] = None,
        brand: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        q: Optional[str] = None
    ) -> int:
        return await self.repository.get_count(
            category_id=category_id, brand=brand, min_price=min_price, max_price=max_price, q=q
        )

    async def create_product(self, product_in: ProductCreate) -> Product:
        return await self.repository.create(product_in)

    async def update_product(self, product: Product, product_in: ProductUpdate) -> Product:
        return await self.repository.update(product, product_in)

    async def delete_product(self, product_id: UUID) -> bool:
        return await self.repository.delete(product_id)
