#!/bin/bash
# stop-k8s.sh

echo "Tearing down Premium E-Commerce Platform from Kubernetes..."

# Delete all resources defined in the k8s directory
kubectl delete -f k8s/

echo "Kubernetes teardown completed."
