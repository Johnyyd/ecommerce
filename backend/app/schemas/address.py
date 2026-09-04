from typing import Optional
from pydantic import BaseModel, ConfigDict
from uuid import UUID

class AddressBase(BaseModel):
    province: str
    district: str
    ward: str
    street_detail: str
    phone_number: str
    is_default: Optional[bool] = False

class AddressCreate(AddressBase):
    pass

class AddressUpdate(BaseModel):
    province: Optional[str] = None
    district: Optional[str] = None
    ward: Optional[str] = None
    street_detail: Optional[str] = None
    phone_number: Optional[str] = None
    is_default: Optional[bool] = None

class AddressResponse(AddressBase):
    id: UUID
    user_id: UUID

    model_config = ConfigDict(from_attributes=True)
