"""add_stock_non_negative_check_constraint

Revision ID: gg9b0c2e3f4a
Revises: ff8a9b0c2e3f
Create Date: 2026-09-17 12:47:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'gg9b0c2e3f4a'
down_revision: Union[str, Sequence[str], None] = 'ff8a9b0c2e3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_check_constraint(
        'check_stock_quantity_non_negative',
        'products',
        'stock_quantity >= 0'
    )

def downgrade() -> None:
    op.drop_constraint(
        'check_stock_quantity_non_negative',
        'products',
        type_='check'
    )
