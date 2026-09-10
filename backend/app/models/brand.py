from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from app.models.base import Base
from app.core.utils import generate_uuidv7
from uuid import UUID

class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=generate_uuidv7)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
