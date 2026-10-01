# 🔄 ArgoCD GitOps Workflow

This guide covers ArgoCD GitOps workflow for declarative deployments.

---

## 📋 Overview

ArgoCD automates deployment of applications to Kubernetes using declarative manifests stored in Git.

---

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Git      │────▶│   ArgoCD    │────▶│ Kubernetes  │
│   Repo      │     │   Server    │     │  Cluster    │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 🔧 Setup

### Create ArgoCD Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ecommerce-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/ecommerce
    targetRevision: main
    path: helm/ecommerce
  destination:
    server: https://kubernetes.default.svc
    namespace: ecommerce-prod
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

---

## 🚀 Workflow

### 1. Commit to Git

```bash
git add helm/ecommerce/values-prod.yaml
git commit -m "feat: update production config"
git push origin main
```

### 2. ArgoCD Sync

ArgoCD automatically detects changes and syncs to Kubernetes.

### 3. Verify Status

```bash
kubectl get application -n argocd ecommerce-prod
```

---

## 📊 Monitoring

### Check Sync Status

```bash
# View application status
argocd app get ecommerce-prod

# List all applications
argocd app list
```

### Sync Manually

```bash
# Manual sync
argocd app sync ecommerce-prod

# Sync with prune
argocd app sync ecommerce-prod --prune
```

---

## 🛠️ Troubleshooting

### Sync Failed

```bash
# Check events
argocd app get ecommerce-prod --show-operation

# View logs
argocd app logs ecommerce-prod
```

---

## 📞 Support

Contact DevOps team for ArgoCD assistance.
