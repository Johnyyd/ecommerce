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
    )
)

echo Rolling out restart for backend deployment in K8s...
kubectl rollout restart deployment backend

echo Done!
