# 🔍 Tempo Setup Guide

This guide covers the deployment and configuration of **Grafana Tempo** for distributed tracing.

---

## 📋 Overview

**Grafana Tempo** is an open-source, easy-to-use, and high-scale distributed tracing backend. It is designed to be cost-effective and integrates seamlessly with Grafana for visualization.

### Key Components

| Component | Description |
|-----------|-------------|
| **Tempo** | Trace storage and query backend (Deployment) |
| **OpenTelemetry Collector** | Receives traces from applications (optional) |
| **Grafana** | Visualization and trace analysis |

---

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│  Backend    │────▶│ OpenTelemetry   │────▶│    Tempo    │
│  (FastAPI)  │     │  Collector      │     │ (Deployment)│
└─────────────┘     └─────────────────┘     └─────────────┘
                                                │
                                                ▼
                                        ┌─────────────┐
                                        │  Grafana    │
                                        │  (Traces)   │
                                        └─────────────┘
```

---

## 📦 Deployment Files

### 1. Tempo Deployment (`k8s/observability/tempo.yaml`)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tempo
  namespace: observability
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tempo
  template:
    metadata:
      labels:
        app: tempo
    spec:
      containers:
      - name: tempo
        image: grafana/tempo:2.3.0
        args:
          - -config.file=/etc/tempo/tempo.yaml
        ports:
        - containerPort: 3100  # HTTP
        - containerPort: 9096  # gRPC
        - containerPort: 4317  # OTLP gRPC
        - containerPort: 4318  # OTLP HTTP
        volumeMounts:
        - name: config
          mountPath: /etc/tempo
        - name: data
          mountPath: /var/tempo
      volumes:
      - name: config
        configMap:
          name: tempo-config
      - name: data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: tempo
  namespace: observability
spec:
  selector:
    app: tempo
  ports:
  - name: http
    port: 3100
    targetPort: 3100
  - name: grpc
    port: 9096
    targetPort: 9096
  - name: otlp-grpc
    port: 4317
    targetPort: 4317
  - name: otlp-http
    port: 4318
    targetPort: 4318
```

### 2. Tempo Configuration (ConfigMap)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: tempo-config
  namespace: observability
data:
  tempo.yaml: |
    server:
      http_listen_port: 3100
      grpc_listen_port: 9096
    distributor:
      receivers:
        otlp:
          protocols:
            grpc:
              endpoint: 0.0.0.0:4317
            http:
              endpoint: 0.0.0.0:4318
        jaeger:
          protocols:
            thrift_http:
              endpoint: 0.0.0.0:14268
    ingester:
      trace_idle_period: 30s
      max_block_bytes: 1_000_000
      max_block_duration: 5m
    compactor:
      compaction:
        block_retention: 72h
        compacted_block_retention: 1h
    storage:
      trace:
        backend: local
        local:
          path: /var/tempo/traces
        pool:
          max_workers: 100
          queue_depth: 10000
    overrides:
      defaults:
        ingestion_rate_limit_bytes: 10485760
        ingestion_burst_size_bytes: 20971520
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
kubectl apply -f k8s/observability/tempo-config.yaml
```

### 3. Deploy Tempo

```bash
kubectl apply -f k8s/observability/tempo.yaml
```

### 4. Verify Deployment

```bash
kubectl get pods -n observability -l app=tempo
kubectl logs -n observability -l app=tempo
```

---

## ✅ Validation

### Check Tempo Health

```bash
# Port forward
kubectl port-forward -n observability svc/tempo 3100:3100

# Test endpoints
curl http://localhost:3100/ready
curl http://localhost:3100/metrics
```

### Verify Traces in Grafana

1. Open Grafana → **Explore**
2. Select **Tempo** datasource
3. Run a trace query or search by trace ID
4. Verify traces appear with spans

---

## 🔍 Trace Querying

### TraceQL (Tempo Query Language)

```traceql
# Find traces by service name
{service.name="backend"}

# Find traces with errors
{service.name="backend" && span.status=error}

# Find traces by duration
{service.name="backend" && duration>1s}

# Find traces by HTTP status
{service.name="backend" && http.status_code>=500}

# Find traces by attribute
{service.name="backend" && http.route="/api/v1/products/search"}
```

---

## 📊 Grafana Datasource Configuration

### Add Tempo Datasource

```yaml
apiVersion: 1
datasources:
- name: Tempo
  type: tempo
  access: proxy
  url: http://tempo.observability.svc.cluster.local:3100
  jsonData:
    httpMethod: GET
    tracesToLogs:
      datasourceUid: Loki
      tags: ['pod', 'namespace', 'container']
      spanStartTimeShift: -1h
      spanEndTimeShift: 1h
      filterByTraceID: true
      filterBySpanID: false
  editable: false
```

---

## 🛠️ Troubleshooting

See [Tempo Trace Analysis Runbook](../runbooks/tempo-trace-analysis.md)

---

## 📚 References

- [Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [Tempo Configuration](https://grafana.com/docs/tempo/latest/configuration/)
- [TraceQL Reference](https://grafana.com/docs/tempo/latest/traceql/)
