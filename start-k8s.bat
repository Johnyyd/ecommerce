@echo off
REM start-k8s.bat

echo Deploying Premium E-Commerce Platform to Kubernetes...

REM Check if kubectl is available
where kubectl >nul 2>nul
if %errorlevel% neq 0 (
    echo kubectl could not be found. Please install it to continue.
    exit /b 1
)

REM Create secrets from .env file
if exist ".env" (
    echo Creating Kubernetes secrets from .env...
    kubectl create secret generic app-secrets --from-env-file=.env --dry-run=client -o yaml | kubectl apply -f -
    kubectl create secret generic db-secrets --from-env-file=.env --dry-run=client -o yaml | kubectl apply -f -
) else (
    echo WARNING: .env file not found. Secrets will not be created.
)

REM Apply all manifests in the k8s directory
kubectl apply -f k8s/

echo Kubernetes deployment started.
echo Check the status of your pods with: kubectl get pods
