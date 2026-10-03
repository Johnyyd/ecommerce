# 🔄 CI/CD Pipeline Overview

This guide covers the GitHub Actions CI/CD pipeline for the e-commerce platform.

---

## 📋 Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflow                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Test    │───▶│ Security │───▶│  Build   │───▶│ Deploy   │  │
│  │          │    │          │    │          │    │          │  │
│  │ Backend  │    │  SAST    │    │  Docker  │    │  Helm    │  │
│  │ Frontend │    │  Strix   │    │  Images  │    │  Charts  │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Workflow Files

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | Main CI/CD pipeline |
| `.github/workflows/security.yml` | Security scanning workflow |

---

## 🧪 Test Stage

### Backend Tests

```yaml
backend-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Set up Python
      uses: actions/setup-python@v5
      with:
        python-version: '3.12'
    - name: Install dependencies
      run: pip install -r backend/requirements.txt
    - name: Run tests
      run: pytest backend/tests/ -v --cov=backend/app
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

### Frontend Tests

```yaml
frontend-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    - name: Install dependencies
      run: cd frontend && npm ci
    - name: Run linting
      run: cd frontend && npm run lint
    - name: Run tests
      run: cd frontend && npm test
    - name: Build
      run: cd frontend && npm run build
```

---

## 🔒 Security Stage

### SAST Scanning

```yaml
security-scan:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Bandit SAST
      run: bandit -r backend/app -c backend/bandit.yaml
    - name: Strix AI Pentesting
      uses: strix-ai/strix-action@v1
      with:
        target: ./backend
    - name: Upload SARIF
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: strix-results.sarif
```

### Dependency Scanning

```yaml
dependency-scan:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Python Safety
      run: safety check -r backend/requirements.txt
    - name: npm audit
      run: cd frontend && npm audit --audit-level=high
```

---

## 🏗️ Build Stage

### Docker Images

```yaml
docker-build:
  needs: [backend-test, frontend-test, security-scan]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    - name: Build Backend
      uses: docker/build-push-action@v5
      with:
        context: ./backend
        push: true
        tags: ${{ secrets.DOCKER_HUB_USERNAME }}/ecommerce-backend:${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
    - name: Build Frontend
      uses: docker/build-push-action@v5
      with:
        context: ./frontend
        push: true
        tags: ${{ secrets.DOCKER_HUB_USERNAME }}/ecommerce-frontend:${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
```

---

## 🚀 Deploy Stage

### Helm Chart Validation

```yaml
helm-validate:
  needs: docker-build
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Set up Helm
      uses: azure/setup-helm@v4
    - name: Lint Chart
      run: helm lint ./helm/ecommerce
    - name: Template Chart
      run: helm template ecommerce ./helm/ecommerce -f ./helm/ecommerce/values-dev.yaml
```

### Kubernetes Deployment (Optional)

```yaml
k8s-deploy:
  needs: helm-validate
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Configure kubectl
      uses: azure/k8s-set-context@v1
      with:
        kubeconfig: ${{ secrets.KUBECONFIG }}
    - name: Deploy to Kubernetes
      run: |
        helm upgrade --install ecommerce ./helm/ecommerce \
          -f ./helm/ecommerce/values-prod.yaml \
          --namespace ecommerce-prod \
          --create-namespace \
          --atomic \
          --timeout 10m
```

---

## 🌿 Branch Strategy

| Branch | Pipeline Trigger | Deployment Target |
|--------|------------------|-------------------|
| `main` | Push / PR | Production (via ArgoCD) |
| `develop` | Push / PR | Staging (via ArgoCD) |
| `feature/*` | PR only | None (validation only) |
| `release/*` | Push | Staging |

---

## 🔐 Required Secrets

| Secret | Description | Required For |
|--------|-------------|--------------|
| `DOCKER_HUB_USERNAME` | Docker Hub username | Build stage |
| `DOCKER_HUB_TOKEN` | Docker Hub access token | Build stage |
| `KUBECONFIG` | Kubernetes cluster config | Deploy stage |
| `STRIX_API_KEY` | Strix AI API key | Security stage |

---

## 📊 Pipeline Metrics

| Metric | Target |
|--------|--------|
| Total Pipeline Time | < 20 min |
| Test Stage | < 5 min |
| Security Stage | < 10 min |
| Build Stage | < 7 min |
| Deploy Stage | < 5 min |

---

## 🛠️ Troubleshooting

### Pipeline Stuck

```bash
# Check workflow runs
gh run list --workflow=ci.yml

# View logs
gh run view <run-id> --log
```

### Test Failures

```bash
# Run tests locally
cd backend && pytest tests/ -v
cd frontend && npm test
```

### Build Failures

```bash
# Build locally
docker build -t backend:test ./backend
docker build -t frontend:test ./frontend
```

---

## 🔗 Related Documentation

- [CI/CD Pipeline Usage](../runbooks/cicd-pipeline-usage.md)
- [ArgoCD GitOps Workflow](../runbooks/argocd-gitops-workflow.md)

---

## 📞 Support

Contact DevOps team for CI/CD issues.