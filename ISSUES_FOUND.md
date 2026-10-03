# Issues Found in Pillar 5 Implementation

## 1. Logical Error in Promtail Pipeline (CRITICAL)

**File:** `helm/ecommerce/templates/promtail.yaml`
**Lines:** 107-116

**Issue:** The match stage that drops logs containing "password" comes before the taint stage that would redact passwords. This causes the log entries to be dropped entirely before password redaction can occur, defeating the purpose of the taint stage.

**Current Order:**
```yaml
pipeline_stages:
- json:
    expressions:
      level: level
- match:
    selector: '{level="ERROR"} |= "password"'
    drop: true
- taint:
    key: password
    value: redacted
    action: replace
```

**Problem:** When a log entry matches the selector `{level="ERROR"} |= "password"`, it is immediately dropped (`drop: true`) and never reaches the taint stage that would redact the password field.

**Recommended Fix:** Move the taint stage before the match stage, or remove the match stage entirely if the goal is to redact rather than drop:

```yaml
pipeline_stages:
- json:
    expressions:
      level: level
- taint:
    key: password
    value: redacted
    action: replace
- match:
    selector: '{level="ERROR"} |= "password"'
    drop: true
```

## 2. Environment Variable Naming Confusion (LOW)

**File:** `helm/ecommerce/values.yaml`
**Line:** 5

**Issue:** The backend environment variable `POSTGRES_PORT` is set to `'6432'` (the pgbouncer port), which is confusing naming since it's not actually the PostgreSQL port.

**Current:**
```yaml
backend:
  env:
    BACKUP_DIR: /backups
    POSTGRES_PORT: '6432'  # Misleading - this is actually pgbouncer port
    POSTGRES_SERVER: pgbouncer
```

**Recommendation:** Consider renaming to `PGBOUNCER_PORT` for clarity, or add a comment explaining that this is the pgbouncer port.

## 3. Missing Resource Requests/Limits for Observability Components (MEDIUM)

**Issue:** While the observability components (Loki, Tempo, Promtail) have resource definitions, they may be undersized for production workloads.

**Loki/resources.yaml:** 
- Requests: 100m CPU, 256Mi Memory
- Limits: 500m CPU, 1Gi Memory

**Tempo/resources.yaml:**
- Requests: 100m CPU, 256Mi Memory
- Limits: 500m CPU, 1Gi Memory

**Promtail/resources.yaml:**
- Requests: 50m CPU, 128Mi Memory
- Limits: 200m CPU, 256Mi Memory

**Recommendation:** Review and adjust resource allocations based on expected log volume and trace data. Loki storage persistence is configured with 10Gi which may need adjustment based on retention requirements.

## 4. Network Policy Egress Rules Verification (LOW)

**Issue:** Verify that the postgres network policy egress rules are sufficient for potential backup or replication needs.

**Current postgres-isolation policy:**
```yaml
egress: []  # No egress allowed
```

**Recommendation:** Confirm with architecture requirements whether PostgreSQL needs to initiate outbound connections (e.g., for WAL archiving, logical replication, or backup tools). If needed, add appropriate egress rules.

## 5. Prometheus ServiceMonitor Missing (OPTIONAL)

**Issue:** While Prometheus is deployed, there are no ServiceMonitor definitions to automatically discover and monitor the application services.

**Recommendation:** Consider adding ServiceMonitor CRDs for automatic scraping of backend/frontend/worker services if using the Prometheus Operator.
