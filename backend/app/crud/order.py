from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.product import Order, OrderItem, Product
from app.schemas.order import OrderCreate
from app.crud.product import ProductRepository

class OrderRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_multi_by_user(self, user_id: UUID, skip: int = 0, limit: int = 100) -> List[Order]:
        stmt = select(Order).where(Order.user_id == user_id).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        # Note: Depending on relationships, eager loading might be needed to get items
        return list(result.scalars().all())

    async def create_order_with_transaction(self, user_id: UUID, order_in: OrderCreate) -> Order:
        # Implicitly starts a transaction, but we can manage it explicitly if needed
        # We assume the session is already in a transaction context from FastAPI dependency
        
        total_amount = 0.0
        order_items = []
        product_repo = ProductRepository(self.session)

        # 1. Pessimistic Locking: Lock products and verify stock
        # To avoid deadlocks, it's a good practice to sort the product IDs before locking
        # But for MVP, we'll lock them in the order received, or better, sort them:
        sorted_items = sorted(order_in.items, key=lambda x: x.product_id)
        
        for item in sorted_items:
            # SELECT FOR UPDATE
            product = await product_repo.get_by_id_for_update(item.product_id)
            if not product:
                raise ValueError(f"Product {item.product_id} not found")
            
            if product.stock_quantity < item.quantity:
                raise ValueError(f"Insufficient stock for product {product.name}")
                
            # Deduct stock
            product.stock_quantity -= item.quantity
            product.version += 1
            self.session.add(product)
            
            # Calculate price
            item_total = float(product.price) * item.quantity
            total_amount += item_total
            
            # Create OrderItem object
            order_items.append(OrderItem(
                product_id=product.id,
                quantity=item.quantity,
                unit_price=product.price
            ))
            
        # 2. Create Order
        db_order = Order(
            user_id=user_id,
            total_amount=total_amount,
            status="COMPLETED" # For MVP, immediately complete
        )
        self.session.add(db_order)
        await self.session.flush() # To get db_order.id
        
        # 3. Assign order_id to items and add them
        for order_item in order_items:
            order_item.order_id = db_order.id
            self.session.add(order_item)
            
        # Commit the transaction
        await self.session.commit()
        await self.session.refresh(db_order)
        
        # We might need to eager load items, but let's assume they aren't returned or we fetch them separately
        return db_order
