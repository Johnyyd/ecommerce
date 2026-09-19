"""add_shipping_and_completion_fields_to_orders

Revision ID: hh0c1d2e3f5b
Revises: gg9b0c2e3f4a
Create Date: 2026-09-19 15:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'hh0c1d2e3f5b'
down_revision: Union[str, Sequence[str], None] = 'gg9b0c2e3f4a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('orders', sa.Column('tracking_code', sa.String(length=100), nullable=True))
    op.add_column('orders', sa.Column('shipping_provider', sa.String(length=50), nullable=False, server_default='GHN'))
    op.add_column('orders', sa.Column('shipping_fee', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0.0'))
    op.add_column('orders', sa.Column('estimated_delivery', sa.String(length=100), nullable=True))
    op.add_column('orders', sa.Column('shipping_status', sa.String(length=50), nullable=True, server_default='PENDING'))
    op.add_column('orders', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))

def downgrade() -> None:
    op.drop_column('orders', 'completed_at')
    op.drop_column('orders', 'shipping_status')
    op.drop_column('orders', 'estimated_delivery')
    op.drop_column('orders', 'shipping_fee')
    op.drop_column('orders', 'shipping_provider')
    op.drop_column('orders', 'tracking_code')
