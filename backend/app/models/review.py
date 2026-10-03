import enum
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import Integer, ForeignKey, Text, Boolean, UniqueConstraint, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from app.models.base import Base
from app.core.utils import generate_uuidv7


class ModerationStatus(enum.Enum):
    """Moderation status for reviews."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    FLAGGED = "flagged"


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", "order_id", name="uq_user_product_order_review"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=generate_uuidv7)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id: Mapped[UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_verified_purchase: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Moderation fields
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    moderation_status: Mapped[ModerationStatus] = mapped_column(
        SQLEnum(ModerationStatus, name="moderation_status_enum"),
        default=ModerationStatus.PENDING,
        nullable=False,
        index=True
    )
    moderated_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    moderated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    moderation_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    product = relationship("Product")
    user = relationship("User", foreign_keys=[user_id], back_populates="reviews")
    order = relationship("Order")
    moderator = relationship("User", foreign_keys=[moderated_by])
