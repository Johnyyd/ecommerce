# Meilisearch Vietnamese Search Configuration

This guide covers configuring Meilisearch for Vietnamese language search in the e-commerce platform.

## Overview

The platform uses **Meilisearch v1.11+** (deployed via Helm) with optimized Vietnamese search support:
- Typo tolerance optimized for Vietnamese diacritics
- Faceted search and filtering support
- Performance optimizations: `searchCutoffMs: 50` for fast partial results
- Cache warming endpoint for popular queries

> **Note**: The native Vietnamese tokenizer (`"tokenizer": "vi"`) requires Meilisearch v1.11+ but is currently not enabled in the index settings. The platform achieves excellent Vietnamese search results through typo tolerance and proper filtering configuration. See [Performance Optimization Report](performance-optimization-report.md) for details on achieving p95=100ms latency.

---

## Configuration Details

### Index Settings (Actual Implementation)

The products index is configured with the following settings in `backend/app/services/search_service.py`:

```json
{
  "searchableAttributes": [
    "name",
    "description", 
    "brand"
  ],
  "filterableAttributes": [
    "category_id",
    "brand",
    "price",
    "is_active"
  ],
  "sortableAttributes": [
    "price",
    "updated_at",
    "created_at"
  ],
  "typoTolerance": {
    "enabled": true,
    "minWordSizeForTypos": {
      "oneTypo": 4,
      "twoTypos": 8
    }
  },
  "rankingRules": [
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness"
  ],
  "distinctAttribute": "id",
  "faceting": {
    "maxValuesPerFacet": 100
  },
  "searchCutoffMs": 50
}
```

### Key Vietnamese-Specific Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `typoTolerance.enabled` | `true` | Enables typo tolerance for Vietnamese diacritics (e.g., "dien thoai" → "điện thoại") |
| `typoTolerance.minWordSizeForTypos.oneTypo` | `4` | Minimum word length for 1 typo (optimized for shorter Vietnamese words) |
| `typoTolerance.minWordSizeForTypos.twoTypos` | `8` | Minimum word length for 2 typos |
| `searchCutoffMs` | `50` | Limits search time to return partial results faster under load |

### Tokenizer Note

The native Vietnamese tokenizer (`"tokenizer": "vi"`) is **not currently enabled** in the index settings. The platform achieves excellent Vietnamese search results through:
- Optimized typo tolerance configuration
- Proper filterable/sortable attributes
- Redis cache warming for popular queries
- Meilisearch's default tokenizer with ICU segmentation

Future enhancement: Upgrade to Meilisearch v1.11+ and enable `"tokenizer": "vi"` for native compound word recognition.

---

## How Vietnamese Search Works (Current Implementation)

### Typo Tolerance for Vietnamese

Meilisearch's typo tolerance handles Vietnamese diacritics effectively:

| Query | Matches |
|-------|---------|
| `dien thoai` | "điện thoại", "điện thoại iPhone" |
| `ao thun` | "áo thun nam", "áo thun nữ" |
| `may tinh` | "máy tính bảng", "máy tính xách tay" |
| `giay the thao` | "giày thể thao" |

### Search Attributes & Weights

- **name** (highest weight) - Product names in Vietnamese
- **description** - Product descriptions  
- **brand** - Brand names (mixed Vietnamese/English)

### Filterable Attributes (Faceted Search)

- `category_id` - Filter by category UUID
- `brand` - Filter by brand name
- `price` - Numeric range filtering
- `is_active` - Boolean filter for active products

---

## Implementation in Code

### Service Initialization

The index is automatically initialized on application startup:

```python
# backend/app/services/search_service.py
class SearchService:
    async def ensure_index_initialized(self) -> bool:
        """Initialize index with Vietnamese support."""
        try:
            exists = await self.meilisearch.index_exists()
            if not exists:
                await self.meilisearch.create_index(
                    index_name=self.meilisearch.index_name,
                    settings={"primary_key": "id"}
                )
            await self.meilisearch.update_settings(
                index_name=self.meilisearch.index_name,
                settings={
                    "tokenizer": "vi",  # Vietnamese tokenizer
                    "typoTolerance": {
                        "enabled": True,
                        "minWordSizeForTypos": {
                            "oneTypo": 4,
                            "twoTypos": 8
                        }
                    },
                    # ... other settings
                }
            )
            return True
        except Exception as e:
            logger.warning(f"Could not initialize Meilisearch index: {e}")
            return False
```

### Document Structure

Products are indexed with the following fields:

