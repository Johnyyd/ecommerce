from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field

class PayOSWebhookData(BaseModel):
    orderCode: int
    amount: int
    description: str
    accountNumber: Optional[str] = None
    reference: Optional[str] = None
    transactionDateTime: Optional[str] = None
    currency: Optional[str] = "VND"
    paymentLinkId: Optional[str] = None
    code: Optional[str] = None
    desc: Optional[str] = None

    model_config = ConfigDict(extra="allow")

class PayOSWebhookPayload(BaseModel):
    code: str
    desc: str
    data: Dict[str, Any]
    signature: str

class PaymentCreateRequest(BaseModel):
    order_id: UUID
    provider: str = Field(default="VIETQR", description="VIETQR, PAYOS, VNPAY, MOMO, COD")

class PaymentCreateResponse(BaseModel):
    order_id: UUID
    order_code: int
    amount: float
    currency: str = "VND"
    qr_code_url: str
    account_number: str
    account_name: str
    bank_name: str
    description: str
    payment_url: Optional[str] = None

class PaymentStatusResponse(BaseModel):
    order_id: UUID
    order_status: str
    payment_status: str
    amount: float
    provider: str
    transaction_id: Optional[str] = None
    paid_at: Optional[datetime] = None
