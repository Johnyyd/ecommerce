"""Add review moderation fields

Revision ID: 014_add_review_moderation_fields
Revises: 013_add_dlq_columns
Create Date: 2026-10-03 05:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '014_add_review_moderation_fields'
down_revision = '013_add_dlq_columns'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type for moderation status
    moderation_status_enum = postgresql.ENUM(
        'pending', 'approved', 'rejected', 'flagged',
        name='moderation_status_enum',
        create_type=True
    )
    moderation_status_enum.create(op.get_bind(), checkfirst=True)

    # Add moderation columns to reviews table
    op.add_column('reviews', sa.Column('is_approved', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('reviews', sa.Column('moderation_status', moderation_status_enum, nullable=False, server_default=sa.text("'pending'")))
    op.add_column('reviews', sa.Column('moderated_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('reviews', sa.Column('moderated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('reviews', sa.Column('moderation_note', sa.Text(), nullable=True))

    # Add foreign key for moderated_by
    op.create_foreign_key(
        'fk_reviews_moderated_by_users',
        'reviews', 'users',
        ['moderated_by'], ['id'],
        ondelete='SET NULL'
    )

    # Add index on moderation_status for filtering
    op.create_index('ix_reviews_moderation_status', 'reviews', ['moderation_status'])

    # Add index on is_approved for quick filtering
    op.create_index('ix_reviews_is_approved', 'reviews', ['is_approved'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_reviews_is_approved', table_name='reviews')
    op.drop_index('ix_reviews_moderation_status', table_name='reviews')

    # Drop foreign key
    op.drop_constraint('fk_reviews_moderated_by_users', 'reviews', type_='foreignkey')

    # Drop columns
    op.drop_column('reviews', 'moderation_note')
    op.drop_column('reviews', 'moderated_at')
    op.drop_column('reviews', 'moderated_by')
    op.drop_column('reviews', 'moderation_status')
    op.drop_column('reviews', 'is_approved')

    # Drop enum type
    moderation_status_enum = postgresql.ENUM(
        'pending', 'approved', 'rejected', 'flagged',
        name='moderation_status_enum'
    )
    moderation_status_enum.drop(op.get_bind(), checkfirst=True)