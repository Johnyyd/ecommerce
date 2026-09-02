# Premium E-Commerce Platform

A robust, high-performance E-Commerce platform built with modern technologies.

## Tech Stack
- **Backend**: Python 3.12, FastAPI (Async), PostgreSQL 16 (asyncpg), Redis, PgBouncer.
- **Frontend**: React, Zustand, TailwindCSS, Framer Motion.
- **Infra/DevOps**: Docker Compose, Kubernetes (K8s), Nginx.

## Getting Started

This repository provides scripts for both Windows and Linux to quickly spin up the environment via Docker Compose or Kubernetes.

### Using Docker Compose
- **Windows**: `start-docker.bat` (to start), `stop-docker.bat` (to stop)
- **Linux/macOS**: `./start-docker.sh` (to start), `./stop-docker.sh` (to stop)

### Using Kubernetes (K8s)
Make sure you have `kubectl` configured and pointing to a cluster (e.g. Docker Desktop, Minikube, or a cloud provider).

- **Windows**: `start-k8s.bat` (to deploy), `stop-k8s.bat` (to teardown)
- **Linux/macOS**: `./start-k8s.sh` (to deploy), `./stop-k8s.sh` (to teardown)

> Note: Ensure you have copied `.env.example` to `.env` before starting the services to configure necessary environment variables.
