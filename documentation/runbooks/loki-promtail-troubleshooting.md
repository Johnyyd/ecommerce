# 🔧 Loki/Promtail Troubleshooting Runbook

This runbook provides troubleshooting steps for Grafana Loki and Promtail issues.

---

## 📋 Quick Diagnostics

### Check Component Status

```bash
# Check Loki pods
kubectl get pods -n observability -l app=loki

# Check Promtail pods
kubectl get pods -n observability -l app=promtail

# Check services
kubectl get svc -n observability

# Check configs
kubectl get configmap -n observability | grep -E "loki|promtail"
```

---

## 🔴 Critical Issues

### 1. Loki Not Accepting Logs

**Symptoms**: Logs not appearing in Grafana, 400/500 errors in Promtail

**Diagnosis**:
```bash
# Check Loki logs
kubectl logs -n observability -l app=loki --tail=100

# Check Loki readiness
kubectl exec -n observability deployment/loki -- wget -qO- http://localhost:3100/ready

# Check Promtail connections
kubectl logs -n observability -l app=promtail | grep -i "error\|failed"
```

**Resolution**:
```bash
# 1. Restart Loki
kubectl rollout restart deployment/loki -n observability

# 2. Check service DNS
kubectl exec -n observability -l app=promtail -- nslookup loki

# 3. Verify network policy
kubectl get networkpolicy -n observability
```

---

### 2. Promtail Not Shipping Logs

**Symptoms**: Promtail running but no logs in Loki

**Diagnosis**:
```bash
# Check Promtail targets
kubectl port-forward -n observability daemonset/promtail 9080:9080
curl http://localhost:9080/api/targets

# Check Promtail config
kubectl get configmap promtail-config -n observability -o yaml

# Check node filesystem access
kubectl exec -n observability -l app=promtail -- ls /var/log/
```

**Resolution**:
```bash
# 1. Reload Promtail config
kubectl rollout restart daemonset/promtail -n observability

# 2. Check pod annotations
kubectl get pods -n ecommerce -o yaml | grep promtail

# 3. Verify log paths
kubectl exec -n observability -l app=promtail -- cat /etc/promtail/config.yaml
```

---

### 3. High Memory Usage in Loki

**Symptoms**: Loki OOMKilled, slow queries

**Diagnosis**:
```bash
# Check resource usage
kubectl top pod -n observability -l app=loki

# Check Loki metrics
kubectl port-forward -n observability svc/loki 3100:3100
curl http://localhost:3100/metrics | grep loki_ingester
```

**Resolution**:
```yaml
# Increase resources
resources:
  limits:
    memory: "8Gi"
    cpu: "4000m"

# Adjust retention
chunk_store_config:
  max_look_back_period: 24h
table_manager:
  retention_period: 7d
```

---

### 4. Log Loss or Duplication

**Symptoms**: Duplicate logs or missing logs

**Diagnosis**:
```bash
# Check Promtail positions file
kubectl exec -n observability -l app=promtail -- cat /tmp/positions.yaml

# Check for multiple Promtail instances
kubectl get pods -n observability -l app=promtail -o wide
```

**Resolution**:
```bash
# 1. Verify only one Promtail per node
# 2. Clear positions file if corrupt
kubectl exec -n observability -l app=promtail -- rm /tmp/positions.yaml
kubectl rollout restart daemonset/promtail -n observability
```

---

## 🟡 Performance Issues

### Slow Query Performance

**Symptoms**: Grafana queries timeout

**Optimization**:
```yaml
# Increase query timeout
limits_config:
  max_query_length: 30m
  max_query_parallelism: 32
```

**Query Tips**:
```logql
# Use labels for filtering (faster)
{app="backend"} |= "error"

# Avoid late filtering
{app="backend"} | json | level="error"
```

---

### High Ingestion Rate

**Symptoms**: Promtail backpressure, dropped logs

**Solutions**:
```yaml
# Increase batch size
clients:
- url: http://loki:3100/loki/api/v1/push
  batch:
    wait: 1s
    size: 102400
```

---

## 🟢 Configuration Issues

### Incorrect Labels

**Symptoms**: Logs with wrong labels

**Fix**:
```yaml
# Add relabel config
relabel_configs:
- source_labels: [__meta_kubernetes_pod_label_app]
  target_label: app
```

### Missing Logs

**Symptoms**: Specific containers not shipping logs

**Check**:
```bash
# Verify pod annotations
kubectl annotate pod <pod-name> promtail.io/scrape=true

# Check container name
kubectl exec -n observability -l app=promtail -- find /var/log/containers -name "*<namespace>_<pod>_*"
```

---

## 🔍 Diagnostic Commands

```bash
# Check Loki health
curl http://loki.observability.svc.cluster.local:3100/ready

# Check Promtail health
curl http://promtail.observability.svc.cluster.local:9080/metrics

# Test log ingestion
echo '{"level":"info","msg":"test"}' | \
  curl -s -H 'Content-Type: application/json' \
  --data-binary @- http://loki:3100/loki/api/v1/push

# Query Loki directly
curl -G -s "http://loki:3100/loki/api/v1/query" \
  --data-urlencode 'query={app="backend"}' \
  --data-urlencode 'limit=10'
```

---

## 📊 Monitoring Alerts

### Recommended Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Loki Down | `up{job="loki"} == 0` | Critical |
| Promtail Down | `up{job="promtail"} == 0` | Critical |
| High Error Rate | `rate(loki_request_errors_total[5m]) > 0.01` | Warning |
| High Memory | `container_memory_working_set_bytes > 80%` | Warning |
| Log Loss | `increase(promtail_dropped_entries_total[5m]) > 0` | Critical |

---

## 🔄 Recovery Procedures

### Restart All Components

```bash
# Restart Loki
kubectl rollout restart statefulset/loki -n observability

# Restart Promtail
kubectl rollout restart daemonset/promtail -n observability

# Verify all pods healthy
kubectl wait --for=condition=Ready pods -l app=loki -n observability --timeout=300s
kubectl wait --for=condition=Ready pods -l app=promtail -n observability --timeout=300s
```

---

## 📚 Related Documentation

- [Loki Setup Guide](../logging/loki-setup.md)
- [Promtail Configuration](../logging/promtail-config.md)
- [Grafana Queries](../logging/grafana-queries.md)

---

## 📞 Escalation

If issues persist after troubleshooting:
1. Check GitHub Issues
2. Contact DevOps team
3. Review [K8S Troubleshooting](../../K8S-TROUBLESHOOTING.md)
