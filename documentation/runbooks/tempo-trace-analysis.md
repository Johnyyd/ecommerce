# 🔍 Tempo Trace Analysis Runbook

This runbook provides troubleshooting steps for Grafana Tempo distributed tracing.

---

## 📋 Quick Diagnostics

### Check Component Status

```bash
# Check Tempo pods
kubectl get pods -n observability -l app=tempo

# Check Tempo service
kubectl get svc -n observability -l app=tempo

# Check Tempo logs
kubectl logs -n observability -l app=tempo --tail=100
```

---

## 🔴 Critical Issues

### 1. No Traces Appearing

**Symptoms**: Traces not visible in Grafana

**Diagnosis**:
```bash
# Check Tempo health
kubectl port-forward -n observability svc/tempo 3100:3100
curl http://localhost:3100/ready

# Check Tempo metrics
curl http://localhost:3100/metrics | grep tempo_distributor

# Check application logs
kubectl logs -n ecommerce deployment/backend | grep "OpenTelemetry"
```

**Resolution**:
```bash
# 1. Verify Tempo endpoint reachable
kubectl exec -n ecommerce deployment/backend -- \
  wget -qO- http://tempo.observability.svc.cluster.local:3100/ready

# 2. Check network policies
kubectl get networkpolicy -n observability

# 3. Verify OpenTelemetry config
kubectl get configmap backend-config -n ecommerce -o yaml | grep -A 10 "TEMPO"
```

---

### 2. Traces Incomplete or Missing Spans

**Symptoms**: Trace shows only partial spans

**Diagnosis**:
```bash
# Check trace IDs in application logs
grep "trace_id" backend/logs/app.log | head

# Check Tempo ingestion rate
curl http://tempo:3100/metrics | grep tempo_ingester_bytes_total
```

**Resolution**:
```python
# Verify instrumentation is active
# Ensure instrument_sqlalchemy() is called
# Ensure instrument_redis() is called

# Check sampling rate
OTEL_TRACES_SAMPLER_ARG=0.1  # Should not be too low
```

---

### 3. High Latency in Trace Queries

**Symptoms**: Grafana trace queries timeout (>30s)

**Diagnosis**:
```bash
# Check Tempo resource usage
kubectl top pod -n observability -l app=tempo

# Check storage backend
kubectl exec -n observability -l app=tempo -- df -h /var/tempo
```

**Resolution**:
```yaml
# Increase resources
resources:
  limits:
    memory: "8Gi"
    cpu: "4000m"

# Adjust retention
compactor:
  compaction:
    block_retention: 72h
```

---

## 🟡 Performance Issues

### High Trace Volume

**Symptoms**: Tempo storage growing too fast

**Solutions**:
```yaml
# Enable sampling
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.01  # Sample 1%

# Adjust retention
compactor:
  compaction:
    block_retention: 24h
```

---

### Memory Pressure

**Symptoms**: Tempo OOMKilled

**Solutions**:
```yaml
# Increase memory limit
resources:
  limits:
    memory: "16Gi"

# Adjust ingester config
ingester:
  max_block_bytes: 500_000_000
  max_block_duration: 10m
```

---

## 🟢 Configuration Issues

### Incorrect Trace Labels

**Symptoms**: Traces missing expected labels

**Fix**:
```python
# Check resource attributes
resource = Resource.create({
    "service.name": "ecommerce-backend",
    "service.version": "1.0.0",
    "deployment.environment": "production",
})
```

### Trace Sampling Too Aggressive

**Symptoms**: Not enough traces for analysis

**Fix**:
```env
# Increase sampling (dev environment)
OTEL_TRACES_SAMPLER_ARG=1.0

# Production: Balance between visibility and cost
OTEL_TRACES_SAMPLER_ARG=0.1
```

---

## 🔍 Diagnostic Commands

```bash
# Check trace ingestion
curl -X POST http://tempo:4317/v1/traces \
  -H "Content-Type: application/x-protobuf" \
  --data-binary @test_trace.pb

# Search traces by service
curl -G "http://tempo:3100/api/search" \
  --data-urlencode 'q={service.name="ecommerce-backend"}' \
  --data-urlencode 'timeStart=2026-10-01T00:00:00Z'

# Check Tempo metrics
curl http://tempo:3100/metrics | grep -E "tempo_distributor|tempo_ingester|tempo_compiler"
```

---

## 📊 Common Trace Patterns

### Pattern 1: Slow Database Queries

**TraceQL**:
```traceql
{service.name="ecommerce-backend" && span.name=~"SELECT.*" && duration>500ms}
```

**Resolution**:
- Check database indexes
- Review query patterns
- Enable query caching

---

### Pattern 2: Missing Cache Hits

**TraceQL**:
```traceql
{service.name="ecommerce-backend" && span.name="redis.GET" && span.status!=OK}
```

**Resolution**:
- Check Redis availability
- Verify cache keys
- Review cache invalidation

---

### Pattern 3: High Error Rate

**TraceQL**:
```traceql
{service.name="ecommerce-backend" && span.status=error}
```

**Resolution**:
- Correlate with logs
- Check service dependencies
- Review error tracking

---

## 📊 Monitoring Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Tempo Down | `up{job="tempo"} == 0` | Critical |
| No Trace Ingestion | `rate(tempo_distributor_requests_total[5m]) == 0` | Warning |
| High Trace Latency | `histogram_quantile(0.95, tempo_request_duration_seconds) > 5s` | Warning |
| Storage Full | `tempo_storage_size_bytes > 90%` | Critical |
| Missing Spans | `tempo_ingester_incomplete_traces_total > 0` | Warning |

---

## 🔄 Recovery Procedures

### Restart Tempo

```bash
kubectl rollout restart deployment/tempo -n observability
kubectl wait --for=condition=Ready pods -l app=tempo -n observability --timeout=300s
```

### Clear Corrupted Blocks

```bash
# Enter Tempo pod
kubectl exec -it -n observability deployment/tempo -- sh

# Check storage
ls -lh /var/tempo/traces/

# Remove corrupted blocks (after backup)
rm -rf /var/tempo/traces/corrupted-block/
```

---

## 🐛 Debugging OpenTelemetry

### Enable Debug Logging

```python
import logging
logging.getLogger("opentelemetry").setLevel(logging.DEBUG)
logging.getLogger("opentelemetry.instrumentation").setLevel(logging.DEBUG)
```

### Verify Exporter Connection

```python
# Test OTLP connection
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

exporter = OTLPSpanExporter(endpoint="http://tempo:3100/otlp/v1/traces")
exporter.export(spans)  # Test export
```

---

## 📚 Related Documentation

- [Tempo Setup Guide](../tracing/tempo-setup.md)
- [OpenTelemetry Backend Integration](../tracing/opentelemetry-backend.md)
- [Grafana Trace Analysis](../tracing/grafana-traces.md)

---

## 📞 Escalation

If traces still not appearing:
1. Check network policies
2. Verify service DNS resolution
3. Review OpenTelemetry logs
4. Contact DevOps team
