#!/bin/bash
echo "Building new ecommerce-frontend:latest image..."
docker build -t ecommerce-frontend:latest ./frontend

if command -v minikube &> /dev/null && minikube status &> /dev/null; then
    echo "Loading image into Minikube..."
    minikube ssh "docker rmi -f ecommerce-frontend:latest 2>/dev/null || true"
    minikube image load --overwrite=true ecommerce-frontend:latest
elif command -v kind &> /dev/null && kind get clusters 2>/dev/null | grep -q 'kind'; then
    echo "Loading image into Kind..."
    kind load docker-image ecommerce-frontend:latest
fi

echo "Rolling out restart for frontend deployment in K8s..."
kubectl rollout restart deployment frontend

echo "Done!"
