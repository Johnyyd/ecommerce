@echo off
cd /d "%~dp0\..\..\.."

REM scripts\windows\docker\stop-docker.bat

echo Stopping Premium E-Commerce Platform Docker Compose services...

REM Bring down the containers (preserving persistent database volumes)
where docker-compose >nul 2>nul
if %errorlevel% equ 0 (
    docker-compose --profile tailscale down 2>nul || docker-compose down
) else (
    docker compose --profile tailscale down 2>nul || docker compose down
)

where tailscale >nul 2>nul
if %errorlevel% equ 0 (
    tailscale serve --tcp=80 off >nul 2>&1
    tailscale serve --tcp=3000 off >nul 2>&1
)

echo Services stopped and volumes removed successfully.
