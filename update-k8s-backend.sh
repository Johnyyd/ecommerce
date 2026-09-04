#!/bin/bash
echo "Building new ecommerce-backend:latest image..."
docker build -t ecommerce-backend:latest ./backend

echo "Rolling out restart for backend deployment in K8s..."
kubectl rollout restart deployment backend

echo "Done!"
