@echo off
cd /d "%~dp0\..\.."

echo Building new ecommerce-backend:latest image...
docker build -t ecommerce-backend:latest ./backend

minikube status >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo Loading image into Minikube...
    minikube image load --overwrite=true ecommerce-backend:latest
) ELSE (
    kind get clusters >nul 2>&1
    IF %ERRORLEVEL% EQU 0 (
        echo Loading image into Kind...
        kind load docker-image ecommerce-backend:latest
    ) ELSE (
        echo Refreshing image cache in containerd...
        kubectl delete pod image-cleaner --ignore-not-found=true >nul 2>&1
        kubectl apply -f k8s/cleaner.yaml >nul 2>&1
        kubectl wait --for=condition=Ready pod/image-cleaner --timeout=15s >nul 2>&1
    )
)

echo Running Database Migration Job in K8s...
kubectl delete job db-migration-job --ignore-not-found=true
kubectl apply -f k8s/migration-job.yaml
kubectl wait --for=condition=complete job/db-migration-job --timeout=60s >nul 2>&1

echo Rolling out restart for backend and worker deployments in K8s...
kubectl apply -f k8s/worker.yaml
kubectl rollout restart deployment backend
kubectl rollout restart deployment worker

echo Done!
