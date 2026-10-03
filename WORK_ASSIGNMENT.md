# Work Assignment Plan: Trụ cột 5 - DevOps, Bảo mật & Khả năng Quan sát Nâng cao

**Source**: PLAN.md (Trụ cột 5: DevOps, Bảo mật & Observability & GitOps)
**Status**: READY FOR IMPLEMENTATION
**Date**: 2026-10-01

---

## Pod Structure & Team Assignments

### 1. Pod: `devops` - DevOps Engineering
**Members needed**: `devops-engineer` (implementer), `devops-architect` (orchestrator)
**Responsibilities**: Infrastructure, Kubernetes, Helm, CI/CD, GitOps

**Assigned Tasks**:
- ✅ **Task 1**: Centralized Logging (Grafana Loki + Promtail DaemonSet)
- ✅ **Task 2**: Distributed Tracing (OpenTelemetry + Grafana Tempo) - Infrastructure part
- ✅ **Task 3**: Helm Charts Standardization & Multi-environment
- ✅ **Task 4**: HPA, CronJob, NetworkPolicy
- ✅ **Task 5**: CI/CD Pipeline (GitHub Actions) & ArgoCD GitOps

### 2. Pod: `development` - Backend Development
**Members needed**: `backend-engineer` (implementer)
**Responsibilities**: Backend code changes, OpenTelemetry integration, API changes

**Assigned Tasks**:
- ✅ **Task 2**: Distributed Tracing - Backend Integration
  - Add OpenTelemetry dependencies to `backend/requirements.txt`
  - Create `backend/app/core/telemetry.py` for TracerProvider & middleware
  - Integrate with FastAPI, SQLAlchemy, Redis instrumentation

### 3. Pod: `testing` - Quality Assurance
**Members needed**: `qa-engineer` (qa agent)
**Responsibilities**: Test creation, validation, E2E testing

**Assigned Tasks**:
- ✅ Validation Plan Execution (Section 5 of PLAN.md)
- ✅ Create tests for:
  - Loki log aggregation verification
  - Tempo trace verification
  - Helm chart lint & template tests
  - HPA scaling behavior tests
  - NetworkPolicy enforcement tests
  - CI/CD pipeline validation
  - ArgoCD sync verification

### 4. Pod: `documentation` - Technical Documentation
**Members needed**: `tech-writer` (implementer with documentation focus)
**Responsibilities**: Documentation, runbooks, architecture decision records

**Assigned Tasks**:
- ✅ Document all new observability components
- ✅ Create runbooks for:
  - Loki/Promtail troubleshooting
  - Tempo trace analysis
  - Helm chart deployment guide
  - HPA tuning guide
  - NetworkPolicy management
  - CI/CD pipeline usage
  - ArgoCD GitOps workflow

### 5. Pod: `performance` - Performance Engineering
**Members needed**: `performance-engineer` (implementer)
**Responsibilities**: Performance validation, benchmarking, optimization

**Assigned Tasks**:
- ✅ Benchmark Loki ingestion performance
- ✅ Benchmark Tempo trace throughput
- ✅ Validate HPA scaling thresholds
- ✅ Profile OpenTelemetry overhead on API latency
- ✅ Optimize Promtail resource usage

### 6. Pod: `product` - Product Management (Current: product_owner)
**Members**: `product_owner` (current)
**Responsibilities**: Coordination, prioritization, stakeholder communication

**Assigned Tasks**:
- ✅ Overall coordination & progress tracking
- ✅ Priority decisions & scope management
- ✅ Stakeholder updates
- ✅ Acceptance criteria validation

---

## Detailed Task Breakdown

### Task 1: Centralized Logging (Grafana Loki + Promtail)
**Owner**: devops-engineer
**Dependencies**: None
**Files to Create**:
- `k8s/observability/loki.yaml` - Loki StatefulSet + Service
- `k8s/observability/promtail.yaml` - Promtail DaemonSet
- `k8s/observability/grafana-datasources.yaml` - UPDATE: Add Loki datasource

**Validation**:
- Grafana Explore → Loki datasource → Query `{app="backend"} |= "ERROR"`

---

### Task 2: Distributed Tracing (OpenTelemetry + Grafana Tempo)
**Owner**: devops-engineer (infrastructure) + backend-engineer (integration)
**Dependencies**: Task 1 (Grafana datasources)
**Files to Create/Update**:
- `k8s/observability/tempo.yaml` - Tempo Deployment + Service
- `k8s/observability/grafana-datasources.yaml` - UPDATE: Add Tempo datasource
- `backend/requirements.txt` - UPDATE: Add OpenTelemetry packages
- `backend/app/core/telemetry.py` - CREATE: TracerProvider, middleware

