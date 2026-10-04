# Worker Deployment & CronJob Setup Guide

This guide covers deploying the Enterprise ARQ Background Worker and configuring periodic tasks via Kubernetes CronJobs.

## Overview

The platform uses **ARQ (Async Redis Queue)** for background task processing with two deployment options:
1. **ARQ Worker Deployment** (Recommended) - Long-running worker with built-in cron scheduling
2. **Kubernetes CronJobs** - Alternative for specific periodic tasks

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   API Pod   │────▶│   Redis     │◀───▶│  Worker Pod │
│  (Producer) │     │  (Queue)    │     │ (Consumer)  │
└─────────────┘     └─────────────┘     └─────────────┘
                           ▲                   │
                           │                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │ PostgreSQL  │     │  Meilisearch│
                    │  (Data)     │     │  (Search)   │
                    └─────────────┘     └─────────────┘
```

---

## Option 1: ARQ Worker Deployment (Recommended)

### Worker Configuration

The worker runs as a Kubernetes Deployment with the same backend image:

```yaml
# k8s/worker.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  replicas: 1
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      enableServiceLinks: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 102
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: worker
        image: ecommerce-backend:latest
        imagePullPolicy: IfNotPresent
        env:
        - name: APP_TYPE
          value: "worker"
        - name: HOME
          value: "/tmp"
        - name: POSTGRES_SERVER
          value: "pgbouncer"
        - name: POSTGRES_PORT
          value: "6432"
        - name: REDIS_HOST
          value: "redis"
        - name: REDIS_PORT
          value: "6379"
        - name: MEDIA_DIR
          value: "/app/media"
        - name: REPORTS_DIR
          value: "/app/reports"
        envFrom:
        - secretRef:
            name: app-secrets
        resources:
          limits:
            cpu: "500m"
            memory: "512Mi"
          requests:
            cpu: "100m"
            memory: "128Mi"
        lifecycle:
          preStop:
            exec:
              command: ["sleep", "5"]
```

### Helm Values

```yaml
# helm/ecommerce/values.yaml
worker:
  enabled: true
  image:
    pullPolicy: IfNotPresent
    repository: ecommerce-worker
    tag: latest
  replicaCount: 1
  resources:
    limits:
      cpu: '1'
      memory: 512Mi
    requests:
      cpu: 100m
      memory: 128Mi
  # Cron job configuration for periodic tasks (handled by ARQ)
  cronJob:
    enabled: true
    schedule: "*/5 * * * *"  # Every 5 minutes (backup schedule)
    successfulJobsHistoryLimit: 3
    failedJobsHistoryLimit: 5
```

### ARQ Worker Settings

```python
# backend/app/worker.py
class WorkerSettings:
    functions = [
        send_email_task,
        optimize_image_task,
        generate_sales_report_task,
        generate_embeddings_task,
        sync_to_meilisearch_task,
        incremental_sync_task,
        sync_product_task,
        delete_product_task,
        cancel_expired_orders_task,  # Runs every 2 minutes via ARQ cron
    ]
    cron_jobs = [
        cron(cancel_expired_orders_task, minute="*/2"),
    ]
    redis_settings = get_redis_settings()
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 20
    job_timeout = 600
    keep_result = 86400
```

---

## Option 2: Kubernetes CronJobs (Alternative)

For environments preferring native K8s scheduling over ARQ cron.

### Cancel Expired Orders CronJob

```yaml
# k8s/cronjobs/cancel-expired-orders.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cancel-expired-orders
  labels:
    app: cancel-expired-orders
    component: cronjob
spec:
  schedule: "*/5 * * * *"  # Every 5 minutes
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: cancel-expired-orders
        spec:
          automountServiceAccountToken: false
          restartPolicy: OnFailure
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            runAsGroup: 1000
            seccompProfile:
              type: RuntimeDefault
          containers:
          - name: cancel-orders
            image: ecommerce-backend:latest
            command: ["python", "-m", "app.worker.cancel_expired_orders_task"]
            envFrom:
            - secretRef:
                name: app-secrets
            resources:
              requests:
                cpu: 100m
                memory: 128Mi
              limits:
                cpu: 500m
                memory: 512Mi
            env:
            - name: REDIS_URL
              value: "redis://redis:6379"
            - name: MEILISEARCH_URL
              value: "http://meilisearch:7700"
```

### Search Reconciliation CronJob

```yaml
# k8s/cronjobs/reconcile-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: reconcile-search
  labels:
    app: reconcile-search
    component: cronjob
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM UTC
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: reconcile-search
        spec:
          automountServiceAccountToken: false
          restartPolicy: OnFailure
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            runAsGroup: 1000
            seccompProfile:
              type: RuntimeDefault
          containers:
          - name: reconcile
            image: ecommerce-backend:latest
            command: ["python", "/app/backend/scripts/reconcile_search.py", "--fix"]
            envFrom:
            - secretRef:
                name: app-secrets
            resources:
              requests:
                cpu: 100m
                memory: 128Mi
              limits:
                cpu: 500m
                memory: 512Mi
          nodeSelector:
            kubernetes.io/os: linux
