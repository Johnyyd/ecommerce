#!/bin/sh

# Calculate workers based on CPU limits
# If CPU_LIMIT is not set, default to 1
if [ -z "$CPU_LIMIT" ]; then
    CPU_LIMIT=1
fi

WORKERS=$(($CPU_LIMIT * 4 + 1))
echo "Starting Gunicorn with $WORKERS workers..."

# Set DATABASE_URL for Alembic to connect directly to Postgres
export DATABASE_URL="postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
# Run database migrations
alembic -c alembic.ini upgrade head
# Reset DATABASE_URL for the app (using pgbouncer)
export DATABASE_URL="postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_SERVER}:${POSTGRES_PORT}/${POSTGRES_DB}"
exec gunicorn app.main:app \
    -k uvicorn.workers.UvicornWorker \
    --workers $WORKERS \
    --timeout 120 \
    --keep-alive 5 \
    --bind 0.0.0.0:8000
