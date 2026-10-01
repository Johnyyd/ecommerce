# 📚 Technical Documentation - Professional E-Commerce Platform

This directory contains all technical documentation, runbooks, and operational guides for the **Professional E-Commerce Platform** DevOps, Security, and Observability infrastructure.

---

## 📁 Directory Structure

```
documentation/
├── README.md                 # This file
├── logging/                  # Centralized Logging (Loki + Promtail)
├── tracing/                  # Distributed Tracing (OpenTelemetry + Tempo)
├── helm/                     # Helm Charts Standardization
├── ci-cd/                    # CI/CD Pipeline & GitOps
├── runbooks/                 # Operational Runbooks
└── architecture/             # Architecture Decision Records (ADRs)
```

---

## 🎯 Documentation Scope

This documentation covers **Trụ cột 5: DevOps, Bảo mật & Khả năng Quan sát Nâng cao** (Pillar 5: DevOps, Security & Advanced Observability) as defined in the project plan.

### Components Documented:

| Component | Description | Directory |
|-----------|-------------|-----------|
| **Centralized Logging** | Grafana Loki + Promtail DaemonSet for log aggregation | `logging/` |
| **Distributed Tracing** | OpenTelemetry + Grafana Tempo for request tracing | `tracing/` |
| **Helm Charts** | Standardized Helm charts for multi-environment deployment | `helm/` |
| **Autoscaling & Policies** | HPA, CronJobs, NetworkPolicy for K8s operations | `helm/` & `runbooks/` |
| **CI/CD & GitOps** | GitHub Actions pipeline + ArgoCD GitOps workflow | `ci-cd/` |
| **Runbooks** | Operational troubleshooting guides | `runbooks/` |

---

## 🚀 Quick Links

### Logging
- [Loki Setup Guide](logging/loki-setup.md)
- [Promtail Configuration](logging/promtail-config.md)
- [Querying Logs in Grafana](logging/grafana-queries.md)

### Tracing
- [Tempo Setup Guide](tracing/tempo-setup.md)
- [OpenTelemetry Backend Integration](tracing/opentelemetry-backend.md)
- [Trace Analysis in Grafana](tracing/grafana-traces.md)

### Helm Charts
- [Chart Structure](helm/chart-structure.md)
- [Values Configuration](helm/values-configuration.md)
- [Multi-Environment Deployment](helm/multi-environment.md)

### CI/CD & GitOps
- [Pipeline Overview](ci-cd/pipeline-overview.md)
- [ArgoCD GitOps Workflow](ci-cd/argocd-gitops.md)
- [Deployment Strategies](ci-cd/deployment-strategies.md)

### Runbooks
- [Loki/Promtail Troubleshooting](runbooks/loki-promtail-troubleshooting.md)
- [Tempo Trace Analysis](runbooks/tempo-trace-analysis.md)
- [Helm Chart Deployment](runbooks/helm-deployment-guide.md)
- [HPA Tuning Guide](runbooks/hpa-tuning.md)
- [NetworkPolicy Management](runbooks/networkpolicy-management.md)
- [CI/CD Pipeline Usage](runbooks/cicd-pipeline-usage.md)
- [ArgoCD GitOps Workflow](runbooks/argocd-gitops-workflow.md)

---

## 🔗 Related Resources

- [Project README](../../README.md)
- [Work Assignment Plan](../../WORK_ASSIGNMENT.md)
- [Project Plan (PLAN.md)](../../PLAN.md)
- [Kubernetes Troubleshooting](../../K8S-TROUBLESHOOTING.md)
- [OpenAPI Specification](../../openapi.json)

---

## 📝 Contributing to Documentation

1. **Follow the existing structure** - Place new docs in the appropriate subdirectory
2. **Use consistent formatting** - Markdown with clear headings, code blocks, and examples
3. **Include validation steps** - Every guide should have verification commands
4. **Cross-reference related docs** - Link to related runbooks and guides

---

## 📞 Support

For questions or contributions, contact the **Documentation Pod** (`documentation_writer`).
