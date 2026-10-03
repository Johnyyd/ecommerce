# 📝 Grafana Trace Analysis

This guide covers analyzing distributed traces in Grafana using Tempo.

---

## 📋 Overview

Grafana provides a powerful visualization interface for distributed traces collected by Tempo. You can inspect full request flows, identify bottlenecks, and correlate traces with logs and metrics.

---

## 🔍 Accessing Traces

### Step 1: Open Explore

1. Open Grafana Dashboard
2. Navigate to **Explore**
3. Select **Tempo** datasource from dropdown

### Step 2: Search for Traces

| Method | Description |
|--------|-------------|
| **Trace ID** | Search for specific trace by ID |
| **TraceQL** | Query traces using TraceQL |
| **Time Range** | Filter by time window |
| **Service Name** | Filter by service |

---

## 🎯 TraceQL Examples

### Basic Queries

```traceql
# All traces from backend service
{service.name="ecommerce-backend"}

# Traces with HTTP errors
{service.name="ecommerce-backend" && http.status_code>=500}

# Slow traces (>1 second)
{service.name="ecommerce-backend" && duration>1s}

# Traces from specific endpoint
{service.name="ecommerce-backend" && http.route="/api/v1/products/search"}
```

### Advanced Queries

```traceql
# Find traces with database errors
{service.name="ecommerce-backend" && span.name=~"SELECT.*" && span.status=error}

# Traces with high latency spans
{service.name="ecommerce-backend" && duration>5s || span.duration>500ms}

# Find traces with missing cache
{service.name="ecommerce-backend" && span.name="redis.GET" && span.status=error}
```

---

## 📊 Trace Visualization

### Trace Timeline

The trace view shows spans on a horizontal timeline:

```
┌─────────────────────────────────────────────────────────┐
│ Trace Timeline                                          │
├─────────────────────────────────────────────────────────┤
│ HTTP Request (2.5s)                                     │
│  ├─ FastAPI Middleware (10ms)                           │
│  ├─ Authentication (50ms)                               │
│  ├─ Product Lookup (500ms)                              │
│  │   ├─ Redis GET (5ms) ✓                               │
│  │   └─ PostgreSQL Query (495ms)                        │
│  └─ Response Serialization (15ms)                       │
└─────────────────────────────────────────────────────────┘
```

### Span Details

Click on any span to view:

- **Span Name**: Operation name
- **Duration**: Time taken
- **Start Time**: When span started
- **Attributes**: Key-value metadata
- **Events**: Timeline events
- **Logs**: Associated log entries
- **Tags**: Additional labels

---

## 🔗 Correlating Traces with Logs

### Link Traces to Logs

Enable log correlation in Grafana datasource settings:

```yaml
tracesToLogs:
  datasourceUid: Loki
  tags:
    - pod
    - namespace
    - container
```

### Navigate from Trace to Logs

1. Click on a span in trace view
2. Click **Logs** tab
3. Filter logs by trace ID, span ID
4. View logs in Loki

---

## 📈 Trace Analysis Patterns

### Performance Bottlenecks

```traceql
# Find slowest spans
{service.name="ecommerce-backend"} | span.duration

# Find database query patterns
{service.name="ecommerce-backend" && span.name=~"SELECT|INSERT|UPDATE"}
```

**Analysis Steps**:
1. Identify longest-running spans
2. Check database query patterns
3. Look for N+1 query problems
4. Review connection pooling

### Error Analysis

```traceql
# Find all error traces
{service.name="ecommerce-backend" && span.status=error}

# Find specific error types
{service.name="ecommerce-backend" && span.status=error && error.message=~"timeout"}
```

**Analysis Steps**:
1. Group errors by span name
2. Check error rate trends
3. Correlate with logs
4. Identify root cause

### Dependency Analysis

```traceql
# Show service dependencies
{service.name="ecommerce-backend"} | span.name
```

**Analysis Steps**:
1. Map service call graph
2. Identify downstream services
3. Check latency propagation
4. Find circular dependencies

---

## 📊 Creating Trace Dashboards

### Trace Overview Dashboard

| Panel | Query | Description |
|-------|-------|-------------|
| Request Rate | `{service.name="ecommerce-backend"}` | Requests per minute |
| Error Rate | `{service.name="ecommerce-backend" && span.status=error}` | Error percentage |
| P95 Latency | `{service.name="ecommerce-backend"}` | 95th percentile |
| Slow Traces | `{service.name="ecommerce-backend" && duration>2s}` | Slow requests |

### Service Map

Grafana automatically generates a service map showing:

- Service dependencies
- Request volume
- Error rates per service
- Latency heatmaps

---

## 🔧 Advanced Features

### Trace Search

```traceql
# Search by trace ID
{trace_id="a1b2c3d4e5f6"}

# Search by span ID
{span_id="1234567890abcdef"}
```

### Trace Compare

Compare two traces side-by-side:

1. Select first trace
2. Click **Compare**
3. Select second trace
4. Analyze differences

### Trace Annotations

Add annotations to traces:

- Mark deployments
- Tag incidents
- Correlate with metrics

---

## 🛠️ Troubleshooting

See [Tempo Trace Analysis Runbook](../runbooks/tempo-trace-analysis.md)

---

## 📚 References

- [Grafana Tracing Documentation](https://grafana.com/docs/grafana/latest/explore/tracing/)
- [TraceQL Reference](https://grafana.com/docs/tempo/latest/traceql/)
- [Grafana Tempo Datasource](https://grafana.com/docs/grafana/latest/variables/)
