# 🚀 Helm Chart Deployment Guide

This guide covers deploying the e-commerce platform using standardized Helm charts.

---

## 📋 Overview

Helm charts provide a standardized packaging format for Kubernetes applications, enabling consistent multi-environment deployments.

### Chart Structure

```
helm/ecommerce/
├── Chart.yaml              # Chart metadata
├── values.yaml             # Default values
├── values-dev.yaml         # Development overrides
├── values-prod.yaml        # Production overrides
└── templates/
    ├── backend.yaml
    ├── frontend.yaml
    ├── worker.yaml
    ├── postgres.yaml
    ├── redis.yaml
    ├── pgbouncer.yaml
    ├── ingress.yaml
    └── _helpers.tpl
```

---

## 🔧 Prerequisites

### Install Helm

```bash
# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify installation
helm version
```

### Configure Kubernetes Context

```bash
kubectl config current-context
kubectl cluster-info
```

---

## 📦 Chart Operations

### Lint Chart

```bash
# Lint chart for errors
helm lint ./helm/ecommerce

# Lint with values file
helm lint ./helm/ecommerce -f ./helm/ecommerce/values-dev.yaml
```

### Template Chart

```bash
# Render templates
helm template ecommerce ./helm/ecommerce -f ./helm/ecommerce/values-dev.yaml

# Render to file
helm template ecommerce ./helm/ecommerce \
  -f ./helm/ecommerce/values-dev.yaml \
  > /tmp/rendered.yaml
```

### Deploy to Development

```bash
# Install chart
helm install ecommerce-dev ./helm/ecommerce \
  -f ./helm/ecommerce/values-dev.yaml \
  -n ecommerce-dev

# Upgrade existing release
helm upgrade ecommerce-dev ./helm/ecommerce \
  -f ./helm/ecommerce/values-dev.yaml \
  -n ecommerce-dev

# Uninstall
helm uninstall ecommerce-dev -n ecommerce-dev
```

### Deploy to Production

```bash
# Install with production values
helm install ecommerce-prod ./helm/ecommerce \
  -f ./helm/ecommerce/values-prod.yaml \
  -n ecommerce-prod

# With additional overrides
helm upgrade ecommerce-prod ./helm/ecommerce \
  -f ./helm/ecommerce/values-prod.yaml \
  --set backend.replicaCount=8 \
  --set backend.resources.limits.cpu="4000m" \
  -n ecommerce-prod
```

---

## ⚙️ Configuration

### Default Values (values.yaml)

```yaml
global:
  imageRegistry: "registry.local"
  imagePullPolicy: IfNotPresent

backend:
  enabled: true
  replicaCount: 2
  image:
    repository: ecommerce/backend
    tag: latest
  service:
    port: 8000
  resources:
    requests:
      cpu: "500m"
      memory: "512Mi"
    limits:
      cpu: "2000m"
      memory: "2Gi"

frontend:
  enabled: true
  replicaCount: 2
  image:
    repository: ecommerce/frontend
    tag: latest

postgres:
  enabled: true
  auth:
    postgresPassword: "changeme"

redis:
  enabled: true
  auth:
    enabled: false
```

### Environment Overrides

#### Development (values-dev.yaml)

```yaml
global:
  environment: dev

backend:
  replicaCount: 1
  resources:
    requests:
      cpu: "250m"
      memory: "256Mi"
    limits:
      cpu: "1000m"
      memory: "1Gi"

postgres:
  auth:
    postgresPassword: "devpassword"
  persistence:
    size: 10Gi
```

#### Production (values-prod.yaml)

```yaml
global:
  environment: prod

backend:
  replicaCount: 8
  resources:
    requests:
      cpu: "1000m"
      memory: "1Gi"
    limits:
      cpu: "4000m"
      memory: "4Gi"
  autoscaling:
    enabled: true
    minReplicas: 4
    maxReplicas: 16
    targetCPUUtilizationPercentage: 70

postgres:
  auth:
    postgresPassword: "${POSTGRES_PASSWORD}"
  persistence:
    size: 500Gi
    storageClass: fast-storage
```

---

## 🎯 Advanced Operations

### Helmfile for Multi-Environment

```yaml
# helmfile.yaml
environments:
  dev:
    values:
      - values-dev.yaml
  prod:
    values:
      - values-prod.yaml

releases:
  - name: backend
    chart: ./helm/ecommerce
    namespace: ecommerce
    values:
      - values.yaml
```

**Usage**:
```bash
helmfile -e dev apply
helmfile -e prod apply
```

### Helm Secrets Management

```bash
# Install Helm Secrets plugin
helm plugin install https://github.com/jkroepke/helm-secrets

# Encrypt secrets
helm secrets encrypt ./helm/ecommerce/values-prod-secret.yaml

# Deploy with secrets
helm secrets upgrade --install ecommerce-prod ./helm/ecommerce \
  -f values-prod.yaml \
  -f values-prod-secret.yaml
```

### Rollback Operations

```bash
# View release history
helm history ecommerce-prod -n ecommerce-prod

# Rollback to previous revision
helm rollback ecommerce-prod 2 -n ecommerce-prod

# Rollback to specific revision
helm rollback ecommerce-prod 3 -n ecommerce-prod
```

---

## ✅ Validation

### Verify Deployment

```bash
# Check release status
helm status ecommerce-prod -n ecommerce-prod

# List all releases
helm list -n ecommerce-prod

# Check pods
kubectl get pods -n ecommerce-prod

# Check services
kubectl get svc -n ecommerce-prod

# Check ingress
kubectl get ingress -n ecommerce-prod
```

### Health Checks

```bash
# Backend health
kubectl exec -n ecommerce-prod deployment/backend -- curl http://localhost:8000/health

# Frontend health
kubectl exec -n ecommerce-prod deployment/frontend -- curl http://localhost:3000

# Database connectivity
kubectl exec -n ecommerce-prod deployment/backend -- \
  psql -h postgres -U postgres -d ecommerce -c "SELECT 1"
```

---

## 🛠️ Troubleshooting

### Chart Validation Failed

**Symptoms**: `helm lint` reports errors

**Solution**:
```bash
# Check chart dependencies
helm dependency update ./helm/ecommerce

# Validate with strict mode
helm lint ./helm/ecommerce --strict
```

### Deployment Hanging

**Symptoms**: Pods stuck in Pending

**Diagnosis**:
```bash
# Check events
kubectl get events -n ecommerce-prod --sort-by='.lastTimestamp'

# Check resource requests
kubectl describe pod <pod-name> -n ecommerce-prod

# Check node capacity
kubectl describe nodes
```

---

### Version Conflicts

**Symptoms**: Image pull errors

**Solution**:
```bash
# Update image tag
helm upgrade ecommerce-prod ./helm/ecommerce \
  --set backend.image.tag=v1.2.3 \
  -n ecommerce-prod

# Force redeploy
helm upgrade --force --atomic ecommerce-prod ./helm/ecommerce \
  -f values-prod.yaml -n ecommerce-prod
```

---

## 📚 Related Documentation

- [Chart Structure](../helm/chart-structure.md)
- [Values Configuration](../helm/values-configuration.md)
- [Multi-Environment Deployment](../helm/multi-environment.md)

---

## 📞 Support

For Helm chart issues:
1. Check `helm status` and `helm history`
2. Review Kubernetes events
3. Contact DevOps team
