from uuid import UUID
from app.crud.product import ProductRepository
from app.models.product import Order, OrderItem
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

class OrderService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.product_repo = ProductRepository(session)

    async def create_order(self, user_id: UUID, items: List[dict]) -> Order:
        # Expected items format: [{"product_id": UUID, "quantity": int}]
        total_amount = 0.0
        order_items = []
        
        for item in items:
            product_id = item["product_id"]
            quantity = item["quantity"]
            
            # Lock the product row
            product = await self.product_repo.get_by_id_for_update(product_id)
            if not product:
                raise ValueError(f"Product {product_id} not found")
                
            if product.stock_quantity < quantity:
                raise ValueError(f"Insufficient stock for product {product.name}")
                
            # Decrement stock
            product.stock_quantity -= quantity
            await self.product_repo.update(product)
            
            line_total = float(product.price) * quantity
            total_amount += line_total
            
            order_items.append(
                OrderItem(
                    product_id=product.id,
                    quantity=quantity,
                    unit_price=product.price
                )
            )
            
        # Create order
        order = Order(
            user_id=user_id,
            total_amount=total_amount,
            status="CREATED"
        )
        self.session.add(order)
        
        # Flush to get order.id for items
        await self.session.flush()
        
        for oi in order_items:
            oi.order_id = order.id
            self.session.add(oi)
            
        await self.session.commit()
        await self.session.refresh(order)
        return order
