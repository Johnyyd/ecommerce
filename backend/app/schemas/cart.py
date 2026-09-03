from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class CartItemBase(BaseModel):
    product_id: UUID
    quantity: int
    name: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None

class CartItemIn(CartItemBase):
    pass

class CartItemOut(CartItemBase):
    pass
