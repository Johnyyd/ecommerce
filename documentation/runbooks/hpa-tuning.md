# 📊 HPA Tuning Guide

This guide covers configuring and tuning Horizontal Pod Autoscaler (HPA) for optimal performance.

---

## 📋 Overview

HPA automatically scales the number of pods in a replication controller, deployment, or replica set based on observed CPU utilization, memory utilization, and custom metrics.

---

## 🏗️ HPA Configuration

### Basic HPA YAML

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: ecommerce
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 8
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
      - type: Pods
        value: 4
        periodSeconds: 60
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
      selectPolicy: Min
```

---

## ⚙️ Configuration Parameters

### Scaling Thresholds

| Metric | Recommended | Description |
|--------|-------------|-------------|
| CPU | 60-70% | Target CPU utilization |
| Memory | 75-85% | Target memory utilization |
| Custom | Varies | Application-specific metrics |

### Scaling Behavior

| Parameter | Default | Recommended |
|-----------|---------|-------------|
| `minReplicas` | 1 | 2 (high availability) |
| `maxReplicas` | 10 | Based on cluster capacity |
| `stabilizationWindowSeconds` | 0 | 60s (scale up), 300s (scale down) |

---

## 📊 Scaling Policies

### Scale Up Policy

**Fast Response**:
```yaml
scaleUp:
  stabilizationWindowSeconds: 30
  policies:
  - type: Percent
    value: 200
    periodSeconds: 30
```

**Conservative Response**:
```yaml
scaleUp:
  stabilizationWindowSeconds: 60
  policies:
  - type: Percent
    value: 50
    periodSeconds: 60
```

### Scale Down Policy

**Aggressive**:
```yaml
scaleDown:
  stabilizationWindowSeconds: 60
  policies:
  - type: Percent
    value: 100
    periodSeconds: 60
```

**Conservative**:
```yaml
scaleDown:
  stabilizationWindowSeconds: 600
  policies:
  - type: Percent
    value: 10
    periodSeconds: 120
```

---

## 🎯 Custom Metrics

### Using Prometheus Adapter

```yaml
metrics:
- type: Pods
  pods:
    metric:
      name: http_requests_per_second
    target:
      type: AverageValue
      averageValue: "100"
```

### Custom Metrics API

```yaml
metrics:
- type: Object
  object:
    describedObject:
      apiVersion: v1
      kind: Service
      name: backend
    metric:
      name: requests-per-second
    target:
      type: Value
      value: "1000"
```

---

## ✅ Validation

### Check HPA Status

```bash
# View HPA
kubectl get hpa -n ecommerce

# Describe HPA
kubectl describe hpa backend-hpa -n ecommerce

# Check metrics
kubectl get hpa backend-hpa -n ecommerce -o yaml
```

### Simulate Load

```bash
# Install load testing tool
kubectl run loadgen --image=williamyeh/wrk -i --tty

# Inside pod
wrk -t12 -c400 -d30s http://backend:8000/api/v1/products/search?q=test
```

### Monitor Scaling

```bash
# Watch pod scaling
kubectl get pods -n ecommerce -w

# Watch HPA metrics
kubectl get hpa -n ecommerce -w
```

---

## 🛠️ Troubleshooting

### HPA Not Scaling

**Symptoms**: HPA shows 0%/0% utilization

**Diagnosis**:
```bash
# Check metrics-server
kubectl get pods -n kube-system | grep metrics-server

# Check HPA events
kubectl describe hpa backend-hpa -n ecommerce

# Check resource requests
kubectl get deployment backend -n ecommerce -o yaml | grep resources -A 10
```

**Common Fixes**:
1. Ensure pods have resource requests set
2. Verify metrics-server is running
3. Check HPA target reference matches deployment name

---

### Flapping (Rapid Scale Up/Down)

**Symptoms**: Pods scaling rapidly

**Solution**:
```yaml
behavior:
  scaleUp:
    stabilizationWindowSeconds: 60
  scaleDown:
    stabilizationWindowSeconds: 300
```

---

### HPA Stuck at Max Replicas

**Symptoms**: HPA at max but metrics indicate higher load

**Diagnosis**:
```bash
# Check CPU limits
kubectl top pod -n ecommerce

# Check node capacity
kubectl describe nodes | grep -A 5 "Allocated resources"
```

---

## 📊 Monitoring

### Key Metrics

| Metric | Description |
|--------|-------------|
| `kube_horizontalpodautoscaler_status_desired_replicas` | Target replica count |
| `kube_horizontalpodautoscaler_status_current_replicas` | Current replica count |
| `kube_horizontalpodautoscaler_spec_target_metric` | Target utilization |
| `kube_horizontalpodautoscaler_metrics_available` | Metrics availability |

### Prometheus Queries

```promql
# HPA Status
kube_horizontalpodautoscaler_status_desired_replicas{namespace="ecommerce"}

# Scaling events
rate(kube_horizontalpodautoscaler_spec_target_metric[5m])

# Pod count changes
changes(kube_deployment_status_replicas{namespace="ecommerce"}[1h])
```

---

## 🔧 Advanced Configuration

### Multiple Metrics HPA

```yaml
metrics:
- type: Resource
  resource:
    name: cpu
    target:
      type: Utilization
      averageUtilization: 70
- type: Resource
  resource:
    name: memory
    target:
      type: Utilization
      averageUtilization: 80
- type: Pods
  pods:
    metric:
      name: http_requests_per_second
    target:
      type: AverageValue
      averageValue: "1000"
```

### Pod Disruption Budget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: backend-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: backend
```

---

## 📚 Related Documentation

- [NetworkPolicy Management](networkpolicy-management.md)
- [Helm Deployment Guide](helm-deployment-guide.md)

---

## 📞 Support

For HPA tuning issues:
1. Check metrics-server health
2. Review scaling events
3. Analyze load patterns
4. Contact DevOps team
