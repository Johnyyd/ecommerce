# ⚙️ Helm Values Configuration

This guide covers the Helm values configuration for the e-commerce platform.

---

## 📋 Configuration Sections

### Global Settings

```yaml
global:
  imageRegistry: ""              # Docker registry prefix
  imagePullSecrets: []           # Image pull secrets
  environment: "development"     # Environment name
  domain: "ecommerce.local"      # Base domain
```

### Image Configuration

```yaml
images:
  backend:
    repository: ecommerce-backend
    tag: latest
    pullPolicy: IfNotPresent
  frontend:
    repository: ecommerce-frontend
    tag: latest
    pullPolicy: IfNotPresent
  worker:
    repository: ecommerce-backend
    tag: latest
    pullPolicy: IfNotPresent
  postgres:
    repository: pgvector/pgvector
    tag: pg16
    pullPolicy: IfNotPresent
  redis:
    repository: redis
    tag: 7-alpine
    pullPolicy: IfNotPresent
  pgbouncer:
    repository: edoburu/pgbouncer
    tag: latest
    pullPolicy: IfNotPresent
  meilisearch:
    repository: getmeili/meilisearch
    tag: v1.8
    pullPolicy: IfNotPresent
  prometheus:
    repository: prom/prometheus
    tag: v2.53.0
    pullPolicy: IfNotPresent
  grafana:
    repository: grafana/grafana
    tag: 11.1.0
    pullPolicy: IfNotPresent
  loki:
    repository: grafana/loki
    tag: 2.9.4
    pullPolicy: IfNotPresent
  promtail:
    repository: grafana/promtail
    tag: 2.9.4
    pullPolicy: IfNotPresent
  tempo:
    repository: grafana/tempo
    tag: 2.3.1
    pullPolicy: IfNotPresent
```

### Resource Management

```yaml
resources:
  backend:
    requests:
      cpu: "500m"
      memory: "512Mi"
    limits:
      cpu: "2000m"
      memory: "2Gi"
  frontend:
    requests:
      cpu: "100m"
      memory: "128Mi"
    limits:
      cpu: "500m"
      memory: "512Mi"
  worker:
    requests:
      cpu: "100m"
      memory: "128Mi"
    limits:
      cpu: "500m"
      memory: "512Mi"
```

### Replica Configuration

```yaml
replicas:
  backend: 3
  frontend: 2
  worker: 1
  pgbouncer: 2
```

### Service Configuration

```yaml
services:
  backend:
    type: ClusterIP
    port: 8000
  frontend:
    type: LoadBalancer
    port: 80
  postgres:
    type: ClusterIP
    port: 5432
  redis:
    type: ClusterIP
    port: 6379
  pgbouncer:
    type: ClusterIP
    port: 6432
  meilisearch:
    type: ClusterIP
    port: 7700
  loki:
    type: ClusterIP
    port: 3100
  tempo:
    type: ClusterIP
    port: 3100
  prometheus:
    type: ClusterIP
    port: 9090
  grafana:
    type: LoadBalancer
    port: 3000
```

### Ingress Configuration

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  tls:
    - secretName: ecommerce-tls
      hosts:
        - ecommerce.example.com
        - grafana.ecommerce.example.com
  hosts:
    - host: ecommerce.example.com
      paths:
        - path: /
          pathType: Prefix
          service: frontend
        - path: /api
          pathType: Prefix
          service: backend
    - host: grafana.ecommerce.example.com
      paths:
        - path: /
          pathType: Prefix
          service: grafana
```

### HPA Configuration

```yaml
hpa:
  backend:
    enabled: true
    minReplicas: 3
    maxReplicas: 8
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
  frontend:
    enabled: false
    minReplicas: 2
    maxReplicas: 5
```

### Monitoring Configuration

```yaml
monitoring:
  prometheus:
    enabled: true
    retention: 15d
    storageSize: 10Gi
  grafana:
    enabled: true
    adminUser: admin
    adminPassword: admin
    dashboards:
      - ecommerce-overview
      - kubernetes-monitoring
  loki:
    enabled: true
    retention: 168h
    storageSize: 10Gi
  tempo:
    enabled: true
    retention: 72h
    storageSize: 5Gi
```

### CronJob Configuration

```yaml
cronjobs:
  reconciliation:
    enabled: true
    schedule: "0 2 * * *"
    image: ecommerce-backend:latest
    command: ["python", "scripts/reconcile_search.py", "--fix"]
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "500m"
        memory: "512Mi"
```

### NetworkPolicy Configuration

```yaml
networkPolicy:
  enabled: true
  defaultDenyAll: true
  allowExternalEgress: false
```

### Persistence Configuration

```yaml
persistence:
  postgres:
    enabled: true
    storageClass: standard
    size: 10Gi
  redis:
    enabled: true
    storageClass: standard
    size: 2Gi
  meilisearch:
    enabled: true
    storageClass: standard
    size: 5Gi
  loki:
    enabled: true
    storageClass: standard
    size: 10Gi
  tempo:
    enabled: true
    storageClass: standard
    size: 5Gi
  prometheus:
    enabled: true
    storageClass: standard
    size: 10Gi
  grafana:
    enabled: true
    storageClass: standard
    size: 1Gi
```

---

## 🌍 Environment-Specific Overrides

### Development (values-dev.yaml)

```yaml
global:
  environment: "development"

replicas:
  backend: 1
  frontend: 1
  worker: 1
  pgbouncer: 1

hpa:
  backend:
    enabled: false

ingress:
  enabled: false
  tls: []

monitoring:
  prometheus:
    storageSize: 1Gi
  loki:
    storageSize: 1Gi
  tempo:
    storageSize: 1Gi

persistence:
  postgres:
    size: 1Gi
  redis:
    size: 100Mi
  meilisearch:
    size: 1Gi
```

### Production (values-prod.yaml)

```yaml
global:
  environment: "production"
  domain: "ecommerce.example.com"

replicas:
  backend: 3
  frontend: 3
  worker: 2
  pgbouncer: 3

hpa:
  backend:
    enabled: true
    minReplicas: 3
    maxReplicas: 10

ingress:
  enabled: true
  tls:
    - secretName: ecommerce-tls
      hosts:
        - ecommerce.example.com

monitoring:
  prometheus:
    storageSize: 50Gi
  loki:
    storageSize: 50Gi
  tempo:
    storageSize: 20Gi

persistence:
  postgres:
    size: 50Gi
  redis:
    size: 5Gi
  meilisearch:
    size: 20Gi
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
```

### Custom Resource Limits

```yaml
resources:
  backend:
    limits:
      cpu: "4000m"
      memory: "4Gi"
```

### Enable All Monitoring

```yaml
monitoring:
  prometheus:
    enabled: true
  grafana:
    enabled: true
  loki:
    enabled: true
  tempo:
    enabled: true
```

---

## 📚 Related Documentation

- [Chart Structure](chart-structure.md)
- [Multi-Environment Deployment](multi-environment.md)
- [Helm Deployment Guide](../runbooks/helm-deployment-guide.md)

---

## 📞 Support

Contact DevOps team for values configuration issues.