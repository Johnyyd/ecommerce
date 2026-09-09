from uuid import UUID
from typing import List, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from redis.asyncio import Redis

from app.core.db import get_db_session
from app.core.redis import get_redis_client
from app.schemas.order import OrderCreate, OrderResponse
from app.crud.order import OrderRepository
from app.api.deps import get_current_user, get_current_admin
from app.models.user import User
router = APIRouter()

class OrderStatusUpdate(BaseModel):
    status: str

def get_order_repository(session: AsyncSession = Depends(get_db_session)) -> OrderRepository:
    return OrderRepository(session)

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_in: OrderCreate,
    current_user: User = Depends(get_current_user),
    repo: OrderRepository = Depends(get_order_repository)
) -> Any:
    
    try:
        order = await repo.create_order_with_transaction(current_user.id, order_in)
        return order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Transaction failed: " + str(e))

@router.get("/", response_model=List[OrderResponse])
async def list_user_orders(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    repo: OrderRepository = Depends(get_order_repository)
) -> Any:
    orders = await repo.get_multi_by_user(current_user.id, skip=skip, limit=limit)
    return orders

@router.post("/{id}/cancel", response_model=OrderResponse)
async def cancel_order(
    id: UUID,
    current_user: User = Depends(get_current_user),
    repo: OrderRepository = Depends(get_order_repository)
) -> Any:
    try:
        order = await repo.cancel_order(id, current_user.id)
        return order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Transaction failed: " + str(e))

@router.get("/admin", response_model=List[OrderResponse])
async def list_all_orders_admin(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    current_admin: User = Depends(get_current_admin),
    repo: OrderRepository = Depends(get_order_repository)
) -> Any:
    return await repo.get_all_orders(skip=skip, limit=limit, status=status)

@router.patch("/{id}/status", response_model=OrderResponse)
async def update_order_status_admin(
    id: UUID,
    status_in: OrderStatusUpdate,
    current_admin: User = Depends(get_current_admin),
    repo: OrderRepository = Depends(get_order_repository)
) -> Any:
    try:
        return await repo.admin_update_status(id, status_in.status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to update order status: " + str(e))

