from sqlalchemy import String, Integer, ForeignKey, Numeric, Float, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID, TSVECTOR
from app.models.base import Base
from app.core.utils import generate_uuidv7
from uuid import UUID

from pgvector.sqlalchemy import Vector

class Category(Base):
    __tablename__ = "categories"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=generate_uuidv7)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    parent_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)

class Product(Base):
    __tablename__ = "products"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=generate_uuidv7)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    category_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    brand: Mapped[str] = mapped_column(String(100), nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    image_url: Mapped[str] = mapped_column(String, nullable=True)
    search_vector: Mapped[str] = mapped_column(TSVECTOR, nullable=True, comment="PostgreSQL tsvector for Full-Text Search")
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=True, comment="pgvector embedding vector (1536 dimensions)")

    category = relationship("Category")

    __table_args__ = (
        CheckConstraint("stock_quantity >= 0", name="check_stock_quantity_non_negative"),
        Index("idx_products_search_vector", "search_vector", postgresql_using="gin"),
        Index("idx_products_embedding", "embedding", postgresql_using="ivfflat", postgresql_with={"lists": 100}, postgresql_ops={"embedding": "vector_l2_ops"}),
    )

    __mapper_args__ = {
        "version_id_col": version
    }

