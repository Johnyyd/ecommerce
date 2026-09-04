from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID

class ProductBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    price: float = Field(..., ge=0)
    stock_quantity: int = Field(default=0, ge=0)
    category_id: Optional[UUID] = None
    brand: Optional[str] = Field(None, max_length=100)
    rating: Optional[float] = Field(default=0.0, ge=0.0, le=5.0)
    image_url: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    stock_quantity: Optional[int] = Field(None, ge=0)
    category_id: Optional[UUID] = None
    brand: Optional[str] = Field(None, max_length=100)
    rating: Optional[float] = Field(None, ge=0.0, le=5.0)
    image_url: Optional[str] = None

class ProductResponse(ProductBase):
    id: UUID
    version: int

    model_config = ConfigDict(from_attributes=True)

from typing import List
class PaginatedProductResponse(BaseModel):
    items: List[ProductResponse]
    total: int
