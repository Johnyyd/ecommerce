# 🚀 Deployment Strategies

This guide covers deployment strategies for the e-commerce platform.

---

## 📋 Strategy Overview

| Strategy | Use Case | Downtime | Rollback Speed |
|----------|----------|----------|----------------|
| Rolling Update | Standard deployments | Zero | Fast |
| Blue/Green | Major releases | Zero | Instant |
| Canary | Risk mitigation | Zero | Fast |
| Recreate | Breaking changes | Yes | Manual |

---

## 🔄 Rolling Update (Default)

### How It Works

```
Old Pods (v1)          New Pods (v2)
    │                       │
    ├───────▶               │  1. Create new pod
    │        ◀──────────────┤  2. New pod ready
    │                       │
    ├───────▶               │  3. Shift traffic
    │        ◀──────────────┤  4. Terminate old
    │                       │
```

### Configuration

```yaml
# In deployment template
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 25%
    maxUnavailable: 25%
```

### Pros/Cons

| Pros | Cons |
|------|------|
| Zero downtime | Slower rollout |
| Automatic rollback | Resource overhead |
| Gradual traffic shift | Version coexistence issues |

---

## 🔵 Blue/Green Deployment

### How It Works

```
┌─────────────────┐     ┌─────────────────┐
│    Blue (v1)    │     │   Green (v2)    │
│  Active Traffic │     │  Staging/Ready  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
              Traffic Switch
```

### Implementation with ArgoCD

```yaml
# Create two applications
# ecommerce-blue (tracks main)
# ecommerce-green (tracks release/v2)

# Switch traffic via Ingress
# Update Ingress to point to green service
```

### Helm Values for Blue/Green

```yaml
# values-blue.yaml
replicas:
  backend: 3
ingress:
  hosts:
    - host: ecommerce.example.com
      paths:
        - path: /
          service: frontend-blue
        - path: /api
          service: backend-blue

# values-green.yaml
replicas:
  backend: 3
ingress:
  hosts:
    - host: ecommerce.example.com
      paths:
        - path: /
          service: frontend-green
        - path: /api
          service: backend-green
```

---

## 🐤 Canary Deployment

### How It Works

```
Traffic Split:
┌─────────────────────────────────────┐
│  90% ████████████████████ v1 (Stable)│
│  10% ████ v2 (Canary)               │
└─────────────────────────────────────┘
```

### Implementation with ArgoCD Rollouts

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: backend-canary
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: {duration: 10m}
        - setWeight: 30
        - pause: {duration: 10m}
        - setWeight: 50
        - pause: {duration: 10m}
        - setWeight: 100
      canaryMetadata:
        labels:
          version: canary
      stableMetadata:
        labels:
          version: stable
      trafficRouting:
        nginx:
          stableIngress: backend-ingress
```

### Automated Analysis

```yaml
analysis:
  templates:
    - templateName: success-rate
  args:
    - name: service-name
      value: backend-canary
```

---

## 📦 Helm-Based Deployments

### Standard Upgrade

```bash
# Rolling update (default)
helm upgrade ecommerce ./helm/ecommerce \
  -f ./helm/ecommerce/values-prod.yaml \
  --namespace ecommerce-prod \
  --atomic \
  --timeout 10m
```

### With Force (Recreate)

```bash
# Force recreate pods
helm upgrade ecommerce ./helm/ecommerce \
  -f ./helm/ecommerce/values-prod.yaml \
  --namespace ecommerce-prod \
  --force \
  --recreate-pods
```

### Dry Run

```bash
# Preview changes
helm upgrade ecommerce ./helm/ecommerce \
  -f ./helm/ecommerce/values-prod.yaml \
  --namespace ecommerce-prod \
  --dry-run --debug
```

### History & Rollback

```bash
# View revision history
helm history ecommerce --namespace ecommerce-prod

# Rollback to previous
helm rollback ecommerce --namespace ecommerce-prod

# Rollback to specific revision
helm rollback ecommerce 3 --namespace ecommerce-prod
```

---

## 🎯 Environment Promotion

### Dev → Staging

```bash
# 1. Merge develop to staging branch
git checkout staging
git merge develop
git push origin staging

# 2. ArgoCD auto-syncs staging
# 3. Run smoke tests
./scripts/smoke-tests.sh staging.ecommerce.example.com
```

### Staging → Production

```bash
# 1. Create release tag
git tag v1.2.0
git push origin v1.2.0

# 2. ArgoCD syncs production (if configured for tags)
# Or manually promote:
argocd app set ecommerce-prod --parameter targetRevision=v1.2.0
argocd app sync ecommerce-prod
```

---

## ⚙️ Advanced Configuration

### Pod Disruption Budgets

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: backend-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: backend
```

### Pre/Post Hooks

```yaml
# In Helm chart templates
annotations:
  "helm.sh/hook": pre-upgrade
  "helm.sh/hook-weight": "1"
  "helm.sh/hook-delete-policy": hook-succeeded
```

### Readiness Gates

```yaml
# For custom readiness checks
readinessGates:
  - conditionType: "example.com/ready"
```

---

## 🛠️ Troubleshooting

### Stuck Rollout

```bash
# Check pod status
kubectl get pods -n ecommerce-prod -l app=backend

# Check rollout status
kubectl rollout status deployment/backend -n ecommerce-prod

# Force continue
kubectl rollout resume deployment/backend -n ecommerce-prod
```

### Failed Deployment

```bash
# Check events
kubectl get events -n ecommerce-prod --sort-by='.lastTimestamp'

# Check pod logs
kubectl logs -n ecommerce-prod -l app=backend --tail=100

# Rollback
helm rollback ecommerce --namespace ecommerce-prod
```

### Image Pull Errors

```bash
# Check image exists
docker pull my-registry.io/ecommerce-backend:v1.2.0

# Check imagePullSecrets
kubectl get sa default -n ecommerce-prod -o yaml

# Verify registry access
kubectl run test-pull --image=my-registry.io/ecommerce-backend:v1.2.0 -n ecommerce-prod --rm -it --restart=Never -- sh
```

---

## 📊 Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (CI green)
- [ ] Security scans clean
- [ ] Docker images built and pushed
- [ ] Helm chart linted
- [ ] Values file reviewed
- [ ] Database migrations ready
- [ ] Rollback plan documented

### During Deployment

- [ ] Monitor pod health
- [ ] Watch error rates
- [ ] Check latency metrics
- [ ] Verify traffic routing

### Post-Deployment

- [ ] Smoke tests pass
- [ ] All pods Running/Ready
- [ ] HPA active
- [ ] Monitoring dashboards green
- [ ] Logs flowing
- [ ] Traces visible

---

## 📚 Related Documentation

- [Pipeline Overview](pipeline-overview.md)
- [ArgoCD GitOps](argocd-gitops.md)
- [Helm Multi-Environment](../helm/multi-environment.md)

---

## 📞 Support

Contact DevOps team for deployment issues.