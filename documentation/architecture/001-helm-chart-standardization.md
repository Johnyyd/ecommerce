# 001 - Helm Chart Standardization for Multi-Environment Deployment

## Status
- [x] Accepted
- [ ] Proposed
- [ ] Superseded
- [ ] Deprecated

## Context
Before this decision, the project used static YAML manifests scattered in the `k8s/` directory. This approach led to:
- Inconsistent deployments across environments
- Manual copying and pasting of manifests for different environments
- Difficulty maintaining synchronization between environment-specific configurations
- No built-in mechanism for versioning and rolling back configurations
- Repetition of common configurations across multiple files

As the platform grew to include multiple services (backend, frontend, worker, database, caching, observability), managing these static manifests became increasingly error-prone and time-consuming.

## Decision
Adopt Helm Charts as the standard packaging format for all Kubernetes applications in the platform. Create a standardized Helm chart structure under `helm/ecommerce/` that includes:
- Base `Chart.yaml` with metadata
- `values.yaml` for default configuration
- Environment-specific values files (`values-dev.yaml`, `values-staging.yaml`, `values-prod.yaml`)
- Parameterized templates in `templates/` directory for all Kubernetes manifests
- Helper functions in `_helpers.tpl` for common template operations

This approach enables:
- Consistent, repeatable deployments across all environments
- Environment-specific configuration through values files
- Version control of infrastructure configurations
- Easy rollbacks to previous chart versions
- Template reuse and DRY principles for Kubernetes manifests
- Integration with CI/CD pipelines for automated testing and deployment

## Consequences
### Positive
- **Consistency**: All services deployed using the same Helm chart structure
- **Reusability**: Common templates and values reduce duplication
- **Environment Management**: Clear separation between dev, staging, and prod configurations
- **Versioning**: Infrastructure changes can be versioned and rolled back
- **CI/CD Integration**: Helm charts work naturally with GitHub Actions and ArgoCD
- **Discoverability**: Standard structure makes it easier for team members to find and modify configurations
- **Validation**: `helm lint` and `helm template` provide pre-deployment validation

### Negative
- **Learning Curve**: Team members need to learn Helm templating syntax
- **Initial Overhead**: Time required to convert existing manifests to Helm templates
- **Complexity**: Helm adds another layer of abstraction to understand
- **Debugging**: Troubleshooting may require understanding both Helm and Kubernetes

### Mitigations
- Provide Helm training and documentation for team members
- Create comprehensive examples in the `_helpers.tpl` file
- Maintain both Helm and raw Kubernetes documentation during transition
- Use `helm template` to preview generated manifests before deployment

## Related
- [002 - Centralized Logging with Loki+Promtail](./002-centralized-logging.md)
- [003 - Distributed Tracing with OpenTelemetry+Tempo](./003-distributed-tracing.md)
- [004 - GitOps with ArgoCD](./004-gitops-argocd.md)