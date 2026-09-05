from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.product import Product
from app.models.order import Order, OrderItem, Payment
from app.schemas.order import OrderCreate
from app.crud.product import ProductRepository

class OrderRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_multi_by_user(self, user_id: UUID, skip: int = 0, limit: int = 100) -> List[Order]:
        stmt = select(Order).options(selectinload(Order.items), selectinload(Order.payment)).where(Order.user_id == user_id).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_order_with_transaction(self, user_id: UUID, order_in: OrderCreate) -> Order:
        total_amount = 0.0
        order_items = []
        product_repo = ProductRepository(self.session)

        # 1. Pessimistic Locking: Lock products and verify stock
        sorted_items = sorted(order_in.items, key=lambda x: x.product_id)
        
        for item in sorted_items:
            product = await product_repo.get_by_id_for_update(item.product_id)
            if not product:
                raise ValueError(f"Product {item.product_id} not found")
            
            if product.stock_quantity < item.quantity:
                raise ValueError(f"Insufficient stock for product {product.name}")
                
            product.stock_quantity -= item.quantity
            product.version += 1
            self.session.add(product)
            
            item_total = float(product.price) * item.quantity
            total_amount += item_total
            
            order_items.append(OrderItem(
                product_id=product.id,
                quantity=item.quantity,
                unit_price=product.price
            ))
            
        # 2. Create Order
        db_order = Order(
            user_id=user_id,
            address_id=order_in.address_id,
            payment_method=order_in.payment_method,
            total_amount=total_amount,
            status="PENDING"
        )
        self.session.add(db_order)
        await self.session.flush() # To get db_order.id
        
        # 3. Create Payment
        db_payment = Payment(
            order_id=db_order.id,
            status="PENDING",
            provider=order_in.payment_method
        )
        self.session.add(db_payment)

        # 4. Assign order_id to items and add them
        for order_item in order_items:
            order_item.order_id = db_order.id
            self.session.add(order_item)
            
        # Commit the transaction
        await self.session.commit()
        
        # Refresh and eager load relationships
        stmt = select(Order).options(selectinload(Order.items), selectinload(Order.payment)).where(Order.id == db_order.id)
        result = await self.session.execute(stmt)
        final_order = result.scalars().first()
        
        from app.services.payment import PaymentService
        final_order.payment_url = PaymentService.generate_payment_url(final_order.id, float(final_order.total_amount), final_order.payment_method)
        
        return final_order

    async def get_by_id(self, order_id: UUID, user_id: UUID) -> Optional[Order]:
        stmt = select(Order).options(selectinload(Order.items), selectinload(Order.payment)).where(Order.id == order_id, Order.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def cancel_order(self, order_id: UUID, user_id: UUID) -> Order:
        stmt = select(Order).options(selectinload(Order.items), selectinload(Order.payment)).where(Order.id == order_id, Order.user_id == user_id).with_for_update()
        result = await self.session.execute(stmt)
        order = result.scalars().first()
        
        if not order:
            raise ValueError("Order not found")
        if order.status not in ["PENDING", "PROCESSING"]:
            raise ValueError("Order cannot be cancelled in its current state")
        
        # Restore stock
        product_repo = ProductRepository(self.session)
        for item in order.items:
            product = await product_repo.get_by_id_for_update(item.product_id)
            if product:
                product.stock_quantity += item.quantity
                product.version += 1
                self.session.add(product)
        
        order.status = "CANCELLED"
        if order.payment:
            order.payment.status = "REFUNDED" if order.payment.status == "SUCCESS" else "CANCELLED"
        
        self.session.add(order)
        await self.session.commit()
        await self.session.refresh(order)
        return order
