#!/bin/sh

if [ "$APP_TYPE" = "worker" ]; then
    echo "Starting Enterprise ARQ background worker..."
    export DATABASE_URL="postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_SERVER}:${POSTGRES_PORT}/${POSTGRES_DB}"
    exec python -m arq app.worker.WorkerSettings
fi

# Calculate workers based on WEB_CONCURRENCY or CPU limits
if [ -n "$WEB_CONCURRENCY" ]; then
    WORKERS="$WEB_CONCURRENCY"
elif [ -n "$CPU_LIMIT" ]; then
    WORKERS=$(($CPU_LIMIT * 4 + 1))
else
    WORKERS=5
fi
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
