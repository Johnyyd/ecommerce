# 🌍 Multi-Environment Deployment

This guide covers deploying the e-commerce platform to multiple environments using Helm.

---

## 📋 Environment Overview

| Environment | Purpose | Replicas | HPA | Ingress | TLS |
|-------------|---------|----------|-----|---------|-----|
| Development | Local dev / testing | 1 | ❌ | ❌ | ❌ |
| Staging | Pre-production validation | 2 | ✅ | ✅ | ✅ |
| Production | Live traffic | 3+ | ✅ | ✅ | ✅ |

---

## 🚀 Deployment Commands

### Development

```bash
# Install
helm install ecommerce-dev ./helm/ecommerce \
  -f ./helm/ecommerce/values-dev.yaml \
  --namespace ecommerce-dev \
  --create-namespace

# Upgrade
helm upgrade ecommerce-dev ./helm/ecommerce \
  -f ./helm/ecommerce/values-dev.yaml \
  --namespace ecommerce-dev

# Check status
helm status ecommerce-dev --namespace ecommerce-dev
```

### Staging

```bash
# Create values-staging.yaml first (see below)
helm install ecommerce-staging ./helm/ecommerce \
  -f ./helm/ecommerce/values-staging.yaml \
  --namespace ecommerce-staging \
  --create-namespace
```

### Production

```bash
# Install
helm install ecommerce-prod ./helm/ecommerce \
  -f ./helm/ecommerce/values-prod.yaml \
  --namespace ecommerce-prod \
  --create-namespace

# Upgrade with rollback on failure
helm upgrade ecommerce-prod ./helm/ecommerce \
  -f ./helm/ecommerce/values-prod.yaml \
  --namespace ecommerce-prod \
  --atomic \
  --timeout 10m

# Rollback if needed
helm rollback ecommerce-prod --namespace ecommerce-prod
```

---

## 📝 Creating Staging Values

Create `helm/ecommerce/values-staging.yaml`:

```yaml
global:
  environment: "staging"
  domain: "staging.ecommerce.example.com"

replicas:
  backend: 2
  frontend: 2
  worker: 1
  pgbouncer: 2

hpa:
  backend:
    enabled: true
    minReplicas: 2
    maxReplicas: 6

ingress:
  enabled: true
  tls:
    - secretName: ecommerce-staging-tls
      hosts:
        - staging.ecommerce.example.com
  hosts:
    - host: staging.ecommerce.example.com
      paths:
        - path: /
          pathType: Prefix
          service: frontend
        - path: /api
          pathType: Prefix
          service: backend

monitoring:
  prometheus:
    storageSize: 10Gi
  loki:
    storageSize: 10Gi
  tempo:
    storageSize: 5Gi

persistence:
  postgres:
    size: 10Gi
  redis:
    size: 1Gi
  meilisearch:
    size: 5Gi
```

---

## 🔄 GitOps with ArgoCD

### Application Definition

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ecommerce-staging
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/ecommerce.git
    targetRevision: main
    path: helm/ecommerce
    helm:
      valueFiles:
        - values-staging.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: ecommerce-staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

---

## 🔐 Secrets Management

### Using Sealed Secrets

```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.25.0/controller.yaml

# Create sealed secret
kubectl create secret generic app-secrets \
  --from-literal=POSTGRES_PASSWORD=prod_password \
  --from-literal=REDIS_PASSWORD=prod_redis_password \
  --from-literal=SECRET_KEY=prod_secret_key \
  --namespace ecommerce-prod \
  --dry-run=client -o yaml | \
kubeseal --format yaml > sealed-secrets.yaml
```

### Using External Secrets Operator

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
  namespace: ecommerce-prod
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: app-secrets
    creationPolicy: Owner
  data:
    - secretKey: POSTGRES_PASSWORD
      remoteRef:
        key: ecommerce/prod/postgres-password
    - secretKey: REDIS_PASSWORD
      remoteRef:
        key: ecommerce/prod/redis-password
    - secretKey: SECRET_KEY
      remoteRef:
        key: ecommerce/prod/secret-key
```

---

## ✅ Validation Checklist

### Pre-Deployment

- [ ] Helm chart linting passes: `helm lint ./helm/ecommerce`
- [ ] Template renders correctly: `helm template ...`
- [ ] Values file validated against schema
- [ ] Secrets created in target namespace
- [ ] Storage classes available
- [ ] Ingress controller running

### Post-Deployment

- [ ] All pods Running: `kubectl get pods -n <namespace>`
- [ ] Services accessible: `kubectl get svc -n <namespace>`
- [ ] Ingress working: `curl https://<domain>`
- [ ] HPA active: `kubectl get hpa -n <namespace>`
- [ ] Monitoring dashboards loading
- [ ] Logs flowing to Loki
- [ ] Traces visible in Tempo

### Smoke Tests

```bash
# Health check
curl -f https://<domain>/api/health

# Frontend loads
curl -f https://<domain>/ | grep -q "E-Commerce"

# API responds
curl -f https://<domain>/api/v1/products/ | jq '.data | length > 0'

# Grafana accessible
curl -f https://grafana.<domain>/api/health
```

---

## 🔄 Rollback Procedures

### Helm Rollback

```bash
# List revisions
helm history ecommerce-prod --namespace ecommerce-prod

# Rollback to specific revision
helm rollback ecommerce-prod 3 --namespace ecommerce-prod

# Rollback to previous
helm rollback ecommerce-prod --namespace ecommerce-prod
```

### ArgoCD Rollback

```bash
# Via CLI
argocd app rollback ecommerce-prod 3

# Via UI: Applications → ecommerce-prod → History → Rollback
```

### Database Rollback

```bash
# Restore from backup
kubectl exec -it postgres-0 -n ecommerce-prod -- \
  pg_restore -U ecommerce_user -d ecommerce_db /backups/latest.dump
```

---

## 📊 Environment Comparison

| Setting | Dev | Staging | Prod |
|---------|-----|---------|------|
| Backend Replicas | 1 | 2 | 3 |
| HPA Max Replicas | N/A | 6 | 10 |
| CPU Limit (Backend) | 1000m | 2000m | 4000m |
| Memory Limit (Backend) | 1Gi | 2Gi | 4Gi |
| PostgreSQL Storage | 1Gi | 10Gi | 50Gi |
| Redis Storage | 100Mi | 1Gi | 5Gi |
| Ingress | ❌ | ✅ | ✅ |
| TLS | ❌ | ✅ | ✅ |
| Monitoring Retention | 1d | 7d | 30d |

---

## 📚 Related Documentation

- [Chart Structure](chart-structure.md)
- [Values Configuration](values-configuration.md)
- [Helm Deployment Guide](../runbooks/helm-deployment-guide.md)

---

## 📞 Support

Contact DevOps team for deployment issues.