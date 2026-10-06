# ⚙️ Helm Values Configuration

This guide covers the Helm values configuration for the e-commerce platform.

---

## 📋 Configuration Sections

### Global Settings

```yaml
global:
  imageRegistry: ''              # Docker registry prefix (empty for local images)
  imageRepository: ecommerce     # Base image repository name
  imageTag: latest               # Default image tag
  pullPolicy: IfNotPresent       # Default pull policy
```

### Backend Configuration

```yaml
backend:
  enabled: true
  replicaCount: 3                # Number of backend pods
  image:
    pullPolicy: IfNotPresent
    repository: ecommerce-backend
    tag: latest
  env:
    BACKUP_DIR: /backups
    POSTGRES_PORT: '6432'        # PgBouncer port for connection pooling
    POSTGRES_SERVER: pgbouncer
    REDIS_HOST: redis
    REDIS_PORT: '6379'
    WEB_CONCURRENCY: '5'         # Gunicorn workers
  resources:
    limits:
      cpu: '1'
      memory: 1Gi
    requests:
      cpu: 200m
      memory: 256Mi
  securityContext:
    fsGroup: 102
    runAsGroup: 1000
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault
  service:
    port: 8000
    type: ClusterIP
```

### Frontend Configuration

```yaml
frontend:
  enabled: true
  replicaCount: 2                # Number of frontend pods
  image:
    pullPolicy: IfNotPresent
    repository: ecommerce-frontend
    tag: latest
  resources:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 100m
      memory: 128Mi
  service:
    port: 3000
    type: ClusterIP
```

### Worker Configuration (ARQ Background Worker)

```yaml
worker:
  enabled: true
  replicaCount: 1                # Number of worker pods
  image:
    pullPolicy: IfNotPresent
    repository: ecommerce-worker
    tag: latest
  resources:
    limits:
      cpu: '1'
      memory: 512Mi
    requests:
      cpu: 100m
      memory: 128Mi
  # Cron job configuration for periodic tasks (backup schedule)
  # Note: ARQ worker handles its own cron jobs (see backend/app/worker.py)
  cronJob:
    enabled: true
    schedule: "*/5 * * * *"      # Every 5 minutes (backup/reconciliation)
    successfulJobsHistoryLimit: 3
    failedJobsHistoryLimit: 5
```

### PgBouncer Configuration

```yaml
pgbouncer:
  enabled: true
  replicaCount: 1
  image:
    repository: bitnami/pgbouncer
    tag: '1.21'
  resources:
    limits:
      cpu: 200m
      memory: 256Mi
    requests:
      cpu: 50m
      memory: 128Mi
  service:
    port: 6432
```

### PostgreSQL Configuration

```yaml
postgres:
  enabled: true
  replicaCount: 1                # StatefulSet replicas
  image:
    repository: postgres
    tag: 15-alpine
  resources:
    limits:
      cpu: 500m
      memory: 1Gi
    requests:
      cpu: 100m
      memory: 256Mi
  service:
    port: 5432
```

### Redis Configuration

```yaml
redis:
  enabled: true
  replicaCount: 1                # StatefulSet replicas
  image:
    repository: redis
    tag: 7-alpine
  resources:
    limits:
      cpu: 200m
      memory: 256Mi
    requests:
      cpu: 50m
      memory: 128Mi
  service:
    port: 6379
```

### Meilisearch Configuration

```yaml
meilisearch:
  enabled: true
  replicaCount: 1
  image:
    pullPolicy: IfNotPresent
    repository: getmeili/meilisearch
    tag: v1.11                   # v1.11+ required for Vietnamese tokenizer
  resources:
    limits:
      cpu: '1'
      memory: 1Gi
    requests:
      cpu: 200m
      memory: 256Mi
  securityContext:
    runAsGroup: 1000
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  service:
    port: 7700
    type: ClusterIP
  persistence:
    storageClass: standard
    size: 5Gi
  environment: production
```

### HPA (Horizontal Pod Autoscaler) Configuration

```yaml
hpa:
  enabled: true
  maxReplicas: 8
  minReplicas: 2
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### Ingress Configuration

```yaml
ingress:
  className: nginx
  enabled: true
  hosts:
  - host: localhost
    paths:
    - path: /
      pathType: Prefix
  tls: []
