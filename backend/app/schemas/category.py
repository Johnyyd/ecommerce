from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import Optional

class CategoryBase(BaseModel):
    name: str = Field(..., max_length=100)
    slug: str = Field(..., max_length=100)

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)

class CategoryResponse(CategoryBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
