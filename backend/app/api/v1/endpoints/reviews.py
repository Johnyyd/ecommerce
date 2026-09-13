from uuid import UUID
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db_session
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewResponse, ProductReviewSummary
from app.crud.review import ReviewRepository

router = APIRouter()

def get_review_repo(session: AsyncSession = Depends(get_db_session)) -> ReviewRepository:
    return ReviewRepository(session)

@router.get("/product/{product_id}", response_model=ProductReviewSummary)
async def get_product_reviews(
    product_id: UUID,
    repo: ReviewRepository = Depends(get_review_repo)
) -> Any:
    """
    Public endpoint: Get rating distribution, average score, and reviews for a product.
    """
    return await repo.get_product_summary(product_id)

@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_in: ReviewCreate,
    current_user: User = Depends(get_current_user),
    repo: ReviewRepository = Depends(get_review_repo)
) -> Any:
    """
    Verified Customer Review:
    Only authenticated users who ordered this product with completed/delivered status
    are allowed to submit a review (OWASP A01/A06 business logic validation).
    """
    try:
        review = await repo.create_verified_review(current_user.id, review_in)
        return ReviewResponse(
            id=review.id,
            product_id=review.product_id,
            user_id=review.user_id,
            username=current_user.username,
            order_id=review.order_id,
            rating=review.rating,
            comment=review.comment,
            is_verified_purchase=review.is_verified_purchase,
            created_at=review.created_at
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to submit review: {str(e)}")

@router.delete("/{review_id}", status_code=status.HTTP_200_OK)
async def delete_review(
    review_id: UUID,
    current_user: User = Depends(get_current_user),
    repo: ReviewRepository = Depends(get_review_repo)
) -> Any:
    """
    BOLA/IDOR Protected Deletion:
    Only the author of the review or an administrator can delete the review.
    """
    try:
        await repo.delete_review(review_id, current_user)
        return {"message": "Review deleted successfully"}
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete review: {str(e)}")
