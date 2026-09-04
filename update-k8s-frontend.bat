@echo off
echo Building new ecommerce-frontend image...
docker build --no-cache -t ecommerce-frontend:latest ./frontend

echo Rolling out restart for frontend deployment in K8s...
kubectl rollout restart deployment frontend

echo Done!
