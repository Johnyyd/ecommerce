# 🚀 CI/CD Pipeline Usage Guide

This guide covers GitHub Actions CI/CD pipeline usage for the e-commerce platform.

---

## 📋 Pipeline Overview

The CI/CD pipeline automates testing, security scanning, building, and deployment.

---

## 🏗️ Pipeline Stages

| Stage | Duration | Purpose |
|-------|----------|---------|
| Test | 5 min | Unit and integration tests |
| Security | 10 min | OWASP, Strix scanning |
| Build | 7 min | Docker image building |
| Deploy | 5 min | Helm chart deployment |

---

## 🚀 Triggering Pipeline

### Automatic Triggers

```bash
# Push to main
git push origin main

# Pull request to main
git checkout -b feature/xyz
git push origin feature/xyz
```

### Manual Trigger

```bash
# Via GitHub UI
Actions → CI/CD Pipeline → Run workflow
```

---

## 📊 Monitoring

```bash
# View runs
gh run list

# View logs
gh run view <id> --log
```

---

## 📞 Support

Contact DevOps team.