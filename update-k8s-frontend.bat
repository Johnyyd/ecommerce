@echo off
echo Building new ecommerce-frontend image...
docker build -t ecommerce-frontend ./frontend

echo Rolling out restart for frontend deployment in K8s...
kubectl rollout restart deployment frontend

echo Done!
