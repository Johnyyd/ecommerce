from datetime import datetime
from uuid import UUID
from typing import Optional, Any
from sqlalchemy import String, Integer, DateTime, Text, Index, CheckConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.sql import func
from app.models.base import Base


class FailedSyncTask(Base):
    __tablename__ = "failed_sync_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    error: Mapped[str] = mapped_column(Text, nullable=False)
    error_type: Mapped[str] = mapped_column(String(100), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    details: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_failed_sync_product_attempt", "product_id", "attempt"),
        Index("ix_failed_sync_unresolved", "product_id", postgresql_where="resolved_at IS NULL"),
    )


class BackfillJob(Base):
    __tablename__ = "backfill_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    total_items: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    processed_items: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_items: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    progress_json: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'running', 'completed', 'failed')", name="ck_backfill_status"),
    )
