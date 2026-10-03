# 004 - GitOps with ArgoCD

## Status
- [x] Accepted
- [ ] Proposed
- [ ] Superseded
- [ ] Deprecated

## Context
Before implementing GitOps, deployment processes were:
- Manual application of Kubernetes manifests using `kubectl apply`
- Inconsistent deployment practices across team members
- Difficulty tracking what version of what configuration was deployed
- Manual rollback processes that were error-prone
- Lack of automated synchronization between Git repository and cluster state
- No visibility into deployment history or who made what changes
- Risk of configuration drift between Git and actual cluster state

As the platform adopted Helm charts for standardization and needed reliable, auditable deployments across multiple environments (dev, staging, prod), implementing GitOps became essential for deployment consistency and reliability.

## Decision
Implement GitOps using ArgoCD for continuous deployment and cluster state synchronization. Key aspects of this decision:

1. **ArgoCD Installation**:
   - Deploy ArgoCD in its own namespace (`argocd`)
   - Configure with appropriate security settings (SSO, RBAC, etc.)
   - Set up for high availability if needed for production

2. **Application Definition**:
   - Create ArgoCD Application resources for each environment
   - Point applications to the `helm/ecommerce` directory in the Git repository
   - Configure synchronization policies (automated pruning and self-healing)
   - Set up appropriate destination namespaces for each environment

3. **Integration** with CI/CD pipeline:
   - GitHub Actions pipeline builds and pushes Docker images
   - ArgoCD detects Helm chart changes and applies them to the cluster
   - Image updates trigger automatic deployments when values files are updated
   - Promotion between environments handled through Git operations

4. **Operational Practices**:
   - All cluster changes must be made through Git (no direct `kubectl` modifications)
   - Use of Helm values files for environment-specific configuration
   - Labeling and annotation strategies for resource identification
   - Backup and disaster recovery procedures for ArgoCD itself

## Consequences
### Positive
- **Consistency**: Exact same process for deploying to all environments
- **Auditability**: Complete Git history of all infrastructure changes
- **Automation**: Automatic synchronization when Git changes occur
- **Rollback**: Simple rollback by reverting Git commits
- **Self-Healing**: ArgoCD can automatically correct drift from desired state
- **Visibility**: Clear view of what is deployed and when it was deployed
- **Security**: Reduced need for direct cluster access; everything through Git
- **Developer Experience**: Developers can deploy by simply merging to Git

### Negative
- **Initial Setup**: Time required to install and configure ArgoCD
- **Learning Curve**: Team needs to learn ArgoCD concepts and CLI
- **Complexity**: Additional component to monitor and maintain
- **Git-Centric Workflow**: All changes must go through Git, which may slow emergency fixes
- **Resource Usage**: ArgoCD requires its own compute resources

### Mitigations
- Provide ArgoCD training and documentation for team members
- Implement proper RBAC and access controls for ArgoCD
- Set up monitoring and alerting for ArgoCD health and sync status
- Establish clear emergency procedures for when Git workflow is insufficient
- Use ArgoCD's built-in backup and disaster recovery features

## Related
- [001 - Helm Chart Standardization](./001-helm-chart-standardization.md)
- [002 - Centralized Logging with Loki+Promtail](./002-centralized-logging.md)
- [003 - Distributed Tracing with OpenTelemetry+Tempo](./003-distributed-tracing.md)