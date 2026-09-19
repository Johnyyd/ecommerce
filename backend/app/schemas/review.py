from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict, Field

class ReviewCreate(BaseModel):
    product_id: UUID
    order_id: UUID
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")
    comment: Optional[str] = Field(None, max_length=2000, description="Customer review commentary")

class ReviewResponse(BaseModel):
    id: UUID
    product_id: UUID
    user_id: UUID
    username: Optional[str] = None
    order_id: UUID
    rating: int
    comment: Optional[str] = None
    is_verified_purchase: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ProductReviewSummary(BaseModel):
    average_rating: float
    total_reviews: int
    rating_distribution: Dict[int, int]
    reviews: List[ReviewResponse] = []

class AdminReviewResponse(BaseModel):
    id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    user_id: UUID
    username: Optional[str] = None
    user_email: Optional[str] = None
    order_id: UUID
    rating: int
    comment: Optional[str] = None
    is_verified_purchase: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
