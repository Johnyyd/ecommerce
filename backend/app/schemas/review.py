from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict, Field
from enum import Enum


class ModerationStatus(str, Enum):
    """Moderation status for reviews."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    FLAGGED = "flagged"


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
    is_approved: bool = False
    moderation_status: ModerationStatus = ModerationStatus.PENDING
    moderated_by: Optional[UUID] = None
    moderated_at: Optional[datetime] = None
    moderation_note: Optional[str] = None
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
    is_approved: bool = False
    moderation_status: ModerationStatus = ModerationStatus.PENDING
    moderated_by: Optional[UUID] = None
    moderated_at: Optional[datetime] = None
    moderation_note: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReviewModerateRequest(BaseModel):
    """Request to moderate a review (approve/reject/flag)."""
    action: str = Field(..., pattern="^(approve|reject|flag)$")
    moderation_note: Optional[str] = Field(None, max_length=1000)