```

---

## Available Background Tasks

### Task Catalog

| Task | Type | Description | Trigger |
|------|------|-------------|---------|
| `send_email_task` | Email | Send transactional emails (orders, welcome, password reset) | Event-driven |
| `optimize_image_task` | Image | Convert images to WebP, generate thumbnails | Event-driven (upload) |
| `generate_sales_report_task` | Report | Export sales/revenue to Excel/CSV | Manual/API |
| `generate_embeddings_task` | AI/ML | Generate 1536-dim embeddings for products | Manual/Scheduled |
| `sync_to_meilisearch_task` | Search | Full sync products to Meilisearch | Manual/Scheduled |
| `incremental_sync_task` | Search | Sync recently updated products | ARQ Cron (5 min) |
| `sync_product_task` | Search | Single product sync with retry/DLQ | Event-driven |
| `delete_product_task` | Search | Single product delete with retry/DLQ | Event-driven |
| `cancel_expired_orders_task` | Order | Auto-cancel PENDING orders > 15 min | ARQ Cron (2 min) |

### Task Details

#### 1. Email Tasks
```python
# Triggered via API
POST /api/v1/email/send-test
{
  "recipient": "user@example.com",
  "template": "order_confirmation",
  "context": {"order_code": "DH123456", "total": 500000}
}

# Supported templates:
# - order_confirmation
# - welcome
# - password_reset
```

#### 2. Image Optimization
```python
# Triggered on image upload
POST /api/v1/media/upload
# Automatically queues optimize_image_task

# Task processes:
# - Convert to WebP (quality 80)
# - Generate thumbnails (300x300, 150x150)
# - Save to MEDIA_DIR
```

#### 3. Sales Reports
```python
# Triggered via Admin API
POST /api/v1/reports/export
{
  "format": "excel",  # or "csv"
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}

# Returns job_id for status polling
GET /api/v1/status/{job_id}
```

#### 4. Embeddings Generation
```python
# Manual trigger for products without embeddings
POST /api/v1/admin/embeddings/generate
{
  "batch_size": 50
}

# Or via worker directly:
# arq enqueue generate_embeddings_task --batch-size 50
```

#### 5. Meilisearch Sync
```python
# Full sync (all products with embeddings)
POST /api/v1/admin/search/sync-full

# Incremental sync (recently updated)
# Runs automatically every 5 minutes via ARQ

# Single product sync (event-driven)
# Triggered on product create/update/delete
```

#### 6. Auto-Cancel Expired Orders
```python
# ARQ Cron: Runs every 2 minutes
# Cancels orders in PENDING status > 15 minutes
# Restores inventory automatically

# Alternative: Kubernetes CronJob every 5 minutes
# (see cancel-expired-orders.yaml)
```

---

## Deployment Instructions

### Docker Compose (Development)

```yaml
# docker-compose.yml (worker service)
worker:
  build:
    context: ./backend
    dockerfile: Dockerfile
  command: python -m app.worker
  environment:
    - APP_TYPE=worker
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - POSTGRES_SERVER=pgbouncer
    - POSTGRES_PORT=6432
  env_file: .env
  depends_on:
    - redis
    - pgbouncer
  volumes:
    - ./backend/media:/app/media
    - ./backend/reports:/app/reports
```

### Kubernetes (Production)

#### 1. Deploy via Helm

```bash
# Install/upgrade with worker enabled
helm upgrade --install ecommerce ./helm/ecommerce \
  --set worker.enabled=true \
  --namespace default
```

#### 2. Manual Deployment

```bash
# Apply worker deployment
kubectl apply -f k8s/worker.yaml

# Apply cronjobs (if using K8s cron instead of ARQ)
kubectl apply -f k8s/cronjobs/cancel-expired-orders.yaml
kubectl apply -f k8s/cronjobs/reconcile-cronjob.yaml
```

#### 3. Verify Deployment

```bash
# Check worker pod
kubectl get pods -l app=worker

# Check worker logs
kubectl logs deployment/worker -f

# Check cronjobs
kubectl get cronjobs
kubectl get jobs -l app=cancel-expired-orders
kubectl get jobs -l app=reconcile-search
```

---

## Monitoring & Observability

### Worker Health Checks

```bash
# Check worker is running
kubectl exec deployment/worker -- python -c "import app.worker; print('Worker module OK')"

# Check Redis connection
kubectl exec deployment/worker -- python -c "
import redis.asyncio as redis
r = redis.from_url('redis://redis:6379')
print(r.ping())
"
```

### Queue Metrics

```bash
# Via API (requires staff role)
GET /api/v1/queue/metrics

# Response:
{
  "active": 2,
  "queued": 5,
  "completed": 150,
  "failed": 3,
  "workers": 1
}
```

### Grafana Dashboard

Monitor worker metrics in Grafana:
- **Queue Depth**: Active + Queued jobs over time
- **Job Duration**: P50/P95/P99 execution time per task type
- **Failure Rate**: Failed jobs / Total jobs
- **Worker CPU/Memory**: Resource utilization

---

## Scaling Workers

### Horizontal Scaling

```yaml
# helm/ecommerce/values-prod.yaml
worker:
  replicaCount: 2  # Increase for higher throughput
  resources:
    limits:
      cpu: '1'
      memory: 1Gi
    requests:
      cpu: 200m
      memory: 256Mi
