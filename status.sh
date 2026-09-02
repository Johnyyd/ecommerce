#!/bin/bash
# status.sh

echo "======================================================="
echo "    PREMIUM E-COMMERCE PLATFORM - SYSTEM STATUS"
echo "======================================================="
echo ""

echo "[1/2] DOCKER COMPOSE STATUS"
echo "-------------------------------------------------------"
if command -v docker-compose &> /dev/null; then
    docker-compose ps
else
    echo "docker-compose is not installed or not in PATH."
fi
echo ""

echo "[2/2] KUBERNETES STATUS"
echo "-------------------------------------------------------"
if command -v kubectl &> /dev/null; then
    echo "--- Nodes ---"
    kubectl get nodes
    echo ""
    echo "--- All Resources (Pods, Services, Deployments) ---"
    kubectl get all
    echo ""
    echo "--- Ingress ---"
    kubectl get ingress
else
    echo "kubectl is not installed or not in PATH."
fi
echo ""
echo "======================================================="
echo "                  STATUS COMPLETE"
echo "======================================================="
