#!/bin/bash
# start-docker.sh

echo "Starting Premium E-Commerce Platform via Docker Compose..."

# Check if .env exists, if not, copy from .env.example
if [ ! -f .env ]; then
  echo "No .env file found. Creating one from .env.example..."
  cp .env.example .env
fi

# Build and start the containers in detached mode
docker-compose up --build -d

echo "Services started successfully!"
echo "Backend API is available at http://localhost:8000"
echo "Frontend is available at http://localhost:80"
echo "Prometheus is available at http://localhost:9090"
echo "Grafana Dashboard is available at http://localhost:3000 (Default: admin / admin)"
