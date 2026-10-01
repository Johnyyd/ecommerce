# 📝 Grafana Loki Queries Guide

This guide provides common and advanced queries for analyzing logs in Grafana using the Loki datasource.

---

## 📋 Basic Query Syntax

### LogQL (Loki Query Language)

```
{label="value"} |= "search term" |~ "regex" | json | logfmt | unpack
```

### Pipeline Stages

| Stage | Description |
|-------|-------------|
| `|=` | Contains string (case-sensitive) |
| `!=` | Does not contain string |
| `|~` | Regex match (case-sensitive) |
| `!~` | Regex no match |
| `| json` | Parse JSON log line |
| `| logfmt` | Parse logfmt log line |
| `| unpack` | Unpack labels into fields |

---

## 🔍 Common Queries

### By Application

```logql
# All backend logs
{app="backend"}

# All frontend logs
{app="frontend"}

# All worker logs
{app="worker"}

# Multiple apps
{app=~"backend|worker"}
```

### By Log Level

```logql
# Errors only
{app="backend"} |= "ERROR"

# Warnings and errors
{app="backend"} |~ "(ERROR|WARN)"

# Debug logs
{app="backend"} |= "DEBUG"
```

### By Namespace

```logql
# Production namespace
{namespace="production"}

# All namespaces except kube-system
{namespace!="kube-system"}
```

### By Pod

```logql
# Specific pod
{pod="backend-7d4f8b9c5-xyz12"}

# Pods matching pattern
{pod=~"backend-.*"}
```

---

## ⏱️ Time Range Queries

### Rate Calculations

```logql
# Log rate per second (5 min window)
sum(rate({app="backend"}[5m])) by (level)

# Error rate
sum(rate({app="backend"} |= "ERROR" [5m])) by (pod)

# Request rate by endpoint
sum(rate({app="backend"} | json | endpoint!="" [5m])) by (endpoint)
```

### Count Over Time

```logql
# Total errors in last hour
count_over_time({app="backend"} |= "ERROR" [1h])

# Error count by pod
sum(count_over_time({app="backend"} |= "ERROR" [1h])) by (pod)
```

---

## 📊 Aggregation Queries

### Top Errors

```logql
# Top 10 error messages
topk(10, sum by (message) (count_over_time({app="backend"} |= "ERROR" [1h])))

# Error rate by endpoint
sum by (endpoint) (rate({app="backend"} | json | endpoint!="" |= "ERROR" [5m]))
```

### Latency Analysis (if structured logs)

```logql
# Average latency by endpoint
avg_over_time({app="backend"} | json | duration!="" [5m])

# P95 latency
quantile_over_time(0.95, {app="backend"} | json | duration!="" [5m])
```

---

## 🎯 Advanced Queries

### Structured Log Parsing (JSON)

```logql
# Parse JSON and filter
{app="backend"} | json | level="error" | user_id!=""

# Extract fields
{app="backend"} | json | __error__="" | select(user_id, request_id, latency_ms)

# Aggregate by user
sum by (user_id) (count_over_time({app="backend"} | json | user_id!="" [1h]))
```

### Logfmt Parsing

```logql
# Parse logfmt
{app="backend"} | logfmt | level="error"

# Extract key=value pairs
{app="backend"} | logfmt | select(key1, key2)
```

### Pattern Detection

```logql
# Find stack traces
{app="backend"} |~ "Traceback|at .*\.py|File \""

# Find database errors
{app="backend"} |~ "(connection|timeout|deadlock|constraint).*error"

# Find specific HTTP status codes
{app="backend"} | json | status_code="500"
```

---

## 📈 Dashboard Panels

### Log Volume Panel

```logql
# Logs per minute by app
sum(rate({job=~".+"}[1m])) by (app)
```

### Error Rate Panel

```logql
# Error rate %
(sum(rate({app="backend"} |= "ERROR" [5m])) 
 / 
 sum(rate({app="backend"}[5m]))) * 100
```

### Top Endpoints Panel

```logql
# Top 10 endpoints by request count
topk(10, sum by (endpoint) (rate({app="backend"} | json | endpoint!="" [5m])))
```

---

## 💡 Tips & Best Practices

### 1. Use Label Filters First
```logql
# ✅ Good - filters early
{app="backend", namespace="production"} |= "ERROR"

# ❌ Bad - filters late
{namespace="production"} |= "ERROR" | app="backend"
```

### 2. Limit Results
```logql
# Limit to 100 lines
{app="backend"} |= "ERROR" | limit 100
```

### 3. Use Line Format for Display
```logql
# Show specific fields
{app="backend"} | json | line_format "{{.timestamp}} [{{.level}}] {{.message}}"
```

### 4. Time Range in Query
```logql
# Last 1 hour (if not using dashboard time picker)
{app="backend"} |= "ERROR" [1h]
```

---

## 🔗 Related Documentation

- [Loki Setup Guide](loki-setup.md)
- [Promtail Configuration](promtail-config.md)
- [Loki/Promtail Troubleshooting](../runbooks/loki-promtail-troubleshooting.md)

---

## 📚 References

- [LogQL Documentation](https://grafana.com/docs/loki/latest/logql/)
- [Grafana Loki Query Examples](https://grafana.com/docs/loki/latest/query/examples/)
