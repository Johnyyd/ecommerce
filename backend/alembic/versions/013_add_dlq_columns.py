"""add_dlq_columns

Revision ID: 013
Revises: 012
Create Date: 2026-10-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '013'
down_revision: Union[str, Sequence[str], None] = '012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add task_type column with enum type
    op.execute("""
        CREATE TYPE synctasktype AS ENUM ('sync', 'delete', 'embedding')
    """)

    # Add task_type column with default 'sync'
    op.add_column(
        'failed_sync_tasks',
        sa.Column('task_type', sa.Enum('sync', 'delete', 'embedding', name='synctasktype'),
                  nullable=False, server_default='sync')
    )

    # Add payload column for richer DLQ context
    op.add_column(
        'failed_sync_tasks',
        sa.Column('payload', sa.JSON(), nullable=True)
    )

    # Create index on task_type
    op.create_index(
        'ix_failed_sync_task_type',
        'failed_sync_tasks',
        ['task_type']
    )


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_failed_sync_task_type', 'failed_sync_tasks')

    # Drop columns
    op.drop_column('failed_sync_tasks', 'payload')
    op.drop_column('failed_sync_tasks', 'task_type')

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS synctasktype")