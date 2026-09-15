#!/bin/bash
cd "$(dirname "$0")/../../.."

# scripts/linux/docker/start-docker-tailscale.sh - Start Docker Compose with Tailscale container

echo "Starting Premium E-Commerce Platform with Tailscale integration..."

# Check if .env exists, if not, copy from .env.example
if [ ! -f .env ]; then
  echo "No .env file found. Creating one from .env.example..."
  cp .env.example .env
fi

# Start Docker Compose with the tailscale profile
if command -v docker-compose &> /dev/null; then
  docker-compose --profile tailscale up --build -d
elif docker compose version &> /dev/null; then
  docker compose --profile tailscale up --build -d
fi

echo ""
echo "Services started with Tailscale container!"
echo "Local access:"
echo " - Frontend:  http://localhost:80"
echo " - Backend:   http://localhost:8000"
echo " - Grafana:   http://localhost:3000 (admin / admin)"
echo ""
echo "Tailscale Container status:"
docker ps --filter "name=tailscale"
echo ""
echo "Nếu chưa cấu hình TS_AUTHKEY trong .env, hãy xem log container để lấy link xác thực:"
echo "  docker logs tailscale"
echo ""
