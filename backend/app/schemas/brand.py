from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import Optional
from datetime import datetime

class BrandBase(BaseModel):
    name: str = Field(..., max_length=100)
    slug: str = Field(..., max_length=100)
    logo_url: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = Field(None, max_length=255)

class BrandCreate(BrandBase):
    pass

class BrandUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    logo_url: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = Field(None, max_length=255)

class BrandResponse(BrandBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
