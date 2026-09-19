@echo off
cd /d "%~dp0\..\..\.."

REM scripts\windows\docker\stop-docker.bat

echo Stopping Premium E-Commerce Platform Docker Compose services...

REM Bring down the containers and remove volumes (including optional profiles)
where docker-compose >nul 2>nul
if %errorlevel% equ 0 (
    docker-compose --profile tailscale down -v 2>nul || docker-compose down -v
) else (
    docker compose --profile tailscale down -v 2>nul || docker compose down -v
)

where tailscale >nul 2>nul
if %errorlevel% equ 0 (
    tailscale serve --tcp=80 off >nul 2>&1
    tailscale serve --tcp=3000 off >nul 2>&1
)

echo Services stopped and volumes removed successfully.
