from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone
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
        stmt = (
            select(Order)
            .options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.payment))
            .where(Order.user_id == user_id)
            .order_by(Order.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        orders = list(result.scalars().all())
        from app.services.payment import PaymentService
        for order in orders:
            if order.status == "PENDING":
                order.payment_url = PaymentService.generate_payment_url(order.id, float(order.total_amount), order.payment_method)
        return orders

    async def create_order_with_transaction(self, user_id: UUID, order_in: OrderCreate) -> Order:
        total_amount = 0.0
        order_items = []
        product_repo = ProductRepository(self.session)

        # 1. Pessimistic Locking: Deduplicate and sort products to avoid deadlocks
        merged_quantities = {}
        for item in order_in.items:
            merged_quantities[item.product_id] = merged_quantities.get(item.product_id, 0) + item.quantity

        sorted_product_ids = sorted(merged_quantities.keys())
        affected_product_ids = []
        
        for pid in sorted_product_ids:
            qty = merged_quantities[pid]
            product = await product_repo.get_by_id_for_update(pid)
            if not product:
                raise ValueError(f"Product {pid} not found")
            
            if product.stock_quantity < qty:
                raise ValueError(f"Insufficient stock for product {product.name}")
                
            product.stock_quantity -= qty
            self.session.add(product)
            affected_product_ids.append(pid)
            
            item_total = float(product.price) * qty
            total_amount += item_total
            
            order_items.append(OrderItem(
                product_id=product.id,
                quantity=qty,
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
        
        # Invalidate Redis caches immediately after commit
        from app.services.cache_invalidation import invalidate_product_caches
        await invalidate_product_caches(affected_product_ids)
        
        # Refresh and eager load relationships
        stmt = select(Order).options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.payment)).where(Order.id == db_order.id)
        result = await self.session.execute(stmt)
        final_order = result.scalars().first()
        
        from app.services.payment import PaymentService
        final_order.payment_url = PaymentService.generate_payment_url(final_order.id, float(final_order.total_amount), final_order.payment_method)
        
        return final_order

    async def get_by_id(self, order_id: UUID, user_id: UUID) -> Optional[Order]:
        stmt = select(Order).options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.payment)).where(Order.id == order_id, Order.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def cancel_order(self, order_id: UUID, user_id: UUID) -> Order:
        stmt = select(Order).options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.payment)).where(Order.id == order_id, Order.user_id == user_id).with_for_update()
        result = await self.session.execute(stmt)
        order = result.scalars().first()
        
        if not order:
            raise ValueError("Order not found")
        if order.status not in ["PENDING", "PROCESSING"]:
            raise ValueError("Order cannot be cancelled in its current state")
        
        # Restore stock
        product_repo = ProductRepository(self.session)
        affected_product_ids = []
        for item in order.items:
            product = await product_repo.get_by_id_for_update(item.product_id)
            if product:
                product.stock_quantity += item.quantity
                self.session.add(product)
                affected_product_ids.append(item.product_id)
        
        order.status = "CANCELLED"
        order.completed_at = datetime.now(timezone.utc)
        if order.payment:
            order.payment.status = "REFUNDED" if order.payment.status == "SUCCESS" else "CANCELLED"
        
        self.session.add(order)
        await self.session.commit()
        await self.session.refresh(order)

        # Invalidate Redis caches after restocking
        from app.services.cache_invalidation import invalidate_product_caches
        await invalidate_product_caches(affected_product_ids)

        return order

    async def update_payment_method(self, order_id: UUID, user_id: UUID, new_payment_method: str) -> Order:
        stmt = (
            select(Order)
            .options(selectinload(Order.items), selectinload(Order.payment))
            .where(Order.id == order_id, Order.user_id == user_id)
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        order = result.scalars().first()
        
        if not order:
            raise ValueError("Order not found")
        if order.status != "PENDING":
            raise ValueError(f"Cannot change payment method for order in {order.status} state")
        if order.payment and order.payment.status in ["PAID", "SUCCESS"]:
            raise ValueError("Order has already been paid")
            
        order.payment_method = new_payment_method
        if order.payment:
            order.payment.provider = new_payment_method
            order.payment.status = "PENDING"
            self.session.add(order.payment)
        else:
            db_payment = Payment(
                order_id=order.id,
                status="PENDING",
                provider=new_payment_method
            )
            self.session.add(db_payment)
            
        self.session.add(order)
        await self.session.commit()
        await self.session.refresh(order)
        
        from app.services.payment import PaymentService
        order.payment_url = PaymentService.generate_payment_url(order.id, float(order.total_amount), order.payment_method)
        return order

    async def get_all_orders(self, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> List[Order]:
        stmt = select(Order).options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.payment)).order_by(Order.created_at.desc()).offset(skip).limit(limit)
        if status:
            stmt = stmt.where(Order.status == status)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def admin_update_status(self, order_id: UUID, new_status: str) -> Order:
        stmt = select(Order).options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.payment)).where(Order.id == order_id).with_for_update()
        result = await self.session.execute(stmt)
        order = result.scalars().first()
        if not order:
            raise ValueError("Order not found")
            
        old_status = order.status
        order.status = new_status
        affected_product_ids = []

        if new_status in ["COMPLETED", "DELIVERED", "CANCELLED"]:
            order.completed_at = datetime.now(timezone.utc)
        elif new_status in ["PENDING", "PROCESSING", "SHIPPED"]:
            order.completed_at = None

        if new_status == "COMPLETED" and order.payment:
            order.payment.status = "SUCCESS"
        elif new_status == "CANCELLED":
            if old_status != "CANCELLED":
                # Restore stock on cancellation
                product_repo = ProductRepository(self.session)
                for item in order.items:
                    product = await product_repo.get_by_id_for_update(item.product_id)
                    if product:
                        product.stock_quantity += item.quantity
                        self.session.add(product)
                        affected_product_ids.append(item.product_id)
            if order.payment:
                order.payment.status = "REFUNDED" if order.payment.status == "SUCCESS" else "CANCELLED"
                
        self.session.add(order)
        await self.session.commit()
        await self.session.refresh(order)

        if affected_product_ids:
            from app.services.cache_invalidation import invalidate_product_caches
            await invalidate_product_caches(affected_product_ids)

        return order

