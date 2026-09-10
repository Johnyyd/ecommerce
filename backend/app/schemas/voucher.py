from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import Optional
from datetime import datetime

class VoucherBase(BaseModel):
    code: str = Field(..., max_length=50)
    discount_type: str = Field(default="PERCENTAGE", description="PERCENTAGE or FIXED")
    discount_value: float = Field(..., gt=0)
    min_order_amount: float = Field(default=0.0, ge=0)
    max_discount_amount: Optional[float] = Field(None, ge=0)
    usage_limit: Optional[int] = Field(None, gt=0)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_active: bool = True

class VoucherCreate(VoucherBase):
    pass

class VoucherUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    discount_type: Optional[str] = None
    discount_value: Optional[float] = Field(None, gt=0)
    min_order_amount: Optional[float] = Field(None, ge=0)
    max_discount_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_active: Optional[bool] = None

class VoucherResponse(VoucherBase):
    id: UUID
    times_used: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class VoucherValidateRequest(BaseModel):
    code: str
    order_amount: float

class VoucherValidateResponse(BaseModel):
    is_valid: bool
    message: str
    discount_amount: float = 0.0
    final_amount: float = 0.0
    code: Optional[str] = None
