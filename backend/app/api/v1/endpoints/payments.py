from uuid import UUID
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.db import get_db_session
from app.models.order import Order, Payment

router = APIRouter()

@router.post("/webhook")
async def payment_webhook(
    order_id: UUID,
    status: str,
    mock_secret: str,
    session: AsyncSession = Depends(get_db_session)
) -> Any:
    """
    Mock webhook for payment providers (VNPay, MoMo).
    In a real system, this would accept a payload from the provider, verify the signature, and extract the order_id.
    """
    if mock_secret != "mock_secret_123":
        raise HTTPException(status_code=403, detail="Invalid signature")

    stmt = select(Order).options(selectinload(Order.payment)).where(Order.id == order_id)
    result = await session.execute(stmt)
    order = result.scalars().first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if status.upper() == "SUCCESS":
        order.status = "PROCESSING"
        if order.payment:
            order.payment.status = "PAID"
    elif status.upper() == "FAILED":
        order.status = "CANCELLED"
        if order.payment:
            order.payment.status = "FAILED"
            
    session.add(order)
    await session.commit()
    
    return {"message": "Webhook processed successfully", "order_id": order_id, "status": order.status}
