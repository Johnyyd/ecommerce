#!/bin/bash
echo "Building new ecommerce-backend:latest image..."
docker build -t ecommerce-backend:latest ./backend

if command -v minikube &> /dev/null && minikube status &> /dev/null; then
    echo "Loading image into Minikube..."
    minikube image load ecommerce-backend:latest
elif command -v kind &> /dev/null && kind get clusters 2>/dev/null | grep -q 'kind'; then
    echo "Loading image into Kind..."
    kind load docker-image ecommerce-backend:latest
fi

echo "Rolling out restart for backend deployment in K8s..."
kubectl rollout restart deployment backend

echo "Done!"
