# 📦 Helm Chart Structure

This guide covers the Helm chart structure for the e-commerce platform.

---

## 📁 Chart Layout

```
helm/ecommerce/
├── Chart.yaml              # Chart metadata
├── values.yaml             # Default configuration
├── values-dev.yaml         # Development overrides
├── values-prod.yaml        # Production overrides
└── templates/
    ├── _helpers.tpl        # Template helpers
    ├── backend.yaml        # Backend deployment
    ├── frontend.yaml       # Frontend deployment
    ├── worker.yaml         # Worker deployment
    ├── postgres.yaml       # PostgreSQL StatefulSet
    ├── redis.yaml          # Redis StatefulSet
    ├── pgbouncer.yaml      # PgBouncer deployment
    ├── ingress.yaml        # Ingress controller
    ├── hpa.yaml            # Horizontal Pod Autoscaler
    ├── cronjob.yaml        # Reconciliation CronJob
    ├── network-policy.yaml # Network policies
    ├── loki.yaml           # Loki logging
    ├── promtail.yaml       # Promtail log collection
    ├── tempo.yaml          # Tempo tracing
    ├── prometheus-configmap.yaml
    ├── prometheus-deployment.yaml
    └── prometheus-service.yaml
```

---

## 📋 Chart.yaml

```yaml
apiVersion: v2
name: ecommerce
description: Enterprise Premium E-Commerce Platform
type: application
version: 1.0.0
appVersion: "1.0.0"
keywords:
  - ecommerce
  - microservices
  - kubernetes
  - observability
maintainers:
  - name: DevOps Team
    email: devops@ecommerce.example.com
```

---

## ⚙️ Values Configuration

### Base Values (values.yaml)

Contains all default configuration for:
- Image repositories and tags
- Resource limits and requests
- Service ports and types
- Ingress configuration
- Monitoring configuration

### Environment-Specific Values

| File | Purpose |
|------|---------|
| `values-dev.yaml` | Development: 1 replica, minimal resources, no TLS |
| `values-prod.yaml` | Production: HPA enabled, HA setup, TLS ingress |

---

## 🚀 Usage

### Install Chart

```bash
# Development
helm install ecommerce ./helm/ecommerce -f ./helm/ecommerce/values-dev.yaml

# Production
helm install ecommerce ./helm/ecommerce -f ./helm/ecommerce/values-prod.yaml
```

### Validate Chart

```bash
# Lint chart
helm lint ./helm/ecommerce

# Template render
helm template ecommerce ./helm/ecommerce -f ./helm/ecommerce/values-dev.yaml
```

---

## 📝 Template Helpers (_helpers.tpl)

Common template functions:

```tpl
{{- define "ecommerce.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}
```

---

## 🔗 Related Documentation

- [Values Configuration](values-configuration.md)
- [Multi-Environment Deployment](multi-environment.md)
- [Helm Deployment Guide](../runbooks/helm-deployment-guide.md)

---

## 📞 Support

Contact DevOps team for Helm chart issues.