# 🚀 CI/CD Pipeline Usage Guide

This guide covers using and managing the GitHub Actions CI/CD pipeline.

---

## 📋 Pipeline Overview

### Stages

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Test      │──▶│  Security   │──▶│  Build      │──▶│  Deploy     │
│  (Unit)     │   │   (Strix)   │   │   Docker    │   │   Helm      │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
```

---

## 🔧 Pipeline Configuration

### Workflow File

`.github/workflows/ci.yml`:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Run tests
      run: pytest tests/

  security:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Security scan
      run: strix scan .

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    steps:
    - name: Build Docker images
      run: docker build -t backend:${{ github.sha }} .

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
    - name: Deploy to K8s
      run: helm upgrade --install ecommerce-prod ./helm/ecommerce
```

---

## 🚀 Usage

### Trigger Pipeline

```bash
# Push to main triggers pipeline
git push origin main

# Create PR triggers pipeline
git checkout -b feature/new-feature
git push origin feature/new-feature
```

### Manual Trigger

```bash
# Trigger manually from GitHub UI
# Actions → CI/CD Pipeline → Run workflow
```

### Skip Tests

```bash
# Skip tests with [skip ci]
git commit -m "docs: update readme [skip ci]"
git push origin main
```

---

## 📊 Monitoring

### View Pipeline Status

```bash
# Check workflow runs
gh run list

# View specific run
gh run view <run-id>
```

### Pipeline Metrics

| Metric | Target |
|--------|--------|
| Test Success | >95% |
| Build Time | <10 min |
| Deploy Time | <5 min |

---

## 🛠️ Troubleshooting

### Failed Tests

```bash
# Check test logs
gh run view --log <run-id>

# Run tests locally
pytest tests/ -v
```

### Build Failures

```bash
# Check Docker build
docker build -t backend:test .

# Check Dockerfile syntax
hadolint Dockerfile
```

---

## 📞 Support

For CI/CD issues, contact DevOps team.
