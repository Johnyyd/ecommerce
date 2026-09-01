from sqlalchemy import String, Boolean, Index, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from app.models.base import Base
from app.core.utils import generate_uuidv7
from uuid import UUID

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=generate_uuidv7)
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    __table_args__ = (
        Index("ix_users_email_unique", "email", unique=True, postgresql_where=text("deleted_at IS NULL")),
        Index("ix_users_username_unique", "username", unique=True, postgresql_where=text("deleted_at IS NULL")),
    )
