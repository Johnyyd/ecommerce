@echo off
cd /d "%~dp0\..\..\.."

REM scripts\windows\k8s\stop-k8s.bat

echo Tearing down Premium E-Commerce Platform from Kubernetes...

REM Delete all resources defined in the k8s directory
kubectl delete -f k8s/

echo Kubernetes teardown completed.
