from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime

class OrderItemCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(..., gt=0)

class OrderCreate(BaseModel):
    items: List[OrderItemCreate] = Field(..., min_length=1)
    address_id: UUID
    payment_method: str = Field(..., description="e.g., COD, CREDIT_CARD, VNPAY, MOMO")

class OrderItemResponse(BaseModel):
    id: UUID
    order_id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    quantity: int
    unit_price: float

    model_config = ConfigDict(from_attributes=True)

class PaymentResponse(BaseModel):
    id: UUID
    transaction_id: Optional[str]
    status: str
    provider: str

    model_config = ConfigDict(from_attributes=True)

class OrderResponse(BaseModel):
    id: UUID
    user_id: UUID
    address_id: UUID
    total_amount: float
    status: str
    payment_method: str
    items: List[OrderItemResponse] = []
    payment: Optional[PaymentResponse] = None
    payment_url: Optional[str] = None
    tracking_code: Optional[str] = None
    shipping_provider: Optional[str] = "GHN"
    shipping_fee: Optional[float] = 0.0
    estimated_delivery: Optional[str] = None
    shipping_status: Optional[str] = "PENDING"
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class OrderPaymentMethodUpdate(BaseModel):
    payment_method: str = Field(..., description="New payment method, e.g., COD, VIETQR, VNPAY, MOMO, CREDIT_CARD")

