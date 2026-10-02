# 🔄 ArgoCD GitOps Workflow

This guide covers the ArgoCD GitOps workflow for the e-commerce platform.

---

## 📋 Overview

ArgoCD provides declarative GitOps continuous delivery for Kubernetes. It monitors Git repositories and automatically applies changes to the cluster.

---

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Git      │────▶│   ArgoCD    │────▶│ Kubernetes  │
│ Repository  │     │  Controller │     │   Cluster   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              Sync Status      Health
```

---

## 📁 Application Definitions

### Production Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ecommerce-prod
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/ecommerce.git
    targetRevision: main
    path: helm/ecommerce
    helm:
      valueFiles:
        - values-prod.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: ecommerce-prod
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
```

### Staging Application

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
    targetRevision: develop
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

## 🚀 Sync Operations

### Automatic Sync (Default)

ArgoCD automatically syncs when:
- New commit pushed to tracked branch
- Manual sync triggered via UI/CLI
- Drift detected (self-heal)

### Manual Sync

```bash
# Sync specific application
argocd app sync ecommerce-prod

# Sync with dry-run
argocd app sync ecommerce-prod --dry-run

# Sync specific resources
argocd app sync ecommerce-prod --resource deployment/backend
```

### Sync Windows

Configure sync windows to control when auto-sync occurs:

```yaml
syncWindows:
  - schedule: "0 2 * * *"  # Daily at 2 AM UTC
    duration: 30m
    applications:
      - ecommerce-prod
  - schedule: "0 */6 * * *"  # Every 6 hours
    duration: 15m
    applications:
      - ecommerce-staging
```

---

## 📊 Application Status

### Status Types

| Status | Meaning |
|--------|---------|
| `Synced` | Cluster matches Git |
| `OutOfSync` | Cluster differs from Git |
| `Degraded` | Resources unhealthy |
| `Progressing` | Sync in progress |
| `Unknown` | Cannot determine status |

### Health Status

| Health | Meaning |
|--------|---------|
| `Healthy` | All resources healthy |
| `Degraded` | Some resources degraded |
| `Missing` | Resources missing |
| `Unknown` | Health unknown |

---

## 🛠️ Common Operations

### View Application

```bash
# List applications
argocd app list

# Get application details
argocd app get ecommerce-prod

# Get application resources
argocd app get ecommerce-prod --tree
```

### Sync Application

```bash
# Full sync
argocd app sync ecommerce-prod

# Sync with pruning
argocd app sync ecommerce-prod --prune

# Force sync (ignore conflicts)
argocd app sync ecommerce-prod --force
```

### Rollback

```bash
# View history
argocd app history ecommerce-prod

# Rollback to revision
argocd app rollback ecommerce-prod 3
```

### Diff

```bash
# Show differences
argocd app diff ecommerce-prod

# Show specific resource diff
argocd app diff ecommerce-prod --resource deployment/backend
```

---

## 🔐 Access Control

### Project Configuration

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: ecommerce
  namespace: argocd
spec:
  description: E-Commerce Platform Projects
  sourceRepos:
    - https://github.com/your-org/ecommerce.git
  destinations:
    - namespace: ecommerce-prod
      server: https://kubernetes.default.svc
    - namespace: ecommerce-staging
      server: https://kubernetes.default.svc
  clusterResourceWhitelist:
    - group: ''
      kind: Namespace
  namespaceResourceBlacklist:
    - group: ''
      kind: ResourceQuota
```

### RBAC Configuration

```yaml
# argocd-rbac-cm ConfigMap
policy.csv: |
  p, role:devops, applications, *, ecommerce/*, allow
  p, role:developer, applications, get, ecommerce/*, allow
  p, role:viewer, applications, get, ecommerce/*, allow
  g, devops-team, role:devops
  g, dev-team, role:developer
```

---

## 🔧 Advanced Configuration

### Parameter Overrides

```yaml
spec:
  source:
    helm:
      parameters:
        - name: global.environment
          value: "production"
        - name: replicas.backend
          value: "5"
```

### Kustomize Support

```yaml
spec:
  source:
    path: overlays/production
    kustomize:
      images:
        - ecommerce-backend:latest
        - ecommerce-frontend:latest
```

### Helm Repository Source

```yaml
spec:
  source:
    repoURL: https://charts.ecommerce.example.com
    chart: ecommerce
    targetRevision: 1.0.0
    helm:
      releaseName: ecommerce-prod
```

---

## 📊 Monitoring & Alerts

### Prometheus Metrics

```yaml
# ArgoCD exports metrics on :8082/metrics
# Key metrics:
- argocd_app_info
- argocd_app_sync_status
- argocd_app_health_status
- argocd_sync_total
- argocd_sync_duration_seconds
```

### Alert Rules

```yaml
- alert: ArgoCDAppOutOfSync
  expr: argocd_app_sync_status{status="OutOfSync"} == 1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Application {{ $labels.name }} is OutOfSync"

- alert: ArgoCDAppDegraded
  expr: argocd_app_health_status{health="Degraded"} == 1
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Application {{ $labels.name }} is Degraded"
```

---

## 🛠️ Troubleshooting

### Application Stuck in Progressing

```bash
# Check resource health
argocd app get ecommerce-prod --tree

# Check events
kubectl get events -n ecommerce-prod --sort-by='.lastTimestamp'

# Force refresh
argocd app sync ecommerce-prod --force
```

### Sync Fails Due to Conflicts

```bash
# View diff
argocd app diff ecommerce-prod

# Override with force
argocd app sync ecommerce-prod --force --prune

# Or manually resolve in Git
```

### Self-Heal Not Working

```bash
# Check sync policy
argocd app get ecommerce-prod -o json | jq '.spec.syncPolicy'

# Enable self-heal
argocd app set ecommerce-prod --sync-policy automated --auto-prune --self-heal
```

### Resource Not Found

```bash
# Check if CRD exists
kubectl get crd applications.argoproj.io

# Reinstall ArgoCD if needed
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

---

## 📚 Related Documentation

- [Pipeline Overview](pipeline-overview.md)
- [CI/CD Pipeline Usage](../runbooks/cicd-pipeline-usage.md)
- [Helm Multi-Environment](../helm/multi-environment.md)

---

## 📞 Support

Contact DevOps team for ArgoCD issues.