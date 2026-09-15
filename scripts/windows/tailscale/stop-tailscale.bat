@echo off
cd /d "%~dp0\..\..\.."
chcp 65001 >nul

REM scripts\windows\tailscale\stop-tailscale.bat - Stop Tailscale Serve on Windows

echo =======================================================
echo        STOP TAILSCALE SERVE (WINDOWS)
echo =======================================================
echo.

where tailscale >nul 2>nul
if %errorlevel% neq 0 (
    echo Tailscale is not installed.
    exit /b 0
)

echo Stopping TCP forwarding on ports 80 and 3000...
tailscale serve --tcp=80 off >nul 2>&1
tailscale serve --tcp=3000 off >nul 2>&1

echo OK: Tailscale Serve stopped.
tailscale serve status
echo.
