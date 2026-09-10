from sqlalchemy import String, Numeric, Integer, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from app.models.base import Base
from app.core.utils import generate_uuidv7
from uuid import UUID
from datetime import datetime

class Voucher(Base):
    __tablename__ = "vouchers"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=generate_uuidv7)
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    discount_type: Mapped[str] = mapped_column(String(20), default="PERCENTAGE", nullable=False) # PERCENTAGE or FIXED
    discount_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    min_order_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    max_discount_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    usage_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    times_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
