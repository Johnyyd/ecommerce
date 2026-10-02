# 002 - Centralized Logging with Loki+Promtail

## Status
- [x] Accepted
- [ ] Proposed
- [ ] Superseded
- [ ] Deprecated

## Context
Before implementing centralized logging, developers and operators had to:
- Use `kubectl logs` to inspect logs from individual pods
- SSH into nodes to access container log files
- Correlate logs across multiple services manually
- Struggle with log persistence when pods were restarted or rescheduled
- Lack real-time log aggregation and search capabilities
- Miss important error patterns due to fragmented log viewing

As the platform adopted microservices architecture with multiple backend services, frontend, and workers, the need for centralized, searchable log storage became critical for debugging production issues and monitoring system health.

## Decision
Implement centralized logging using Grafana Loki as the log storage backend and Promtail as the agent for collecting logs from Kubernetes nodes. Key aspects of this decision:

1. **Loki** for log storage:
   - Deployed as a StatefulSet with persistent volume for log retention
   - Configured with 7-day retention period (168 hours)
   - Secured with non-root user, read-only filesystem, and seccomp profile
   - Integrated with Grafana via Loki datasource

2. **Promtail** for log collection:
   - Deployed as a DaemonSet to ensure one agent per node
   - Configured to scrape logs from `/var/log/pods` directory
   - Set up to parse JSON logs and extract labels (app, pod, namespace)
   - Implemented password masking pipeline to prevent credential leakage
   - Configured to add trace_id correlation for linking logs with traces

3. **Integration** with observability stack:
   - Loki datasource added to Grafana for log querying
   - Trace ID extraction enables linking logs to Tempo traces
   - Structured JSON logging format from backend applications

## Consequences
### Positive
- **Centralized View**: All logs accessible through Grafana Explore interface
- **Powerful Querying**: LogQL enables sophisticated log filtering and analysis
- **Correlation**: Trace ID linking allows navigation from logs to traces and vice versa
- **Persistence**: Logs survive pod restarts and node rescheduling
- **Security**: Sensitive data masking prevents credential leakage in logs
- **Scalability**: Loki's horizontal scaling handles growing log volumes
- **Cost-Effective**: Loki's object storage approach is cheaper than Elasticsearch alternatives

### Negative
- **Query Performance**: Complex LogQL queries can be slower than indexed databases
- **Limited Features**: Loki lacks some advanced querying capabilities of Elasticsearch
- **Operational Overhead**: Additional components to monitor and maintain
- **Storage Planning**: Need to manage PVC sizes and retention policies carefully

### Mitigations
- Provide LogQL training and query examples in documentation
- Implement proper resource limits and monitoring for Loki/Promtail
- Use label-based filtering for optimal query performance
- Regular review of retention policies based on storage capacity
- Alerting on ingestion rates and error patterns

## Related
- [001 - Helm Chart Standardization](./001-helm-chart-standardization.md)
- [003 - Distributed Tracing with OpenTelemetry+Tempo](./003-distributed-tracing.md)
- [004 - GitOps with ArgoCD](./004-gitops-argocd.md)