**Validation**:
- Request `/api/v1/products/search?q=phone` → Trace visible in Tempo with spans for FastAPI, SQLAlchemy, Redis

---

### Task 3: Helm Charts Standardization
**Owner**: devops-engineer
**Dependencies**: Existing `k8s/` manifests
**Files to Create**:
```
helm/ecommerce/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-prod.yaml
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

**Validation**:
- `helm lint ./helm/ecommerce` → 0 errors
- `helm template ecommerce ./helm/ecommerce -f ./helm/ecommerce/values-dev.yaml` → Valid manifests

---

### Task 4: Autoscaling, CronJob & NetworkPolicy
**Owner**: devops-engineer
**Dependencies**: Task 3 (Helm charts for deployment)
**Files to Create**:
- `k8s/hpa/backend-hpa.yaml` - HPA (min: 2, max: 8, CPU 70%, Mem 80%)
- `k8s/cronjobs/reconcile-cronjob.yaml` - CronJob (0 2 * * *)
- `k8s/security/network-policy.yaml` - NetworkPolicy for DB/Redis isolation

**Validation**:
- `kubectl get cronjob` → Shows 0 2 * * *
- NetworkPolicy blocks unauthorized pod access to DB port 5432

---

### Task 5: CI/CD Pipeline & GitOps
**Owner**: devops-engineer
**Dependencies**: Task 3 (Helm charts)
**Files to Create**:
- `.github/workflows/ci.yml` - Multi-stage pipeline
- `deploy/argocd/application.yaml` - ArgoCD Application

**Validation**:
- GitHub Actions: All stages pass (Test, Security, Docker)
- ArgoCD: Application status `Synced` & `Healthy`

---

## Execution Order & Dependencies

```
Phase 1 (Parallel):
├── Task 1: Loki + Promtail (devops)
└── Task 3: Helm Charts (devops)

Phase 2 (After Phase 1):
├── Task 2a: Tempo Infrastructure (devops)
├── Task 2b: Backend OpenTelemetry Integration (backend-engineer)
└── Task 4: HPA, CronJob, NetworkPolicy (devops)

Phase 3 (After Phase 2):
├── Task 5: CI/CD + ArgoCD (devops)
└── Validation & Documentation (testing + documentation + performance)

Phase 4 (Continuous):
├── Performance benchmarking (performance)
├── Test execution (testing)
└── Documentation updates (documentation)
```

---

## Communication Protocol

### Inter-pod Communication:
- **devops → development**: Send OpenTelemetry integration requirements
- **devops → testing**: Provide test environments & validation criteria
- **devops → documentation**: Share architecture decisions & runbook topics
- **development → testing**: Provide API changes for test updates
- **performance → devops**: Share benchmark results for tuning

### Status Updates:
- Daily standup via `rig broadcast` to all pods
- Task completion → `rig send` to product_owner
- Blockers → `rig send` to product_owner with `escalates_to` edge

---

## Risk Mitigation

| Risk | Owner | Mitigation |
|------|-------|------------|
| Meilisearch resource consumption | performance | Set resource limits, monitor |
| OpenTelemetry overhead | performance | Benchmark, sample rate tuning |
| Silent data divergence | testing | Reconciliation validation tests |
| Helm chart migration issues | devops | Parallel run old/new, gradual cutover |
| CI/CD pipeline flakiness | testing | Retry logic, test isolation |

---

## Acceptance Criteria (Definition of Done)

- [ ] All 5 tasks implemented per PLAN.md specifications
- [ ] `helm lint` passes with 0 errors
- [ ] GitHub Actions CI pipeline runs green
- [ ] ArgoCD Application shows `Synced` + `Healthy`
- [ ] Loki queries return backend logs in Grafana
- [ ] Tempo shows distributed traces with proper spans
- [ ] HPA scales backend pods under load
- [ ] CronJob runs reconciliation at 02:00 daily
- [ ] NetworkPolicy blocks unauthorized DB access
- [ ] All validation tests in Section 5 pass
- [ ] Documentation complete for all new components

---

## Next Steps

1. **Product Owner** (current): Initialize rig with proper pod members
2. **DevOps Pod**: Start Task 1 & Task 3 in parallel
3. **Development Pod**: Prepare for Task 2b integration
4. **Testing Pod**: Set up test environments
5. **Documentation Pod**: Prepare documentation templates
6. **Performance Pod**: Set up benchmarking baseline

---

*This assignment plan should be communicated to all pod leads via rig messaging.*
