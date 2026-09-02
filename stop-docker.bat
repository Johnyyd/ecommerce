@echo off
REM stop-docker.bat

echo Stopping Premium E-Commerce Platform Docker Compose services...

REM Bring down the containers and remove volumes
docker-compose down -v

echo Services stopped and volumes removed successfully.
