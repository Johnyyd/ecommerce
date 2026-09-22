"""add_search_and_embedding_columns

Revision ID: 011
Revises: hh0c1d2e3f5b
Create Date: 2026-09-20 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PGUUID, TSVECTOR
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = '011'
down_revision: Union[str, Sequence[str], None] = 'hh0c1d2e3f5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 0. Enable required PostgreSQL extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')

    # 1. Add tsvector and vector columns to products table idempotently
    op.execute('ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector TSVECTOR')
    op.execute('ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(1536)')

    # 2. Create GIN index on search_vector
    op.execute(
        'CREATE INDEX IF NOT EXISTS idx_products_search_vector '
        'ON products USING GIN (search_vector)'
    )

    # 3. Create IVFFlat index on embedding (for vector similarity search)
    op.execute('''
        CREATE INDEX IF NOT EXISTS idx_products_embedding
        ON products USING ivfflat (embedding vector_l2_ops)
        WITH (lists = 100)
    ''')

    # 4. Create failed_sync_tasks table (Dead Letter Queue for sync operations)
    op.execute('''
        CREATE TABLE IF NOT EXISTS failed_sync_tasks (
            id SERIAL PRIMARY KEY,
            product_id UUID NOT NULL,
            attempt INTEGER NOT NULL DEFAULT 1,
            max_attempts INTEGER NOT NULL DEFAULT 3,
            error TEXT NOT NULL,
            error_type VARCHAR(100) NOT NULL,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            resolved_at TIMESTAMPTZ,
            resolved_by VARCHAR(100),
            details JSON
        )
    ''')
    op.execute('CREATE INDEX IF NOT EXISTS ix_failed_sync_product_attempt ON failed_sync_tasks (product_id, attempt)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_failed_sync_unresolved ON failed_sync_tasks (product_id) WHERE resolved_at IS NULL')

    # 5. Create backfill_jobs table (progress tracking for data migration)
    op.execute('''
        CREATE TABLE IF NOT EXISTS backfill_jobs (
            id SERIAL PRIMARY KEY,
            job_name VARCHAR(100) NOT NULL UNIQUE,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            total_items INTEGER,
            processed_items INTEGER NOT NULL DEFAULT 0,
            failed_items INTEGER NOT NULL DEFAULT 0,
            started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            completed_at TIMESTAMPTZ,
            progress_json JSON,
            CONSTRAINT ck_backfill_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
        )
    ''')

    # 6. Update search_vector from existing data (materialize tsvector)
    op.execute('''
        UPDATE products
        SET search_vector = setweight(to_tsvector('simple', COALESCE(name, '')), 'A')
        WHERE search_vector IS NULL
    ''')


def downgrade() -> None:
    # 5. Drop backfill_jobs table
    op.drop_table('backfill_jobs')

    # 4. Drop failed_sync_tasks table
    op.drop_table('failed_sync_tasks')

    # 3. Drop IVFFlat index on embedding
    op.drop_index('idx_products_embedding', 'products')

    # 2. Drop GIN index on search_vector
    op.drop_index('idx_products_search_vector', 'products')

    # 1. Remove vector & search_vector columns from products
    op.drop_column('products', 'embedding')
    op.drop_column('products', 'search_vector')