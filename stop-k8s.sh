#!/bin/bash
# stop-k8s.sh

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

echo "Kubernetes teardown completed."
