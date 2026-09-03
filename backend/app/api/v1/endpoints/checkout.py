from fastapi import APIRouter, Depends, status
from app.models.user import User
from app.api.deps import get_current_user
from app.schemas.order import OrderCreate, OrderResponse
from app.api.v1.endpoints.orders import create_order as create_order_endpoint

router = APIRouter()

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def checkout(order: OrderCreate, current_user: User = Depends(get_current_user)):
    """Placeholder checkout endpoint that delegates to order creation."""
    # In a real implementation, additional payment processing would occur here.
    return await create_order_endpoint(order, current_user)