```python
def _format_product_doc(self, product: Any) -> Dict[str, Any]:
    """Format product for Meilisearch with Vietnamese text support."""
    return {
        "id": str(product.id),
        "name": product.name,                    # Vietnamese product name
        "description": product.description or "", # Vietnamese description
        "price": float(product.price or 0.0),
        "brand": product.brand or "",             # Brand name (may be English/Vietnamese)
        "category_id": str(product.category_id) if product.category_id else "",
        "search_vector": str(product.search_vector or ""),  # PostgreSQL FTS vector
        "embedding": product.embedding or [],     # AI embeddings (1536-dim)
        "updated_at": product.updated_at.isoformat() if product.updated_at else "",
    }
```

---

## Kubernetes Deployment

### Helm Values Configuration

```yaml
# helm/ecommerce/values.yaml
meilisearch:
  enabled: true
  image:
    repository: getmeili/meilisearch
    tag: v1.11  # v1.11+ required for Vietnamese tokenizer
    pullPolicy: IfNotPresent
  replicaCount: 1
  resources:
    limits:
      cpu: '1'
      memory: 1Gi
    requests:
      cpu: 200m
      memory: 256Mi
  securityContext:
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
  service:
    port: 7700
    type: ClusterIP
  persistence:
    storageClass: standard
    size: 5Gi
  environment: production
```

### Meilisearch Master Key

Set the master key via Kubernetes secret:

```bash
kubectl create secret generic app-secrets \
  --from-literal=MEILISEARCH_MASTER_KEY=your-secure-master-key \
  -n default
```

---

## Worker Tasks for Synchronization

The platform includes ARQ worker tasks to keep Meilisearch in sync with PostgreSQL.

### Task Types

| Task | Schedule | Purpose |
|------|----------|---------|
| `generate_embeddings_task` | Manual/On-demand | Generate AI embeddings for products without them |
| `sync_to_meilisearch_task` | Manual/On-demand | Full sync of all products with embeddings |
| `incremental_sync_task` | Every 5 min (via ARQ cron) | Sync recently updated products |
| `sync_product_task` | Event-driven (retry + DLQ) | Sync single product on create/update |
| `delete_product_task` | Event-driven (retry + DLQ) | Delete single product from index |

### Kubernetes CronJob Alternative

For environments without ARQ worker, a Kubernetes CronJob is available:

```yaml
# k8s/cronjobs/reconcile-search.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: reconcile-search
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM UTC
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: reconcile
            image: ecommerce-backend:latest
            command: ["python", "/app/backend/scripts/reconcile_search.py", "--fix"]
```

### ARQ Worker Cron Configuration

The ARQ worker runs `incremental_sync_task` every 5 minutes (configurable):

```python
# backend/app/worker.py
cron_jobs = [
    cron(incremental_sync_task, minute="*/5"),  # Every 5 minutes
]
```

---

## Testing Vietnamese Search

### Test Queries

```bash
# Search for Vietnamese products
curl "http://localhost:8000/api/v1/search/products?q=áo thun nam"

# Search with filters
curl "http://localhost:8000/api/v1/search/products?q=điện thoại&filters[brand]=Apple"

# Search with typo tolerance
curl "http://localhost:8000/api/v1/search/products?q=dien thoai"  # Missing diacritics
curl "http://localhost:8000/api/v1/search/products?q=ao thun"     # Missing diacritics
```

### Expected Behavior

| Query | Current Implementation (Typo Tolerance) |
|-------|----------------------------------------|
| `áo thun` | Matches "áo thun nam", "áo thun nữ" (exact + typo) |
| `dien thoai` | Matches "điện thoại" (typo tolerance) |
| `may tinh` | Matches "máy tính bảng", "máy tính xách tay" (typo tolerance) |

> **Note**: Results are achieved through Meilisearch's typo tolerance with optimized `minWordSizeForTypos` settings, not the native Vietnamese tokenizer.

---

## Monitoring & Debugging

### Check Index Stats

```bash
# Via API
curl -H "Authorization: Bearer your-master-key" \
  http://localhost:7700/indexes/products/stats

# Expected output:
{
  "numberOfDocuments": 150,
  "isIndexing": false,
  "fieldDistribution": {
    "name": 150,
    "description": 150,
    "brand": 145,
    "category_id": 150,
    "price": 150,
    "embedding": 150
  }
}
```

### Check Tokenizer Setting

```bash
curl -H "Authorization: Bearer your-master-key" \
  http://localhost:7700/indexes/products/settings

# Verify:
# "tokenizer": "vi"
```

### Search Debug

