# Agent Specification Plan for Professional E-Commerce Team

## Overview
This document outlines the agent specifications needed to implement Trụ cột 5: DevOps, Bảo mật & Khả năng Quan sát Nâng cao (Observability & GitOps) based on the PLAN.md.

## Current Status
- **PLAN.md** has been analyzed and a detailed work assignment plan created
- **Rig topology** exists with 6 pods: devops, development, documentation, performance, product, testing
- **Agent specs** available for most roles but need to be added to the rig

## Agent Specifications Needed

### 1. DevOps Engineering Pod
**Members Required:**
- `devops-engineer` (implementer)
- `devops-architect` (orchestrator)

**Agent Specs Available:**
- `development/implementer` - Can be adapted for devops tasks
- `orchestration/orchestrator` - For architecture and coordination

### 2. Backend Development Pod
**Members Required:**
- `backend-engineer` (implementer)

**Agent Specs Available:**
- `development/implementer` - Already available

### 3. Quality Assurance Pod
**Members Required:**
- `qa-engineer` (qa agent)

**Agent Specs Available:**
- `development/qa` - Already available

### 4. Technical Documentation Pod
**Members Required:**
- `tech-writer` (implementer with documentation focus)

**Agent Specs Needed:**
- Create a new agent spec for technical writing

### 5. Performance Engineering Pod
**Members Required:**
- `performance-engineer` (implementer)

**Agent Specs Available:**
- `development/implementer` - Can be adapted for performance tasks

### 6. Product Management Pod
**Members Existing:**
- `product_owner` (current)

**Agent Specs Available:**
- `product-management/pm` - Already available

## Implementation Plan

### Phase 1: Rig Initialization
1. **Add missing agent specs** to the rig topology
2. **Assign members** to each pod using rig commands
3. **Configure edges** between pods for communication

### Phase 2: Task Assignment
1. **DevOps Pod**: Start with Loki + Promtail and Helm Charts
2. **Backend Pod**: Prepare for OpenTelemetry integration
3. **Testing Pod**: Set up validation environments
4. **Documentation Pod**: Prepare documentation templates
5. **Performance Pod**: Set up benchmarking baseline

### Phase 3: Implementation
1. **Task 1: Centralized Logging** (Loki + Promtail)
2. **Task 3: Helm Charts Standardization** (Parallel with Task 1)
3. **Task 2: Distributed Tracing** (Infrastructure + Backend integration)
4. **Task 4: Autoscaling, CronJob & NetworkPolicy**
5. **Task 5: CI/CD Pipeline & GitOps**

## Detailed Agent Specs to Create

### 1. Create a devops-engineer agent spec
```yaml
name: devops-engineer
version: "1.0"
description: DevOps engineer — implements infrastructure, Kubernetes, Helm, CI/CD, and GitOps

defaults:
  runtime: claude-code

imports:
  - ref: local:../../shared

profiles:
  default:
    uses:
      skills: [development-team, test-driven-development, systematic-debugging, verification-before-completion, kubernetes-skill]
      guidance: []
      subagents: []
      plugins: [shared:openrig-core]
      runtime_resources: [shared:claude-default-settings, shared:claude-default-mcp, shared:codex-default-config, shared:claude-activity-hooks]

resources:
  guidance:
    - id: role
      path: guidance/role.md

startup:
  files:
    - path: guidance/role.md
      delivery_hint: send_text
      required: true
  actions: []
```

### 2. Create a devops-architect agent spec
```yaml
name: devops-architect
version: "1.0"
description: DevOps architect — designs infrastructure, Kubernetes architecture, and GitOps strategy

defaults:
  runtime: claude-code

imports:
  - ref: local:../../shared

profiles:
  default:
    uses:
      skills: [orchestration-team, systematic-debugging, verification-before-completion, kubernetes-skill]
      guidance: []
      subagents: []
      plugins: [shared:openrig-core]
      runtime_resources: [shared:claude-default-settings, shared:claude-default-mcp, shared:codex-default-config, shared:claude-activity-hooks]

resources:
  guidance:
    - id: role
      path: guidance/role.md

startup:
  files:
    - path: guidance/role.md
      delivery_hint: send_text
      required: true
  actions: []
```

