#!/bin/bash
# start-k8s.sh

echo "Deploying Premium E-Commerce Platform to Kubernetes..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "kubectl could not be found. Please install it to continue."
    exit 1
fi

# Check if Kubernetes cluster is reachable
if ! kubectl cluster-info &> /dev/null; then
    echo "Error: Cannot connect to a Kubernetes cluster."
    echo "Please start a local Kubernetes cluster (e.g., minikube start or kind create cluster) before running this script."
    exit 1
fi

# Create secrets from .env file
if [ -f .env ]; then
    echo "Creating Kubernetes secrets from .env..."
    kubectl create secret generic app-secrets --from-env-file=.env --dry-run=client -o yaml | kubectl apply -f -
    kubectl create secret generic db-secrets --from-env-file=.env --dry-run=client -o yaml | kubectl apply -f -
else
    echo "WARNING: .env file not found. Secrets will not be created."
fi

# Apply all manifests in the k8s directory
kubectl apply -f k8s/

echo "Kubernetes deployment started."
echo "Check the status of your pods with: kubectl get pods"
