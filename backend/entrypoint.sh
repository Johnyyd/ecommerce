#!/bin/sh

# Calculate workers based on CPU limits
# If CPU_LIMIT is not set, default to 1
if [ -z "$CPU_LIMIT" ]; then
    CPU_LIMIT=1
fi

WORKERS=$(($CPU_LIMIT * 4 + 1))
echo "Starting Gunicorn with $WORKERS workers..."

exec gunicorn app.main:app \
    -k uvicorn.workers.UvicornWorker \
    --workers $WORKERS \
    --timeout 120 \
    --keep-alive 5 \
    --bind 0.0.0.0:8000
