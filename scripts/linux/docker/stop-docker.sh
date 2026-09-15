#!/bin/bash
cd "$(dirname "$0")/../../.."

# scripts/linux/docker/stop-docker.sh

echo "Stopping Premium E-Commerce Platform Docker Compose services..."

# Bring down the containers and remove volumes
docker-compose down -v

echo "Services stopped and volumes removed successfully."