```bash
# Test search with debug info
curl -H "Authorization: Bearer your-master-key" \
  "http://localhost:7700/indexes/products/search" \
  -d '{"q": "áo thun", "attributesToHighlight": ["name", "description"]}'
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Search returns no results for Vietnamese queries | Typo tolerance not configured | Verify `typoTolerance.enabled: true` and `minWordSizeForTypos` in index settings |
| Diacritics not matching | Typo tolerance not optimized | Ensure `minWordSizeForTypos.oneTypo: 4` for Vietnamese words |
| Slow search under load | No searchCutoffMs configured | Add `searchCutoffMs: 50` to index settings |
| Slow indexing | Large documents / many products | Use batch sync (100 docs/batch) |
| Sync fails | Meilisearch unavailable | Check service health, network policies |
| Cache miss on popular queries | Cache not warmed | Call `POST /api/v1/products/search/warm-cache` |

### Verify Meilisearch Version

```bash
curl http://localhost:7700/health
# Should return version >= 1.11.0
```

### Check Index Settings

```bash
curl -H "Authorization: Bearer your-master-key" \
  http://localhost:7700/indexes/products/settings

# Verify key settings:
# "typoTolerance": {"enabled": true, "minWordSizeForTypos": {"oneTypo": 4, "twoTypos": 8}}
# "searchCutoffMs": 50
```

### Re-index All Products

```bash
# Option 1: Trigger full sync via worker
curl -X POST http://localhost:8000/api/v1/reports/export \
  -H "Authorization: Bearer admin_token" \
  -d '{"task": "sync_to_meilisearch"}'

# Option 2: Run reconciliation script
kubectl exec -it deployment/backend -- python scripts/reconcile_search.py --fix
```

---

## Performance Optimization Report

The platform has achieved **p95 latency of 100ms** with **0% failure rate** under load testing (100 concurrent users, 300s duration). See the detailed [Performance Optimization Report](../PERFORMANCE_OPTIMIZATION_REPORT.md) for full details.

### Key Optimizations Implemented

1. **Redis Connection Pooling** - Global pool with max 50 connections, timeouts, retry logic
2. **Meilisearch searchCutoffMs: 50** - Limits search time for faster partial results
3. **Cache Warming Endpoint** - Pre-populates Redis with 150 popular Vietnamese query combinations
4. **Fixed Test Data** - Replaced hardcoded IDs with real UUIDs from seeded data
5. **Meilisearch v1.8 Compatibility** - Updated client API usage for v0.43+ Python client

### Load Test Results (Aggregated)

| Metric | Result |
|--------|--------|
| **p95 Latency** | **100ms** ✅ |
| **Failure Rate** | **0%** ✅ |
| **Avg Response Time** | 37ms |
| **Throughput** | 29 req/s |
| **Total Requests** | 8,692 |

### Test Query Performance Breakdown

| Query Type | p50 | p95 | p99 |
|------------|-----|-----|-----|
| Basic Search | 20ms | 88ms | 230ms |
| With Filters | 27ms | 100ms | 220ms |
| With Facets | 24ms | 97ms | 280ms |
| Price Range | 24ms | 96ms | 250ms |
| Sorting | 25ms | 92ms | 160ms |

---

## Performance Considerations

---

## Advanced Configuration

### Custom Synonyms (Vietnamese)

```json
{
  "synonyms": {
    "điện thoại": ["phone", "smartphone", "mobile"],
    "laptop": ["máy tính xách tay", "notebook"],
    "giày": ["giày dép", "footwear", "shoes"],
    "áo": ["quần áo", "clothing", "apparel"],
    "túi": ["ba lô", "backpack", "bag"]
  }
}
```

Apply via:
```bash
curl -X PATCH http://localhost:7700/indexes/products/settings \
  -H "Authorization: Bearer master-key" \
  -H "Content-Type: application/json" \
  -d '{"synonyms": {"điện thoại": ["phone", "smartphone"]}}'
```

### Custom Stop Words (Vietnamese)

```json
{
  "stopWords": [
    "của", "và", "có", "là", "được", "cho", "với", "tại", "trong", "ngoài",
    "trên", "dưới", "sau", "trước", "giữa", "bên", "cạnh", "gần", "xa"
  ]
}
```

---

## Migration from PostgreSQL FTS Only

If migrating from PostgreSQL FTS-only search:

1. **Enable Meilisearch** in `values.yaml`: `meilisearch.enabled: true`
2. **Deploy Meilisearch** via Helm
3. **Run initial sync**: `sync_to_meilisearch_task`
4. **Update frontend** to use Meilisearch endpoint
5. **Monitor** search quality and adjust weights if needed
6. **Optional**: Keep PostgreSQL FTS as fallback

---

## References

- [Meilisearch Vietnamese Tokenizer Docs](https://www.meilisearch.com/docs/learn/engine/tokenizer#vietnamese-tokenizer)
- [Meilisearch v1.11 Release Notes](https://github.com/meilisearch/meilisearch/releases/tag/v1.11.0)
- [ICU Vietnamese Segmentation](https://unicode-org.github.io/icu/userguide/segmentation/)
- [NAPAS 247 / VietQR Integration](../payment-setup.md)

---

*Last updated: 2024-01-15*