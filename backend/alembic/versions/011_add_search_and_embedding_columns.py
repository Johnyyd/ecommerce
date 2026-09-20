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

    # 1. Add tsvector and vector columns to products table (nullable for zero-downtime)
    op.add_column(
        'products',
        sa.Column(
            'search_vector',
            TSVECTOR(),
            nullable=True,
            comment='PostgreSQL tsvector for Full-Text Search'
        ),
    )
    op.add_column(
        'products',
        sa.Column(
            'embedding',
            Vector(1536),
            nullable=True,
            comment='pgvector embedding vector (1536 dimensions for text-embedding-3-small)'
        ),
    )

    # 2. Create GIN index on search_vector concurrently (fast on large tables)
    # CONCURRENTLY cannot run inside a transaction, so we commit first
    op.execute('COMMIT')
    op.execute(
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search_vector '
        'ON products USING GIN (search_vector)'
    )
    op.execute('BEGIN')

    # 3. Create IVFFlat index on embedding (for vector similarity search)
    # lists = sqrt(number of vectors) ≈ 100 for 10K products
    op.execute('COMMIT')
    op.execute(
        '''
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_embedding
        ON products USING ivfflat (embedding vector_l2_ops)
        WITH (lists = 100)
        '''
    )
    op.execute('BEGIN')

    # 4. Create failed_sync_tasks table (Dead Letter Queue for sync operations)
    op.create_table(
        'failed_sync_tasks',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('product_id', PGUUID(as_uuid=True), nullable=False),
        sa.Column('attempt', sa.Integer(), nullable=False, default=1),
        sa.Column('max_attempts', sa.Integer(), nullable=False, default=3),
        sa.Column('error', sa.Text(), nullable=False),
        sa.Column('error_type', sa.String(100), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', sa.String(100), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Index('ix_failed_sync_product_attempt', 'product_id', 'attempt'),
        sa.Index(
            'ix_failed_sync_unresolved',
            'product_id',
            postgresql_where=sa.text('resolved_at IS NULL')
        ),
    )

    # 5. Create backfill_jobs table (progress tracking for data migration)
    op.create_table(
        'backfill_jobs',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('job_name', sa.String(100), nullable=False, unique=True),
        sa.Column('status', sa.String(20), nullable=False, default='pending'),
        sa.Column('total_items', sa.Integer(), nullable=True),
        sa.Column('processed_items', sa.Integer(), nullable=False, default=0),
        sa.Column('failed_items', sa.Integer(), nullable=False, default=0),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('progress_json', sa.JSON(), nullable=True),
        sa.CheckConstraint("status IN ('pending', 'running', 'completed', 'failed')", name='ck_backfill_status'),
    )

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