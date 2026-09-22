from uuid import UUID
from datetime import datetime, timezone
from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.models.review import Review
from app.models.product import Product
from app.models.order import Order
from app.models.user import User
from app.core.utils import generate_uuidv7
from app.schemas.review import ReviewCreate, ReviewResponse, ProductReviewSummary, AdminReviewResponse

class ReviewRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_product(self, product_id: UUID, skip: int = 0, limit: int = 50) -> List[Review]:
        stmt = (
            select(Review)
            .options(selectinload(Review.user))
            .where(Review.product_id == product_id, Review.deleted_at.is_(None))
            .order_by(Review.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_product_summary(self, product_id: UUID) -> ProductReviewSummary:
        reviews = await self.get_by_product(product_id, skip=0, limit=100)
        
        dist: Dict[int, int] = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        total_rating = 0
        for r in reviews:
            dist[r.rating] = dist.get(r.rating, 0) + 1
            total_rating += r.rating
            
        total = len(reviews)
        avg = round(total_rating / total, 1) if total > 0 else 0.0

        review_responses = [
            ReviewResponse(
                id=r.id,
                product_id=r.product_id,
                user_id=r.user_id,
                username=r.user.username if r.user else "Anonymous",
                order_id=r.order_id,
                rating=r.rating,
                comment=r.comment,
                is_verified_purchase=r.is_verified_purchase,
                created_at=r.created_at
            )
            for r in reviews
        ]

        return ProductReviewSummary(
            average_rating=avg,
            total_reviews=total,
            rating_distribution=dist,
            reviews=review_responses
        )

    async def create_verified_review(self, user_id: UUID, review_in: ReviewCreate) -> Review:
        # 1. Verify order belongs to user
        order_stmt = select(Order).options(selectinload(Order.items)).where(Order.id == review_in.order_id)
        order_res = await self.session.execute(order_stmt)
        order = order_res.scalars().first()

        if not order:
            raise ValueError("Order not found")
            
        if order.user_id != user_id:
            raise PermissionError("Order does not belong to the authenticated user")

        # 2. Check that order status is delivered, completed, or processing
        valid_statuses = ("DELIVERED", "COMPLETED", "PROCESSING")
        if order.status.upper() not in valid_statuses:
            raise ValueError(f"Reviews can only be submitted for completed orders (Order status: {order.status})")

        # 3. Verify product was purchased in this order
        purchased_product_ids = {item.product_id for item in order.items}
        if review_in.product_id not in purchased_product_ids:
            raise ValueError("Specified product was not purchased in this order")

        # 4. Check if already reviewed
        existing_stmt = select(Review).where(
            Review.user_id == user_id,
            Review.product_id == review_in.product_id,
            Review.order_id == review_in.order_id,
            Review.deleted_at.is_(None)
        )
        existing_res = await self.session.execute(existing_stmt)
        if existing_res.scalars().first():
            raise ValueError("You have already reviewed this product for this order")

        # 5. Create Review
        review = Review(
            id=generate_uuidv7(),
            product_id=review_in.product_id,
            user_id=user_id,
            order_id=review_in.order_id,
            rating=review_in.rating,
            comment=review_in.comment.strip() if review_in.comment else None,
            is_verified_purchase=True,
            created_at=datetime.now(timezone.utc)
        )
        self.session.add(review)
        await self.session.flush()

        # 6. Recalculate product rating
        avg_stmt = select(func.avg(Review.rating)).where(
            Review.product_id == review_in.product_id,
            Review.deleted_at.is_(None)
        )
        avg_res = await self.session.execute(avg_stmt)
        avg_rating = avg_res.scalar() or review_in.rating

        prod_stmt = select(Product).where(Product.id == review_in.product_id)
        prod_res = await self.session.execute(prod_stmt)
        product = prod_res.scalars().first()
        if product:
            product.rating = round(float(avg_rating), 1)
            self.session.add(product)

        await self.session.commit()
        await self.session.refresh(review)
        return review

    async def delete_review(self, review_id: UUID, current_user: User) -> bool:
        stmt = select(Review).where(Review.id == review_id, Review.deleted_at.is_(None))
        res = await self.session.execute(stmt)
        review = res.scalars().first()
        if not review:
            raise ValueError("Review not found")

        # OWASP A01 BOLA/IDOR Protection
        if current_user.role not in ("admin", "manager") and review.user_id != current_user.id:
            raise PermissionError("Access denied: You cannot delete another user's review")

        review.deleted_at = datetime.now(timezone.utc)
        self.session.add(review)

        # Recalculate product rating
        avg_stmt = select(func.avg(Review.rating)).where(
            Review.product_id == review.product_id,
            Review.deleted_at.is_(None)
        )
        avg_res = await self.session.execute(avg_stmt)
        avg_rating = avg_res.scalar() or 0.0

        prod_stmt = select(Product).where(Product.id == review.product_id)
        prod_res = await self.session.execute(prod_stmt)
        product = prod_res.scalars().first()
        if product:
            product.rating = round(float(avg_rating), 1)
            self.session.add(product)

        await self.session.commit()
        return True

    async def get_all_admin(
        self,
        product_id: Optional[UUID] = None,
        rating: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[AdminReviewResponse]:
        stmt = (
            select(Review)
            .options(selectinload(Review.user), selectinload(Review.product))
            .where(Review.deleted_at.is_(None))
        )
        if product_id:
            stmt = stmt.where(Review.product_id == product_id)
        if rating:
            stmt = stmt.where(Review.rating == rating)
        stmt = stmt.order_by(Review.created_at.desc()).offset(skip).limit(limit)
        res = await self.session.execute(stmt)
        reviews = list(res.scalars().all())

        return [
            AdminReviewResponse(
                id=r.id,
                product_id=r.product_id,
                product_name=r.product.name if r.product else "Unknown Product",
                user_id=r.user_id,
                username=r.user.username if r.user else "Anonymous",
                user_email=r.user.email if r.user else None,
                order_id=r.order_id,
                rating=r.rating,
                comment=r.comment,
                is_verified_purchase=r.is_verified_purchase,
                created_at=r.created_at
            )
            for r in reviews
        ]