```

### Network Policy Configuration

```yaml
networkPolicy:
  enabled: true
```

### Observability Configuration

```yaml
observability:
  enabled: true
  grafana:
    enabled: true
  loki:
    enabled: true
    retentionDays: 7
  prometheus:
    enabled: true
  promtail:
    enabled: true
  tempo:
    enabled: true
    tls:
      enabled: false
```

### Cancel Expired Orders CronJob (Alternative to ARQ Cron)

```yaml
# CronJob for auto-cancelling expired orders (alternative to ARQ worker cron)
# Set enabled: true to use Kubernetes CronJob approach
# Set enabled: false (default) to use ARQ worker cron (recommended)
cancelExpiredOrders:
  enabled: false
  schedule: "*/5 * * * *"  # Every 5 minutes
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  resources:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 100m
      memory: 128Mi
```

### Fullname Override

```yaml
fullnameOverride: ecommerce
```

---

## 🌍 Environment-Specific Overrides

### Development (values-dev.yaml)

```yaml
global:
  imageRegistry: ""
  imageTag: dev

backend:
  replicaCount: 1
  resources:
    limits:
      cpu: "500m"
      memory: "512Mi"
    requests:
      cpu: "100m"
      memory: "128Mi"

frontend:
  replicaCount: 1
  resources:
    limits:
      cpu: "200m"
      memory: "256Mi"
    requests:
      cpu: "50m"
      memory: "64Mi"

worker:
  replicaCount: 1
  resources:
    limits:
      cpu: "500m"
      memory: "256Mi"
    requests:
      cpu: "50m"
      memory: "64Mi"

# CronJob for auto-cancelling expired orders (disabled in dev, use ARQ worker)
cancelExpiredOrders:
  enabled: false

postgres:
  resources:
    limits:
      cpu: "200m"
      memory: "512Mi"
    requests:
      cpu: "50m"
      memory: "128Mi"

hpa:
  enabled: false

ingress:
  enabled: false

observability:
  loki:
    enabled: false
  promtail:
    enabled: false
  tempo:
    enabled: false
```

### Production (values-prod.yaml)

```yaml
global:
  imageRegistry: registry.example.com/
  imageTag: v1.0.0

backend:
  replicaCount: 5
  resources:
    limits:
      cpu: "2"
      memory: "2Gi"
    requests:
      cpu: "500m"
      memory: "512Mi"

frontend:
  replicaCount: 3
  resources:
    limits:
      cpu: "1"
      memory: "1Gi"
    requests:
      cpu: "200m"
      memory: "256Mi"

worker:
  replicaCount: 2
  resources:
    limits:
      cpu: "1"
      memory: "1Gi"
    requests:
      cpu: "200m"
      memory: "256Mi"

postgres:
  replicaCount: 2
  resources:
    limits:
      cpu: "2"
      memory: "4Gi"
    requests:
      cpu: "500m"
      memory: "1Gi"

redis:
  replicaCount: 2
  resources:
    limits:
      cpu: "500m"
      memory: "1Gi"
    requests:
      cpu: "100m"
      memory: "256Mi"

pgbouncer:
  replicaCount: 2
  resources:
    limits:
      cpu: "500m"
      memory: "512Mi"
    requests:
      cpu: "100m"
      memory: "128Mi"

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: api.example.com
      paths:
        - path: /
          pathType: Prefix
    - host: app.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ecommerce-tls
      hosts:
        - api.example.com
        - app.example.com

hpa:
  enabled: true
  minReplicas: 5
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

networkPolicy:
  enabled: true

# CronJob for auto-cancelling expired orders (disabled in prod, use ARQ worker cron)
# The ARQ worker runs cancel_expired_orders_task every 2 minutes (see backend/app/worker.py)
cancelExpiredOrders:
  enabled: false
  schedule: "*/5 * * * *"
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  resources:
    limits:
      cpu: "500m"
      memory: "512Mi"
    requests:
      cpu: "100m"
      memory: "128Mi"

observability:
  enabled: true
  grafana:
    enabled: true
  loki:
    enabled: true
    retentionDays: 7
  promtail:
    enabled: true
  tempo:
    enabled: true
