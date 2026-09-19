#!/bin/bash
cd "$(dirname "$0")/../.."

echo "Building new ecommerce-backend:latest image..."
docker build -t ecommerce-backend:latest ./backend

if command -v minikube &> /dev/null && minikube status &> /dev/null; then
    echo "Loading image into Minikube..."
    minikube ssh "docker rmi -f ecommerce-backend:latest 2>/dev/null || true"
    minikube image load --overwrite=true ecommerce-backend:latest
elif command -v kind &> /dev/null && kind get clusters 2>/dev/null | grep -q 'kind'; then
    echo "Loading image into Kind..."
    kind load docker-image ecommerce-backend:latest
fi

echo "Running Database Migration Job..."
kubectl delete job db-migration-job --ignore-not-found=true
kubectl apply -f k8s/migration-job.yaml
kubectl wait --for=condition=complete job/db-migration-job --timeout=60s 2>/dev/null || echo "Migration job in progress or completed."

echo "Rolling out restart for backend and worker deployment in K8s..."
kubectl apply -f k8s/worker.yaml
kubectl rollout restart deployment backend
kubectl rollout restart deployment worker

echo "Done!"

