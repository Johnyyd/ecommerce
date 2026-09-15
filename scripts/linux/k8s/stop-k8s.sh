#!/bin/bash
cd "$(dirname "$0")/../../.."

# scripts/linux/k8s/stop-k8s.sh

echo "Tearing down Premium E-Commerce Platform from Kubernetes..."

if ! command -v kubectl &> /dev/null; then
    echo "kubectl could not be found."
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo "Kubernetes cluster is not running or not reachable."
    exit 0
fi

# Delete all resources defined in the k8s directory
kubectl delete -f k8s/ --ignore-not-found=true

# Stop Tailscale serve mappings if active
if command -v tailscale &> /dev/null; then
    tailscale serve --tcp=80 off 2>/dev/null || true
    tailscale serve --tcp=3000 off 2>/dev/null || true
fi

echo "Kubernetes teardown completed."
