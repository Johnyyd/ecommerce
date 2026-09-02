#!/bin/bash
echo "Building new ecommerce-backend image..."
docker build -t ecommerce-backend ./backend

echo "Rolling out restart for backend deployment in K8s..."
kubectl rollout restart deployment backend

echo "Done!"
