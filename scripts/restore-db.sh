#!/usr/bin/env bash
set -euo pipefail

# Script khôi phục database PostgreSQL từ file backup .dump
if [ $# -lt 1 ]; then
    echo "Usage: $0 <path_to_backup_file.dump>"
    echo "Example: $0 ./backups/db_backup_20260910_072000.dump"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file '$BACKUP_FILE' does not exist."
    exit 1
fi

echo "=========================================="
echo " Restoring Database from: $BACKUP_FILE"
echo " WARNING: This will overwrite existing data!"
echo "=========================================="

if kubectl get pod postgres-0 &>/dev/null; then
    echo "Restoring into Kubernetes 'postgres-0'..."
    cat "$BACKUP_FILE" | kubectl exec -i postgres-0 -- env PGPASSWORD=ecommerce_password pg_restore -U ecommerce_user -d ecommerce_db --clean --if-exists -v
    echo "Database restore to Kubernetes pod finished successfully!"
elif docker ps | grep -q 'postgres'; then
    PG_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.ID}}" | head -n 1)
    echo "Restoring into Docker container '$PG_CONTAINER'..."
    cat "$BACKUP_FILE" | docker exec -i -e PGPASSWORD=ecommerce_password "$PG_CONTAINER" pg_restore -U ecommerce_user -d ecommerce_db --clean --if-exists -v
    echo "Database restore to Docker container finished successfully!"
else
    echo "Error: Neither Kubernetes 'postgres-0' nor local Docker container was found."
    exit 1
fi
