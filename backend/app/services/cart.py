import json
from typing import List

from app.core.redis import get_redis_client
from app.schemas.cart import CartItemIn, CartItemOut

class CartService:
    def __init__(self):
        self.redis = get_redis_client()

    async def _cart_key(self, user_id: str) -> str:
        return f"cart:{user_id}"

    async def get_cart(self, user_id: str) -> List[CartItemOut]:
        data = await self.redis.get(await self._cart_key(user_id))
        if not data:
            return []
        items = json.loads(data)
        return [CartItemOut(**item) for item in items]

    async def _save_cart(self, user_id: str, items: List[dict]):
        await self.redis.set(await self._cart_key(user_id), json.dumps(items))

    async def add_item(self, user_id: str, item: CartItemIn) -> CartItemOut:
        cart = await self.get_cart(user_id)
        for existing in cart:
            if existing.product_id == item.product_id:
                existing.quantity += item.quantity
                await self._save_cart(user_id, [c.dict() for c in cart])
                return existing
        new_item = CartItemOut(**item.dict())
        cart.append(new_item)
        await self._save_cart(user_id, [c.dict() for c in cart])
        return new_item

    async def update_item(self, user_id: str, item: CartItemIn) -> CartItemOut:
        cart = await self.get_cart(user_id)
        for existing in cart:
            if existing.product_id == item.product_id:
                existing.quantity = item.quantity
                existing.name = item.name or existing.name
                existing.price = item.price or existing.price
                existing.image = item.image or existing.image
                await self._save_cart(user_id, [c.dict() for c in cart])
                return existing
        raise ValueError("Item not found in cart")

    async def remove_item(self, user_id: str, product_id: str):
        cart = await self.get_cart(user_id)
        cart = [c for c in cart if c.product_id != product_id]
        await self._save_cart(user_id, [c.dict() for c in cart])
