@echo off
REM start-docker.bat

echo Starting Premium E-Commerce Platform via Docker Compose...

REM Check if .env exists, if not, copy from .env.example
if not exist ".env" (
    echo No .env file found. Creating one from .env.example...
    copy .env.example .env
)

REM Build and start the containers in detached mode
docker-compose up --build -d

echo Services started successfully!
echo Backend API is available at http://localhost:8000
echo Frontend is available at http://localhost:80
