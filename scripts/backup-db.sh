#!/usr/bin/env bash
set -euo pipefail

# Script sao lưu database PostgreSQL thủ công (chạy qua kubectl hoặc docker)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/db_backup_${TIMESTAMP}.dump"

echo "=========================================="
echo " Starting Database Backup: $BACKUP_FILE"
echo "=========================================="

if kubectl get pod postgres-0 &>/dev/null; then
    echo "Found Kubernetes pod 'postgres-0'. Running pg_dump inside pod..."
    kubectl exec postgres-0 -- env PGPASSWORD=ecommerce_password pg_dump -U ecommerce_user -d ecommerce_db -F c -b > "$BACKUP_FILE"
    echo "Backup completed: $BACKUP_FILE (Size: $(du -sh "$BACKUP_FILE" | cut -f1))"
elif docker ps | grep -q 'postgres'; then
    PG_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.ID}}" | head -n 1)
    echo "Found local Docker container '$PG_CONTAINER'. Running pg_dump..."
    docker exec -e PGPASSWORD=ecommerce_password "$PG_CONTAINER" pg_dump -U ecommerce_user -d ecommerce_db -F c -b > "$BACKUP_FILE"
    echo "Backup completed: $BACKUP_FILE (Size: $(du -sh "$BACKUP_FILE" | cut -f1))"
else
    echo "Error: Neither Kubernetes 'postgres-0' nor local Docker container was found."
    exit 1
fi

echo "Database backup finished successfully!"
