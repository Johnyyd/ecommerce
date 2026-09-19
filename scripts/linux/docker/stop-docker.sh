#!/bin/bash
cd "$(dirname "$0")/../../.."

# scripts/linux/docker/stop-docker.sh

echo "Stopping Premium E-Commerce Platform Docker Compose services..."

# Bring down the containers (preserving persistent database volumes)
if command -v docker-compose &> /dev/null; then
    docker-compose --profile tailscale down 2>/dev/null || docker-compose down
elif docker compose version &> /dev/null; then
    docker compose --profile tailscale down 2>/dev/null || docker compose down
fi

# Stop Tailscale serve mappings if active
if command -v tailscale &> /dev/null; then
    tailscale serve --tcp=80 off 2>/dev/null || true
    tailscale serve --tcp=3000 off 2>/dev/null || true
fi

echo "Services stopped and volumes removed successfully."
