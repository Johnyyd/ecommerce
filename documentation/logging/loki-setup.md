# 📝 Loki Setup Guide

This guide covers the deployment and configuration of **Grafana Loki** for centralized logging in the Professional E-Commerce Platform.

---

## 📋 Overview

**Grafana Loki** is a horizontally-scalable, highly-available, multi-tenant log aggregation system inspired by Prometheus. It is designed to be cost-effective and easy to operate, as it does not index the contents of the logs, but rather a set of labels for each log stream.

### Key Components

| Component | Description |
|-----------|-------------|
| **Loki** | Main log aggregation service (StatefulSet) |
| **Promtail** | Log shipper (DaemonSet) - collects logs from pods |
| **Grafana** | Visualization and querying interface |

---

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Pod Logs   │────▶│  Promtail   │────▶│    Loki     │
│  (stdout)   │     │  (DaemonSet)│     │ (StatefulSet)│
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
                                                ▼
                                        ┌─────────────┐
                                        │  Grafana    │
                                        │  (Query)    │
                                        └─────────────┘
```

---

## 📦 Deployment Files

### 1. Loki StatefulSet (`k8s/observability/loki.yaml`)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: loki
  namespace: observability
spec:
  serviceName: loki
  replicas: 1
  selector:
    matchLabels:
      app: loki
  template:
    metadata:
      labels:
        app: loki
    spec:
      containers:
      - name: loki
        image: grafana/loki:2.9.0
        args:
          - -config.file=/etc/loki/local-config.yaml
        ports:
        - containerPort: 3100
        volumeMounts:
        - name: config
          mountPath: /etc/loki
        - name: data
          mountPath: /loki
      volumes:
      - name: config
        configMap:
          name: loki-config
      - name: data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: loki
  namespace: observability
spec:
  selector:
    app: loki
  ports:
  - port: 3100
    targetPort: 3100
  clusterIP: None
```

### 2. Loki Configuration (ConfigMap)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
  namespace: observability
data:
  local-config.yaml: |
    auth_enabled: false
    server:
      http_listen_port: 3100
      grpc_listen_port: 9096
    common:
      path_prefix: /loki
      storage:
        filesystem:
          chunks_directory: /loki/chunks
          rules_directory: /loki/rules
      replication_factor: 1
      ring:
        instance_addr: 127.0.0.1
        kvstore:
          store: inmemory
    schema_config:
      configs:
      - from: 2020-10-24
        store: boltdb-shipper
        object_store: filesystem
        schema: v11
        index:
          prefix: index_
          period: 24h
    limits_config:
      reject_old_samples: true
      reject_old_samples_max_age: 168h
    chunk_store_config:
      max_look_back_period: 30d
    table_manager:
      retention_deletes_enabled: true
      retention_period: 30d
```

---

## 🔧 Configuration

### Resource Limits

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "1Gi"
  limits:
    cpu: "2000m"
    memory: "4Gi"
```

### Persistence (Production)

```yaml
volumeClaimTemplates:
- metadata:
    name: data
  spec:
    accessModes: ["ReadWriteOnce"]
    storageClassName: "fast-storage"
    resources:
      requests:
        storage: 50Gi
```

---

## 🚀 Deployment Steps

### 1. Create Namespace

```bash
kubectl create namespace observability
```

### 2. Apply ConfigMap

```bash
kubectl apply -f k8s/observability/loki-config.yaml
```

### 3. Deploy Loki

```bash
kubectl apply -f k8s/observability/loki.yaml
```

### 4. Verify Deployment

```bash
kubectl get pods -n observability -l app=loki
kubectl logs -n observability -l app=loki
```

---

## ✅ Validation

### Check Loki Health

```bash
# Port forward
kubectl port-forward -n observability svc/loki 3100:3100

# Test endpoint
curl http://localhost:3100/ready
curl http://localhost:3100/metrics
```

### Query Logs in Grafana

1. Open Grafana → **Explore**
2. Select **Loki** datasource
3. Run query: `{app="backend"} |= "ERROR"`
4. Verify logs appear

---

## 🔍 Common Queries

| Query | Description |
|-------|-------------|
| `{app="backend"}` | All backend logs |
| `{app="backend"} |= "ERROR"` | Backend errors only |
| `{app="backend"} |~ "timeout|connection refused"` | Regex search |
| `sum by (level) (count_over_time({app="backend"}[5m]))` | Log rate by level |

---

## 🛠️ Troubleshooting

See [Loki/Promtail Troubleshooting Runbook](../runbooks/loki-promtail-troubleshooting.md)

---

## 📚 References

- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Loki Configuration Reference](https://grafana.com/docs/loki/latest/configuration/)
- [Grafana Loki Best Practices](https://grafana.com/docs/loki/latest/best-practices/)