### 3. Create a tech-writer agent spec
```yaml
name: tech-writer
version: "1.0"
description: Technical writer — creates documentation, runbooks, and architecture decision records

defaults:
  runtime: claude-code

imports:
  - ref: local:../../shared

profiles:
  default:
    uses:
      skills: [development-team, write-docs, verification-before-completion]
      guidance: []
      subagents: []
      plugins: [shared:openrig-core]
      runtime_resources: [shared:claude-default-settings, shared:claude-default-mcp, shared:codex-default-config, shared:claude-activity-hooks]

resources:
  guidance:
    - id: role
      path: guidance/role.md

startup:
  files:
    - path: guidance/role.md
      delivery_hint: send_text
      required: true
  actions: []
```

### 4. Create a performance-engineer agent spec
```yaml
name: performance-engineer
version: "1.0"
description: Performance engineer — validates and optimizes system performance

defaults:
  runtime: claude-code

imports:
  - ref: local:../../shared

profiles:
  default:
    uses:
      skills: [development-team, audit-performance, verification-before-completion]
      guidance: []
      subagents: []
      plugins: [shared:openrig-core]
      runtime_resources: [shared:claude-default-settings, shared:claude-default-mcp, shared:codex-default-config, shared:claude-activity-hooks]

resources:
  guidance:
    - id: role
      path: guidance/role.md

startup:
  files:
    - path: guidance/role.md
      delivery_hint: send_text
      required: true
  actions: []
```

## Next Steps for You

1. **Create the missing agent specs** in `/home/tringuyen/Documents/GitHub/ecommerce/openrig-specs/agents/`
2. **Add the agent specs to the rig topology** using rig commands
3. **Assign members to pods** using:
   ```bash
   rig add professional-ecommerce-team devops devops-engineer-agent.yaml
   rig add professional-ecommerce-team devops devops-architect-agent.yaml
   ```
4. **Configure communication edges** between pods

## Implementation Tasks

### Task 1: Centralized Logging (Loki + Promtail)
- Create `k8s/observability/loki.yaml`
- Create `k8s/observability/promtail.yaml`
- Update `k8s/observability/grafana-datasources.yaml`

### Task 3: Helm Charts Standardization
- Create `helm/ecommerce/Chart.yaml`
- Create `helm/ecommerce/values.yaml`
- Create `helm/ecommerce/values-dev.yaml`
- Create `helm/ecommerce/values-prod.yaml`
- Create `helm/ecommerce/templates/` directory with all necessary templates

### Task 2: Distributed Tracing
- Update `backend/requirements.txt` with OpenTelemetry packages
- Create `backend/app/core/telemetry.py`

### Task 4: Autoscaling, CronJob & NetworkPolicy
- Create `k8s/hpa/backend-hpa.yaml`
- Create `k8s/cronjobs/reconcile-cronjob.yaml`
- Create `k8s/security/network-policy.yaml`

### Task 5: CI/CD Pipeline & GitOps
- Create `.github/workflows/ci.yml`
- Create `deploy/argocd/application.yaml`

## Validation Plan

1. **Loki Logs**: Query `{app="backend"} |= "ERROR"` should return backend logs
2. **Tempo Traces**: Request `/api/v1/products/search?q=phone` should show trace spans
3. **Helm Charts**: `helm lint ./helm/ecommerce` should return 0 errors
4. **HPA Scaling**: `kubectl get hpa` should show backend scaling from 2 to 8 pods
5. **CronJob**: `kubectl get cronjob` should show 0 2 * * * schedule
6. **NetworkPolicy**: NetworkPolicy should block unauthorized DB access
7. **CI/CD**: GitHub Actions should run green
8. **ArgoCD**: Application should show `Synced` and `Healthy` status

## Summary

The detailed work assignment plan and agent specifications are ready. The next steps are:

1. Create the missing agent specs in the appropriate directory
2. Add these agents to the rig topology
3. Assign members to pods and configure communication
4. Begin implementation with Phase 1 tasks

