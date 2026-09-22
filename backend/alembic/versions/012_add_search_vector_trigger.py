"""add_search_vector_trigger

Revision ID: 012
Revises: 011
Create Date: 2026-09-20 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '012'
down_revision: Union[str, Sequence[str], None] = '011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create function to auto-update search_vector on insert/update (with explicit search_path for CWE-426 safety)
    op.execute('''
        CREATE OR REPLACE FUNCTION products_search_vector_update()
        RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
                setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
                setweight(to_tsvector('simple', COALESCE(NEW.brand, '')), 'C');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql SET search_path = public, pg_catalog;
    ''')

    # Drop trigger if exists and recreate with column filter (only recalculate when text changes)

    op.execute('DROP TRIGGER IF EXISTS trigger_products_search_vector ON products')
    op.execute('''
        CREATE TRIGGER trigger_products_search_vector
        BEFORE INSERT OR UPDATE OF name, description, brand ON products
        FOR EACH ROW EXECUTE FUNCTION products_search_vector_update()
    op.execute('''
        DROP TRIGGER IF EXISTS trigger_products_search_vector ON products;
        CREATE TRIGGER trigger_products_search_vector
        BEFORE INSERT OR UPDATE OF name, description, brand ON products
        FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();
    ''')

    # Re-populate search_vector for existing rows using the new function logic
    op.execute('''
        UPDATE products
        SET search_vector =
            setweight(to_tsvector('simple', COALESCE(name, '')), 'A') ||
            setweight(to_tsvector('simple', COALESCE(description, '')), 'B') ||
            setweight(to_tsvector('simple', COALESCE(brand, '')), 'C')
        WHERE search_vector IS NULL
    ''')


def downgrade() -> None:
    # Drop trigger
    op.execute('DROP TRIGGER IF EXISTS trigger_products_search_vector ON products')

    # Drop function
    op.execute('DROP FUNCTION IF EXISTS products_search_vector_update()')