@echo off
REM status.bat

echo =======================================================
echo     PREMIUM E-COMMERCE PLATFORM - SYSTEM STATUS
echo =======================================================
echo.

echo [1/2] DOCKER COMPOSE STATUS
echo -------------------------------------------------------
where docker-compose >nul 2>nul
if %errorlevel% equ 0 (
    docker-compose ps
) else (
    echo docker-compose is not installed or not in PATH.
)
echo.

echo [2/2] KUBERNETES STATUS
echo -------------------------------------------------------
where kubectl >nul 2>nul
if %errorlevel% equ 0 (
    echo --- Nodes ---
    kubectl get nodes
    echo.
    echo --- All Resources ---
    kubectl get all
    echo.
    echo --- Ingress ---
    kubectl get ingress
) else (
    echo kubectl is not installed or not in PATH.
)
echo.
echo =======================================================
echo                   STATUS COMPLETE
echo =======================================================
