# 🔐 NetworkPolicy Management

This guide covers NetworkPolicy configuration for secure inter-service communication.

---

## 📋 Overview

NetworkPolicy provides network isolation for Kubernetes pods. It allows you to define which pods can communicate with each other within a namespace.

---

## 🏗️ Architecture

### Network Isolation Model

```
┌─────────────────────────────────────────────────────────┐
│ Namespace: ecommerce                                      │
│                                                          │
│  ┌─────────────┐        ┌─────────────┐                │
│  │   Backend   │◄───────►│  Frontend   │                │
│  │   Port 8000 │        │  Port 3000  │                │
│  └─────────────┘        └─────────────┘                │
│         │                       │                       │
│         ▼                       ▼                       │
│  ┌─────────────┐        ┌─────────────┐                │
│  │ PostgreSQL  │        │   Redis     │                │
│  │  Port 5432  │        │  Port 6379  │                │
│  └─────────────┘        └─────────────┘                │
│                                                          │
│  All access controlled by NetworkPolicy                  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Policy Definitions

### 1. Default Deny All

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: ecommerce
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

---

### 2. Allow Backend to Database

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-to-database
  namespace: ecommerce
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
```

---

### 3. Allow Frontend to Backend

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-to-backend
  namespace: ecommerce
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 8000
```

---

### 4. Database Isolation

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-isolation
  namespace: ecommerce
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 5432
  - from:
    - podSelector:
        matchLabels:
          app: pgbouncer
    ports:
    - protocol: TCP
      port: 5432
```

---

## ⚙️ Best Practices

### 1. Layered Security

```yaml
# Layer 1: Default deny
# Layer 2: Allow specific traffic
# Layer 3: Monitor violations
```

### 2. Label Consistency

```yaml
# Use consistent labels
labels:
  app: backend
  tier: application
  environment: production
```

### 3. Minimize Ports

```yaml
# Only open necessary ports
ports:
- protocol: TCP
  port: 5432  # Only DB port
```

---

## ✅ Validation

### Check Active Policies

```bash
kubectl get networkpolicy -n ecommerce
kubectl describe networkpolicy backend-to-database -n ecommerce
```

### Test Connectivity

```bash
# Test from backend pod
kubectl exec -it deployment/backend -n ecommerce -- \
  nc -zv postgres 5432

# Test from frontend pod
kubectl exec -it deployment/frontend -n ecommerce -- \
  nc -zv backend 8000
```

### Monitor Violations

```bash
# Enable network policy auditing
kubectl create configmap -n kube-system \
  network-policy-audit \
  --from-literal=audit.conf='...'

# Check Cilium metrics
kubectl port-forward -n kube-system svc/cilium 9090:9090
```

---

## 🛠️ Troubleshooting

### Connectivity Issues

**Symptoms**: Pods cannot connect

**Diagnosis**:
```bash
# Check policy conflicts
kubectl get networkpolicy -A -o yaml | grep -A 10 "policyTypes"

# Check pod labels
kubectl get pods -n ecommerce --show-labels

# Check if policy is applied
kubectl describe networkpolicy -n ecommerce
```

**Resolution**:
```bash
# Remove conflicting policy
kubectl delete networkpolicy default-deny-all -n ecommerce

# Apply correct policy
kubectl apply -f k8s/security/network-policy.yaml
```

---

### Policy Not Enforcing

**Symptoms**: Traffic not being blocked

**Diagnosis**:
```bash
# Check CNI plugin
kubectl get pods -n kube-system | grep -E "calico|cilium|weave"

# Check CNI configuration
kubectl get configmap -n kube-system cni-config -o yaml
```

---

## 📊 Monitoring

### Prometheus Metrics

| Metric | Description |
|--------|-------------|
| `network_policy_violations_total` | Policy violations |
| `cilium_drop_count` | Dropped packets |
| `calico_network_policy` | Policy enforcement |

### Example Alert

```yaml
- alert: NetworkPolicyViolation
  expr: increase(network_policy_violations_total[5m]) > 0
  for: 1m
  labels:
    severity: warning
  annotations:
    summary: NetworkPolicy violation detected
```

---

## 📚 Related Documentation

- [HPA Tuning Guide](hpa-tuning.md)
- [Helm Deployment Guide](helm-deployment-guide.md)

---

## 📞 Support

For NetworkPolicy issues:
1. Review policy labels
2. Check CNI plugin status
3. Test connectivity with `nc`
4. Contact DevOps team