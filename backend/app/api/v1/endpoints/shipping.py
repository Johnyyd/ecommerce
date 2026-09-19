from uuid import UUID
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.db import get_db_session
from app.api.deps import get_current_user, get_current_staff
from app.models.user import User
from app.models.order import Order
from app.models.address import Address
from app.schemas.order import OrderResponse
from app.services.shipping.ghn_service import ghn_service

router = APIRouter()

class ShippingFeeRequest(BaseModel):
    to_district_id: Optional[int] = 1444
    to_ward_code: Optional[str] = "20308"
    weight_grams: Optional[int] = 1000
    insurance_value: Optional[int] = 100000

@router.post("/calculate-fee")
async def calculate_shipping_fee(
    body: ShippingFeeRequest
) -> Any:
    """
    Public/Authenticated: Calculate real shipping fee and lead time from GHN Express.
    """
    fee_data = await ghn_service.calculate_fee(
        to_district_id=body.to_district_id or 1444,
        to_ward_code=body.to_ward_code or "20308",
        weight_grams=body.weight_grams or 1000,
        insurance_value=body.insurance_value or 100000
    )
    return fee_data

@router.post("/orders/{order_id}/fulfill", response_model=OrderResponse)
async def fulfill_order_shipping(
    order_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    staff_user: User = Depends(get_current_staff)
) -> Any:
    """
    Admin/Manager: Fulfill an order by creating a GHN shipping order and assigning tracking code.
    Changes order status to SHIPPED.
    """
    stmt = (
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.payment), selectinload(Order.address))
        .where(Order.id == order_id)
    )
    res = await session.execute(stmt)
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if order.status == "CANCELLED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot fulfill a cancelled order")

    # Destination address info
    to_name = staff_user.username
    to_phone = "0909123456"
    to_address = "Vietnam"
    if order.address:
        to_phone = order.address.phone_number
        to_address = f"{order.address.street_detail}, {order.address.ward}, {order.address.district}, {order.address.province}"

    items_count = sum(item.quantity for item in order.items) if order.items else 1

    # Call GHN Service to create shipment
    shipment_res = await ghn_service.create_shipping_order(
        order_id=str(order.id),
        to_name=to_name,
        to_phone=to_phone,
        to_address=to_address,
        weight_grams=items_count * 400,
        items_count=items_count
    )

    # Update order with shipping details
    order.tracking_code = shipment_res["tracking_code"]
    order.shipping_provider = shipment_res["shipping_provider"]
    order.shipping_fee = shipment_res["shipping_fee"]
    order.estimated_delivery = shipment_res["estimated_delivery"]
    order.shipping_status = shipment_res["shipping_status"]
    order.status = "SHIPPED"

    session.add(order)
    await session.commit()
    await session.refresh(order)

    return order

@router.get("/tracking/{tracking_code}")
async def get_tracking_by_code(
    tracking_code: str,
    session: AsyncSession = Depends(get_db_session)
) -> Any:
    """
    Public/Authenticated: Retrieve full shipping timeline and stages by GHN tracking code.
    """
    # Lookup order if available to get accurate status and created_at
    stmt = select(Order).where(Order.tracking_code == tracking_code)
    res = await session.execute(stmt)
    order = res.scalars().first()

    status = order.status if order else "SHIPPED"
    created_at = order.created_at if order else None

    timeline = await ghn_service.get_tracking_timeline(
        tracking_code=tracking_code,
        current_order_status=status,
        created_at=created_at
    )
    return timeline

@router.get("/orders/{order_id}/tracking")
async def get_order_tracking(
    order_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Customer/Admin: Retrieve tracking timeline for an order.
    """
    stmt = (
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.payment))
        .where(Order.id == order_id)
    )
    res = await session.execute(stmt)
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Check permission
    if current_user.role not in ["admin", "manager"] and order.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    tracking_code = order.tracking_code or f"GHN{str(order.id).replace('-', '').upper()[:8]}"
    timeline = await ghn_service.get_tracking_timeline(
        tracking_code=tracking_code,
        current_order_status=order.status,
        created_at=order.created_at
    )
    return timeline
