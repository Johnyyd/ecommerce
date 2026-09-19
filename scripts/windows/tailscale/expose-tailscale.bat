@echo off
cd /d "%~dp0\..\..\.."
chcp 65001 >nul

REM scripts\windows\tailscale\expose-tailscale.bat - Expose Frontend and Grafana over Tailscale on Windows

echo =======================================================
echo        TAILSCALE REMOTE ACCESS INTEGRATION (WINDOWS)
echo =======================================================
echo.

where tailscale >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Tailscale could not be found. Please install Tailscale on Windows first.
    exit /b 1
)

echo [1/2] Checking Tailscale status...
tailscale status >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Tailscale is not running or logged in. Please run 'tailscale up' first.
    exit /b 1
)

for /f %%i in ('tailscale ip -4 2^>nul') do set TS_IP=%%i

echo OK: Tailscale is active. Tailscale IP: %TS_IP%
echo.

echo [2/2] Configuring Tailscale Serve TCP Forwarding...
tailscale serve --tcp=80 off >nul 2>&1
tailscale serve --tcp=3000 off >nul 2>&1

tailscale serve --bg --tcp 80 tcp://127.0.0.1:80 >nul 2>&1
tailscale serve --bg --tcp 3000 tcp://127.0.0.1:3000 >nul 2>&1

echo OK: Tailscale Serve configured successfully!
echo.
echo =======================================================
echo        ĐỊA CHỈ TRUY CẬP TỪ THIẾT BỊ KHÁC TRÊN TAILSCALE
echo =======================================================
echo.
echo - Frontend: http://%TS_IP%
echo - Grafana:  http://%TS_IP%:3000 (admin / admin)
echo.
echo Để dừng chia sẻ: scripts\windows\tailscale\stop-tailscale.bat
echo.
