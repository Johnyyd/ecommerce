@echo off
cd /d "%~dp0\..\..\.."

REM scripts\windows\k8s\stop-k8s.bat

echo Tearing down Premium E-Commerce Platform from Kubernetes...

REM Delete all resources defined in the k8s directory
kubectl delete -f k8s/ --ignore-not-found=true

where tailscale >nul 2>nul
if %errorlevel% equ 0 (
    tailscale serve --tcp=80 off >nul 2>&1
    tailscale serve --tcp=3000 off >nul 2>&1
)

echo Kubernetes teardown completed.