```

```bash
# Or scale manually
kubectl scale deployment worker --replicas=3
```

### Task-Specific Scaling

For CPU-intensive tasks (embeddings, image optimization), consider:

```yaml
# Separate deployment for heavy tasks
worker-heavy:
  replicaCount: 1
  resources:
    limits:
      cpu: '2'
      memory: 2Gi
  # Only run specific tasks
  env:
  - name: ARQ_TASKS
    value: "generate_embeddings_task,optimize_image_task,generate_sales_report_task"
```

---

## Troubleshooting

### Common Issues

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| Worker pod `CrashLoopBackOff` | Check logs | `kubectl logs deployment/worker --previous` |
| Jobs stuck in `queued` | No worker running | Check worker deployment status |
| Jobs failing | Check job results | `GET /api/v1/status/{job_id}` |
| Redis connection failed | Network policy | Verify `networkpolicies.yaml` allows worker→redis |
| CronJob not running | Schedule issue | `kubectl describe cronjob cancel-expired-orders` |

### Debug Commands

```bash
# View recent job results
kubectl exec statefulset/redis -- redis-cli -a $REDIS_PASSWORD \
  LRANGE arq:results 0 20

# Check worker queue
kubectl exec statefulset/redis -- redis-cli -a $REDIS_PASSWORD \
  LRANGE arq:queue 0 20

# Manually trigger task
kubectl exec deployment/backend -- python -c "
import asyncio
from app.worker import send_email_task
from arq import create_pool
from app.core.config import settings

async def test():
    redis = await create_pool(settings.REDIS_URL)
    await redis.enqueue_job('send_email_task', 'test@test.com', 'Test', 'welcome', {})
    await redis.close()

asyncio.run(test())
"
```

### DLQ (Dead Letter Queue) Handling

Failed tasks after max retries are stored in `failed_sync_tasks` table:

```bash
# View DLQ entries
kubectl exec deployment/backend -- python -c "
from app.core.db import AsyncSessionLocal
from app.models.search_sync import FailedSyncTask
from sqlalchemy import select

async def check_dlq():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(FailedSyncTask).limit(10))
        for task in result.scalars():
            print(f'Product: {task.product_id}, Error: {task.error}, Type: {task.error_type}')

import asyncio
asyncio.run(check_dlq())
"

# Retry DLQ entries
kubectl exec deployment/backend -- python scripts/retry_dlq.py
```

---

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_TYPE` | `worker` | Identifies container as worker |
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `POSTGRES_SERVER` | `pgbouncer` | PostgreSQL/PgBouncer host |
| `POSTGRES_PORT` | `6432` | PgBouncer port |
| `MEDIA_DIR` | `/app/media` | Image storage directory |
| `REPORTS_DIR` | `/app/reports` | Report output directory |
| `MEILISEARCH_URL` | `http://meilisearch:7700` | Meilisearch endpoint |
| `PAYOS_CLIENT_ID` | - | PayOS credentials (from secret) |

### ARQ Settings

```python
# backend/app/core/queue.py
def get_redis_settings() -> RedisSettings:
    return RedisSettings(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD,
        database=0,
        max_connections=20,
    )
```

### Worker Settings

```python
# backend/app/worker.py
class WorkerSettings:
    max_jobs = 20           # Max concurrent jobs per worker
    job_timeout = 600       # Job timeout in seconds (10 min)
    keep_result = 86400     # Keep results for 24 hours
    cron_jobs = [
        cron(cancel_expired_orders_task, minute="*/2"),
    ]
```

---

## Security Considerations

1. **Network Policies**: Worker only connects to Redis, PostgreSQL (via PgBouncer), Meilisearch
2. **Secrets**: All credentials via Kubernetes secrets (`app-secrets`)
3. **Non-root**: Worker runs as user 1000
4. **Read-only FS**: Where possible, use read-only root filesystem
5. **Resource Limits**: Prevent resource exhaustion

---

## Maintenance

### Routine Tasks

| Frequency | Task |
|-----------|------|
| Daily | Check worker logs for errors |
| Weekly | Review DLQ entries, retry failed tasks |
| Monthly | Rotate Redis password, update worker image |
| Quarterly | Review task performance, adjust resources |

### Upgrading Worker

```bash
# Build new image
docker build -t ecommerce-backend:v1.2.0 ./backend

# Load into Minikube (dev)
minikube image load ecommerce-backend:v1.2.0

# Update deployment
kubectl set image deployment/worker worker=ecommerce-backend:v1.2.0

# Or via Helm
helm upgrade ecommerce ./helm/ecommerce --set worker.image.tag=v1.2.0
```

---

## References

- [ARQ Documentation](https://arq-docs.helpmanual.io/)
- [Redis Queue Patterns](https://redis.io/docs/manual/patterns/)
- [Kubernetes CronJob Docs](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
- [PayOS Integration](../payment-setup.md)
- [Meilisearch Sync](../meilisearch-vietnamese-config.md)

---

*Last updated: 2024-01-15*