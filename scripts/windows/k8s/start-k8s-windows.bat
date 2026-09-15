@echo off
cd /d "%~dp0\..\..\.."

chcp 65001 >nul
REM start-k8s-windows.bat - Automated local Kubernetes deployment for Windows

echo =======================================================
echo    PREMIUM E-COMMERCE - KUBERNETES AUTOMATION (WINDOWS)
echo =======================================================
echo.

REM 1. Check if kubectl is available
echo [1/7] Checking kubectl...
where kubectl >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] kubectl could not be found. Please install it to continue.
    exit /b 1
)
echo OK: kubectl is available.

REM 2. Stop Docker Compose (Avoid Port Conflicts)
echo [2/7] Stopping Docker Compose to avoid port conflicts...
where docker-compose >nul 2>nul
if %errorlevel% equ 0 (
    docker-compose down 2>nul
) else (
    docker compose down 2>nul
)
echo OK: Docker Compose stopped.

REM 3. Environment & Secrets
echo [3/7] Preparing environment variables and secrets...
if not exist ".env" (
    if exist ".env.example" (
        echo Creating .env from .env.example...
        copy .env.example .env >nul
    ) else (
        echo [WARNING] .env file not found.
    )
)

if exist ".env" (
    kubectl create secret generic app-secrets --from-env-file=.env --dry-run=client -o yaml | kubectl apply -f -
    kubectl create secret generic db-secrets --from-env-file=.env --dry-run=client -o yaml | kubectl apply -f -
    echo OK: Secrets applied.
)

REM 4. Fix line endings for Linux scripts (Windows CRLF issue)
echo [4/7] Fixing line endings for .sh files (CRLF to LF)...
python -c "import os; [open(os.path.join(d, f), 'wb').write(c) for d, _, fs in os.walk('.') if '.git' not in d for f in fs if f.endswith('.sh') for c in [open(os.path.join(d, f), 'rb').read().replace(b'\r\n', b'\n')]]" >nul 2>&1
echo OK: Line endings normalized.

REM 5. Build Docker Images
echo [5/7] Building Docker images...
docker build -t ecommerce-backend:latest ./backend
docker build -t ecommerce-frontend:latest ./frontend
echo OK: Docker images built.

REM 6. Clean up old resources
echo [6/7] Cleaning up old jobs and resources...
kubectl delete job db-migration-job --ignore-not-found=true
kubectl delete pod image-cleaner --ignore-not-found=true

REM Clean up Released Persistent Volumes (if any)
for /f "tokens=1,5" %%i in ('kubectl get pv --no-headers 2^>nul') do (
    if "%%j"=="Released" (
        kubectl delete pv %%i >nul 2>&1
    )
)
echo OK: Old jobs and resources removed.

REM 7. Apply Kubernetes Manifests
echo [7/7] Applying Kubernetes manifests (k8s/)...
kubectl apply -f k8s/

echo.
echo =======================================================
echo          KUBERNETES DEPLOYMENT COMPLETED!              
echo =======================================================
echo.
echo Để theo dõi trạng thái các Pod và Service, chạy:
echo    scripts\windows\status.bat
echo hoặc:
echo    kubectl get pods -w
echo.
echo Cách truy cập ứng dụng trên Kubernetes (Docker Desktop / Docker):
echo - Frontend (Website): http://localhost
echo - Backend (API Docs): http://localhost:8000/docs
echo - Grafana (Monitoring): http://localhost:3000
echo   (Đăng nhập mặc định Grafana: admin / admin)
echo.