```

---

## 🔧 Common Overrides

### Custom Image Registry

```yaml
global:
  imageRegistry: "my-registry.io/"

images:
  backend:
    repository: my-registry.io/ecommerce-backend
  frontend:
    repository: my-registry.io/ecommerce-frontend
  worker:
    repository: my-registry.io/ecommerce-backend
```

### Custom Resource Limits for High Traffic

```yaml
backend:
  resources:
    limits:
      cpu: "4000m"
      memory: "4Gi"
    requests:
      cpu: "1000m"
      memory: "1Gi"

worker:
  resources:
    limits:
      cpu: "2000m"
      memory: "2Gi"
    requests:
      cpu: "500m"
      memory: "512Mi"
```

### Enable All Monitoring (Production)

```yaml
observability:
  enabled: true
  grafana:
    enabled: true
  loki:
    enabled: true
    retentionDays: 30
  promtail:
    enabled: true
  tempo:
    enabled: true
    tls:
      enabled: true
  prometheus:
    enabled: true

# Increase persistence for production
persistence:
  postgres:
    size: 50Gi
  redis:
    size: 5Gi
  meilisearch:
    size: 20Gi
  loki:
    size: 50Gi
  tempo:
    size: 20Gi
  prometheus:
    size: 50Gi
  grafana:
    size: 5Gi
```

### Disable Meilisearch (Use PostgreSQL FTS Only)

```yaml
meilisearch:
  enabled: false
```

### Increase Worker Replicas for Heavy Background Processing

```yaml
worker:
  replicaCount: 3
  resources:
    limits:
      cpu: "2"
      memory: "2Gi"
    requests:
      cpu: "500m"
      memory: "512Mi"
```

---

## 📦 Persistence Configuration

```yaml
# Persistence is configured per component in their respective sections
# Example for postgres:
postgres:
  persistence:
    enabled: true
    storageClass: standard
    size: 10Gi

# Redis:
redis:
  persistence:
    enabled: true
    storageClass: standard
    size: 2Gi

# Meilisearch:
meilisearch:
  persistence:
    storageClass: standard
    size: 5Gi
```

---

## 🚀 Deployment Commands

### Install with Default Values

```bash
helm install ecommerce ./helm/ecommerce \
  --namespace default \
  --create-namespace
```

### Install with Development Values

```bash
helm install ecommerce ./helm/ecommerce \
  --namespace default \
  --create-namespace \
  -f ./helm/ecommerce/values-dev.yaml
```

### Install with Production Values

```bash
helm install ecommerce ./helm/ecommerce \
  --namespace production \
  --create-namespace \
  -f ./helm/ecommerce/values-prod.yaml
```

### Upgrade with Custom Values

```bash
helm upgrade ecommerce ./helm/ecommerce \
  --namespace default \
  -f ./helm/ecommerce/values.yaml \
  -f ./custom-values.yaml
```

### Dry Run for Validation

```bash
helm install ecommerce ./helm/ecommerce \
  --namespace default \
  --dry-run \
  --debug
```

### View Rendered Templates

```bash
helm template ecommerce ./helm/ecommerce \
  --namespace default \
  -f ./helm/ecommerce/values-dev.yaml
```

---

## 🔍 Verification

### Check Deployed Values

```bash
# Get current values
helm get values ecommerce -n default

# Get all values (including computed)
helm get values ecommerce -n default --all
```

### Verify Pod Resources

```bash
# Check resource requests/limits
kubectl get pods -n default -o custom-columns="NAME:.metadata.name,CPU_REQUEST:.spec.containers[0].resources.requests.cpu,CPU_LIMIT:.spec.containers[0].resources.limits.cpu,MEM_REQUEST:.spec.containers[0].resources.requests.memory,MEM_LIMIT:.spec.containers[0].resources.limits.memory"
```

---

## 📚 Related Documentation

- [Chart Structure](chart-structure.md)
- [Multi-Environment Deployment](multi-environment.md)
- [Helm Deployment Guide](../runbooks/helm-deployment-guide.md)
- [Worker Deployment & CronJob Setup](../worker-deployment.md)
- [Meilisearch Vietnamese Config](../meilisearch-vietnamese-config.md)

---

*Last updated: 2024-01-15*