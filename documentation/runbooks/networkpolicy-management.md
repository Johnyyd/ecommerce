# 🔐 NetworkPolicy Management Runbook

This runbook provides operational guidance for managing NetworkPolicies.

---

## 📋 Quick Operations

### List All Policies

```bash
kubectl get networkpolicy -n ecommerce
kubectl get networkpolicy -A
```

### View Policy Details

```bash
kubectl describe networkpolicy backend-to-database -n ecommerce
```

---

## 🔄 Common Operations

### Apply Network Policies

```bash
# Apply all policies
kubectl apply -f k8s/security/network-policy.yaml

# Apply specific policy
kubectl apply -f k8s/security/network-policy-backend.yaml
```

### Update Policy

```bash
# Edit policy
kubectl edit networkpolicy backend-to-database -n ecommerce

# Apply updated policy
kubectl apply -f k8s/security/network-policy-backend.yaml
```

### Delete Policy

```bash
kubectl delete networkpolicy backend-to-database -n ecommerce
```

---

## ✅ Validation

### Verify Policy Enforcement

```bash
# 1. Check policy exists
kubectl get networkpolicy -n ecommerce

# 2. Test allowed connection
kubectl exec -n ecommerce deployment/backend -- \
  nc -zv postgres 5432

# 3. Test denied connection
kubectl exec -n ecommerce deployment/frontend -- \
  nc -zv postgres 5432  # Should fail
```

### Audit Policy Coverage

```bash
# Check which pods have policies
kubectl get pods -n ecommerce -o json | \
  jq '.items[] | {name: .metadata.name, labels: .metadata.labels}'

# Verify all services covered
kubectl get svc -n ecommerce
```

---

## 🛠️ Troubleshooting

### Issue: Policy Not Taking Effect

**Resolution**:
```bash
# 1. Check CNI
kubectl get pods -n kube-system | grep -E "calico|cilium"

# 2. Restart CNI if needed
kubectl rollout restart daemonset calico-node -n kube-system

# 3. Verify policies
kubectl get networkpolicy -n ecommerce
```

### Issue: All Traffic Blocked

**Resolution**:
```bash
# 1. Check default deny policy
kubectl get networkpolicy default-deny-all -n ecommerce

# 2. Temporarily disable for testing
kubectl delete networkpolicy default-deny-all -n ecommerce

# 3. Apply specific policies
kubectl apply -f k8s/security/network-policy.yaml
```

---

## 📞 Support

Contact DevOps team for NetworkPolicy assistance.
