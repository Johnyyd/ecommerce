@echo off
cd /d "%~dp0\..\..\.."
chcp 65001 >nul

REM scripts\windows\docker\start-docker-tailscale.bat - Start Docker Compose with Tailscale profile

echo Starting Premium E-Commerce Platform with Tailscale integration...

if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
    )
)

where docker-compose >nul 2>nul
if %errorlevel% equ 0 (
    docker-compose --profile tailscale up --build -d
) else (
    docker compose --profile tailscale up --build -d
)

echo Services started with Tailscale!
echo Local: Frontend (http://localhost:80), Grafana (http://localhost:3000)
echo.
echo Kiểm tra log Tailscale container nếu cần link đăng nhập:
echo   docker logs tailscale
echo.
