# 003 - Distributed Tracing with OpenTelemetry+Tempo

## Status
- [x] Accepted
- [ ] Proposed
- [ ] Superseded
- [ ] Deprecated

## Context
Before implementing distributed tracing, debugging performance issues and understanding request flows was challenging:
- Difficulty identifying bottlenecks in microservices architecture
- Inability to trace requests across service boundaries (frontend → backend → database → cache)
- Manual correlation of logs across different services was time-consuming
- Lack of visibility into end-to-end latency distribution
- No way to see which specific database queries or external API calls were slowing down requests
- Performance optimization efforts were often based on guesswork rather than data

As the platform adopted more microservices and external services (Meilisearch, Redis, PostgreSQL), the need for distributed tracing became essential for performance tuning and debugging complex issues.

## Decision
Implement distributed tracing using OpenTelemetry for instrumentation and Grafana Tempo as the trace storage backend. Key aspects of this decision:

1. **OpenTelemetry Instrumentation**:
   - Added OpenTelemetry SDK and instrumentation libraries to backend requirements
   - Created `backend/app/core/telemetry.py` for centralized tracing configuration
   - Automated instrumentation for FastAPI, SQLAlchemy, Redis, and HTTPX clients
   - Configured OTLP exporter to send traces to Tempo service
   - Implemented tracing middleware to extract/add trace context from/to HTTP headers
   - Enabled W3C Trace Context propagation for cross-service trace continuity

2. **Grafana Tempo** for trace storage:
   - Deployed Tempo to receive traces via OTLP/gRPC and OTLP/HTTP protocols
   - Integrated Tempo as a datasource in Grafana
   - Enabled trace-to-log correlation through trace ID extraction in Loki
   - Configured appropriate resource limits and persistence settings

3. **Integration** with existing observability stack:
   - Trace IDs extracted from logs and added as labels for correlation
   - Bidirectional navigation between logs in Loki and traces in Tempo
   - Unified observability experience in Grafana

## Consequences
### Positive
- **End-to-End Visibility**: Complete trace of requests from ingress to database and back
- **Performance Bottleneck Identification**: Clear visualization of where time is spent in each request
- **Cross-Service Correlation**: Ability to trace a single request across frontend, backend, and worker services
- **Root Cause Analysis**: Quick identification of slow database queries, external API calls, or processing steps
- **Service Dependency Mapping**: Automatic generation of service graphs based on trace data
- **Quality Assurance**: Ability to validate performance optimizations with concrete data
- **Production Debugging**: Real-time trace inspection for debugging issues in production

### Negative
- **Performance Overhead**: Instrumentation adds minimal CPU/memory overhead to services
- **Storage Requirements**: Traces require storage space, though typically less than logs
- **Complexity**: Additional components to configure, monitor, and maintain
- **Sampling Trade-offs**: Balancing trace completeness with storage/performance considerations
- **Learning Curve**: Team needs to understand trace concepts and query interfaces

### Mitigations
- Implement adaptive sampling to control trace volume based on traffic
- Provide training on trace interpretation and Grafana Tempo usage
- Monitor trace generation rates and adjust sampling accordingly
- Use resource limits and monitoring for Tempo instance
- Leverage existing OpenTelemetry instrumentation libraries to minimize custom code

## Related
- [001 - Helm Chart Standardization](./001-helm-chart-standardization.md)
- [002 - Centralized Logging with Loki+Promtail](./002-centralized-logging.md)
- [004 - GitOps with ArgoCD](./004-gitops-argocd.md)