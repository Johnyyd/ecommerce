# 📝 Promtail Configuration Guide

This guide covers the deployment and configuration of **Promtail** for shipping logs to Loki.

---

## 📋 Overview

**Promtail** is an agent that ships the contents of local logs to a private Grafana Loki instance. It is typically deployed as a DaemonSet to collect logs from all nodes in a Kubernetes cluster.

---

## 📦 Deployment File

### Promtail DaemonSet (`k8s/observability/promtail.yaml`)

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: promtail
  namespace: observability
spec:
  selector:
    matchLabels:
      app: promtail
  template:
    metadata:
      labels:
        app: promtail
    spec:
      serviceAccountName: promtail
      containers:
      - name: promtail
        image: grafana/promtail:2.9.0
        args:
          - -config.file=/etc/promtail/config.yaml
          - -client.external-labels=cluster=production
        volumeMounts:
        - name: config
          mountPath: /etc/promtail
        - name: varlog
          mountPath: /var/log
          readOnly: true
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        - name: kubelet
          mountPath: /var/lib/kubelet
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: promtail-config
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
      - name: kubelet
        hostPath:
          path: /var/lib/kubelet
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: promtail
  namespace: observability
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: promtail
rules:
- apiGroups: [""]
  resources: ["nodes", "nodes/proxy", "pods", "namespaces"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: promtail
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: promtail
subjects:
- kind: ServiceAccount
  name: promtail
  namespace: observability
```

---

## ⚙️ Configuration

### Promtail ConfigMap (`k8s/observability/promtail-config.yaml`)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: promtail-config
  namespace: observability
data:
  config.yaml: |
    server:
      http_listen_port: 9080
      grpc_listen_port: 0
    positions:
      filename: /tmp/positions.yaml
    clients:
    - url: http://loki.observability.svc.cluster.local:3100/loki/api/v1/push
    scrape_configs:
    - job_name: kubernetes-pods
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_promtail_io_scrape]
        action: keep
        regex: "true"
      - source_labels: [__meta_kubernetes_pod_annotation_promtail_io_path]
        action: replace
        target_label: __path__
        regex: (.+)
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: pod
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: replace
        target_label: app
      - source_labels: [__meta_kubernetes_pod_label_component]
        action: replace
        target_label: component
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
    - job_name: kubernetes-nodes
      kubernetes_sd_configs:
      - role: node
      relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)
```

---

## 🏷️ Log Labels

### Standard Labels Applied

| Label | Source | Description |
|-------|--------|-------------|
| `namespace` | `__meta_kubernetes_namespace` | Kubernetes namespace |
| `pod` | `__meta_kubernetes_pod_name` | Pod name |
| `app` | `__meta_kubernetes_pod_label_app` | Application label |
| `component` | `__meta_kubernetes_pod_label_component` | Component label |
| `container` | `__meta_kubernetes_pod_container_name` | Container name |

### Custom Labels (via Pod Annotations)

```yaml
annotations:
  promtail.io/scrape: "true"
  promtail.io/path: "/var/log/myapp/*.log"
```

---

## 🚀 Deployment Steps

### 1. Apply RBAC

```bash
kubectl apply -f k8s/observability/promtail-rbac.yaml
```

### 2. Apply ConfigMap

```bash
kubectl apply -f k8s/observability/promtail-config.yaml
```

### 3. Deploy Promtail

```bash
kubectl apply -f k8s/observability/promtail.yaml
```

### 4. Verify Deployment

```bash
kubectl get pods -n observability -l app=promtail
kubectl logs -n observability -l app=promtail
```

---

## ✅ Validation

### Check Promtail Metrics

```bash
# Port forward
kubectl port-forward -n observability daemonset/promtail 9080:9080

# Check targets
curl http://localhost:9080/api/targets

# Check metrics
curl http://localhost:9080/metrics
```

### Verify Logs in Loki

```bash
# Query Loki
curl -G -s "http://loki.observability.svc.cluster.local:3100/loki/api/v1/query" \
  --data-urlencode 'query={app="backend"}' \
  --data-urlencode 'limit=10'
```

---

## 🔧 Resource Limits

```yaml
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
```

---

## 🛠️ Troubleshooting

See [Loki/Promtail Troubleshooting Runbook](../runbooks/loki-promtail-troubleshooting.md)

---

## 📚 References

- [Promtail Documentation](https://grafana.com/docs/loki/latest/clients/promtail/)
- [Promtail Configuration](https://grafana.com/docs/loki/latest/clients/promtail/configuration/)
- [Kubernetes Service Discovery](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#kubernetes_sd_config)
