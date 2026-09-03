from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from pydantic import BaseModel

from app.core.db import get_db_session
from app.services.cart import CartService
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter()

class CartItemIn(BaseModel):
    product_id: str
    quantity: int = 1
    name: str | None = None
    price: float | None = None
    image: str | None = None

class CartItemOut(BaseModel):
    product_id: str
    quantity: int
    name: str | None = None
    price: float | None = None
    image: str | None = None

@router.get("/", response_model=List[CartItemOut])
async def get_cart(
    current_user: User = Depends(get_current_user),
    cart_service: CartService = Depends(CartService),
):
    return await cart_service.get_cart(current_user.id)

@router.post("/add", response_model=CartItemOut)
async def add_to_cart(
    item: CartItemIn,
    current_user: User = Depends(get_current_user),
    cart_service: CartService = Depends(CartService),
):
    return await cart_service.add_item(current_user.id, item)

@router.patch("/update", response_model=CartItemOut)
async def update_cart_item(
    item: CartItemIn,
    current_user: User = Depends(get_current_user),
    cart_service: CartService = Depends(CartService),
):
    return await cart_service.update_item(current_user.id, item)

@router.delete("/remove/{product_id}")
async def remove_cart_item(
    product_id: str,
    current_user: User = Depends(get_current_user),
    cart_service: CartService = Depends(CartService),
):
    await cart_service.remove_item(current_user.id, product_id)
    return {"detail": "removed"}
