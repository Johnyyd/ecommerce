# Plan: Trụ cột 4: Tìm kiếm Nâng cao & Cá nhân hóa (Search & AI Recommendation)

**Source PRD**: /home/tringuyen/Documents/GitHub/ecommerce/ROADMAP.md
**Selected Milestone**: Trụ cột 4: Tìm kiếm Nâng cao & Cá nhân hóa (Search & AI Recommendation)
**Complexity**: Large

## Summary
Implement advanced search capabilities using Meilisearch for fast, typo-tolerant Vietnamese search with faceted filtering, and AI-powered product recommendations using pgvector for semantic similarity and collaborative filtering. This plan covers backend infrastructure, API endpoints, frontend integration, data synchronization pipelines, and deployment configurations.

**Embedding Strategy**: Use the local **Free LLM API** (OpenAI-compatible) at `http://localhost:3001/v1` with API key `freellmapi-fa22e5cba463c21104c1c19f6ec9ddda0fbb0e6acb175651` for generating product embeddings. This avoids running heavy NLP models in-process while keeping all inference local and free.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Naming | `backend/app/models/product.py:1` | Snake_case for database models, PascalCase for classes |
| Errors | `backend/app/api/v1/endpoints/products.py:84-86` | HTTPException with status codes and detail messages |
| Data Access | `backend/app/crud/product.py:23-47` | Repository pattern with async SQLAlchemy 2.0 queries |
| Services | `backend/app/services/product.py` (implied) | Service layer encapsulating business logic |
| Worker Tasks | `backend/app/worker.py:10-15` | ARQ task pattern with ctx parameter and logging |
| Configuration | `backend/app/core/config.py:5-55` | Pydantic BaseSettings with environment variable support |
| API Responses | `backend/app/api/v1/endpoints/products.py:66-68` | JSON serialization using Pydantic model_dump(mode='json') |
| Caching | `backend/app/api/v1/endpoints/products.py:51-55` | Redis caching with cache key construction and setex |
| Database Migrations | Alembic structure (implied) | SQLAlchemy Alembic for schema migrations |
| Frontend State | `frontend/src/store/useProductStore.ts:37-80` | Zustand store with async actions and immutable updates |

## Files to Change
| `backend/app/core/config.py` | UPDATE | Add Meilisearch and pgvector configuration settings; embedding API endpoint/key (Free LLM API local) |
|---|---|---|
| `backend/app/models/product.py` | UPDATE | Add tsvector column for PostgreSQL FTS and vector embedding column |
| `backend/app/models/failed_sync_task.py` | CREATE | New model for Dead Letter Queue (failed sync tasks) |
| `backend/app/models/backfill_job.py` | CREATE | New model for backfill progress tracking |
| `backend/app/crud/product.py` | UPDATE | Enhance search queries to support Meilisearch and PostgreSQL FTS |
| `backend/app/api/v1/endpoints/products.py` | UPDATE | Add new search parameters and recommendation endpoints |
| `backend/app/services/product.py` | CREATE | Implement search service layer with Meilisearch/pgvector integration |
| `backend/app/services/search_service.py` | CREATE | New service for Meilisearch operations and vector search |
| `backend/app/services/recommendation_service.py` | CREATE | New service for AI-powered product recommendations with cold-start handling |
| `backend/app/worker.py` | UPDATE | Add background tasks for embedding generation and sync (with retries) |
| `backend/app/core/queue.py` | UPDATE | Add Meilisearch connection settings if needed |
| `alembic/versions/*_add_search_columns.py` | CREATE | Database migration for tsvector, vector columns, failed_sync_tasks, backfill_jobs tables |
| `docker-compose.yml` | UPDATE | Add Meilisearch service configuration; add resource limits on worker service |
| `backend/Dockerfile` | UPDATE | Add Meilisearch and pgvector dependencies; add OpenAI client for embedding API |
| `backend/scripts/reconcile_search.py` | CREATE | Periodic reconciliation script to sync Postgres ↔ Meilisearch |
| `backend/scripts/backfill_search.py` | CREATE | Standalone backfill script for initial data migration |
| `frontend/src/lib/api/products.ts` | CREATE/UPDATE | Add API client methods for advanced search and recommendations |
| `frontend/src/store/useProductStore.ts` | UPDATE | Enhance store to handle faceted search and recommendations |
| `frontend/src/pages/ProductsPage.tsx` | UPDATE | Implement faceted search UI and recommendation display |
| `frontend/src/components/ui/FacetFilters.tsx` | CREATE | New component for faceted search filters |
| `frontend/src/components/ProductRecommendations.tsx` | CREATE | New component for displaying AI recommendations |
| `frontend/src/types/product.ts` | UPDATE | Extend Product type with search metadata and recommendation fields |
| `requirements.txt` | UPDATE | Add meilisearch-python, pgvector, and openai (for embedding API client) dependencies |

## Tasks
### Task 1: Infrastructure Setup - Meilisearch & pgvector
- **Action**: Add Meilisearch service to docker-compose, install dependencies, configure pgvector extension
- **Mirror**: Follow existing Redis and PostgreSQL service patterns in docker-compose.yml
- **Validate**: 
  - `docker compose up -d meilisearch` starts successfully
  - `CREATE EXTENSION IF NOT EXISTS vector;` executes without error in PostgreSQL
  - Health check endpoints return 200 for both services

### Task 2: Database Schema Enhancement
- **Action**: Add tsvector column for PostgreSQL Full-Text Search and vector column for embeddings to products table
- **Mirror**: Follow existing SQLAlchemy column patterns in backend/app/models/product.py
- **Validate**:
  - Migration script runs successfully
  - Products table contains new tsvector and vector columns
  - Indexes are created for tsvector (GIN) and vector (IVFFlat) columns

### Task 3: Meilisearch Service Implementation
- **Action**: Create search_service.py with Meilisearch client initialization, index management, and search operations
- **Mirror**: Follow existing service patterns like backend/app/services/email.py
- **Validate**:
  - Service can connect to Meilisearch instance
  - Index creation and configuration works correctly
  - Basic search, filter, and facet operations return expected results

### Task 4: Embedding Generation & Synchronization
- **Action**: Implement background worker tasks for generating product embeddings and syncing with Meilisearch
- **Mirror**: Follow existing ARQ task patterns in backend/app/worker.py
- **Design Decision**: Use the **local Free LLM API** (OpenAI-compatible) running at `http://localhost:3001/v1` with API key `freellmapi-fa22e5cba463c21104c1c19f6ec9ddda0fbb0e6acb175651` for generating embeddings. This avoids:
  - Running heavy sentence-transformers models locally (CPU starvation)
  - External API costs and latency
  - Additional container orchestration complexity
- **Configuration**: Add `EMBEDDING_API_URL` and `EMBEDDING_API_KEY` to `backend/app/core/config.py` (sourced from environment variables)
- **Embedding Model**: Use the API's default embedding model (typically `text-embedding-3-small` equivalent, 1536 dimensions) — verify dimension matches pgvector column definition
- **Batch Processing**: Process embeddings in batches of 50 products per task with a short sleep between batches to avoid overwhelming the local embedding service
- **Validate**:
  - Worker tasks can generate embeddings via the local API without exceeding CPU/memory limits
  - Embeddings are stored in PostgreSQL vector column (1536 dimensions)
  - Product data is synchronized to Meilisearch index
  - Incremental sync works for product updates/creates/deletes
  - Worker resource usage stays within configured limits (verify via `docker stats`)

### Task 4a: Dead Letter Queue & Reconciliation (Source-of-Truth Resilience)
- **Problem**: Three data stores (PostgreSQL, Meilisearch, Redis) are kept in sync by background workers. If a worker crashes mid-sync, data becomes inconsistent. This task adds resilience against silent divergence.
- **Action**:
  - Configure ARQ's built-in retry with `max_retries` and `job_timeout`; failed tasks are pushed to a Dead Letter Queue (DLQ) table `failed_sync_tasks` for manual or automated re-run.
  - Create a **Reconciliation Script** (`backend/scripts/reconcile_search.py`) that runs on a schedule (e.g., every 6 hours) and compares `updated_at` between PostgreSQL and Meilisearch. Any product missing or stale in Meilisearch is re-synced.
  - All sync tasks must be **idempotent**: they check the product's `version` or `updated_at` before writing, so re-running a failed task does not corrupt data.
- **Mirror**: Follow existing ARQ worker patterns in `backend/app/worker.py` and existing script patterns in `backend/seed_db.py`.
- **Validate**:
  - A failed sync task appears in `failed_sync_tasks` table with error details
  - Reconciliation script detects and fixes at least 3 injected inconsistencies
  - Re-running an already-synced task does not create duplicate Meilisearch documents

### Task 4b: Initial Backfill (Cold-Start Data Migration)
- **Problem**: Task 2 and 4 only handle new/updated products. On first deploy, thousands of existing products have no embeddings and no Meilisearch index entries. A naive backfill would block the database or exhaust worker resources.
- **Action**:
  - Create a **Backfill Task** (`backend/scripts/backfill_search.py`) that scans the entire `products` table in batches of 100, generates embeddings, and pushes to Meilisearch.
  - Run as a standalone CLI command (not in the request path) so it can be triggered manually after deploy.
  - **Rate limiting**: sleep 100ms between batches; pause if CPU load exceeds threshold.
  - **Progress tracking**: persist progress to a `backfill_jobs` table (or Redis key) so the script can be paused/resumed without losing state.
  - **Fallback**: if the embedding API is unavailable, backfill can still populate Meilisearch with plain text (search still works; semantic similarity is deferred).
- **Mirror**: Follow existing batch script patterns in `backend/seed_db.py` and `backend/create_admin.py`.
- **Validate**:
  - After running backfill, `SELECT count(*) FROM products WHERE embedding IS NOT NULL` equals total product count
  - Meilisearch index document count matches PostgreSQL product count
  - Backfill can be interrupted and resumed without data corruption

### Task 5: Advanced Search API Endpoints
- **Action**: Enhance product search API to support Meilisearch with faceted search, typo tolerance, and Vietnamese language support
- **Mirror**: Follow existing API patterns in backend/app/api/v1/endpoints/products.py
- **Validate**:
  - Search endpoint accepts new parameters (filters, facets, etc.)
  - Meilisearch returns results with sub-50ms response time
  - Faceted search returns correct aggregation counts
  - Typo tolerance works for Vietnamese text (e.g., "ao thun" finds "áo thun")
  - Language-specific settings handle Vietnamese diacritics correctly

### Task 6: AI Recommendation Engine
- **Action**: Implement semantic similarity search using pgvector and collaborative filtering algorithms
- **Mirror**: Follow existing service patterns for business logic encapsulation
- **Cold Start Mitigation**: Collaborative filtering requires sufficient interaction history. This task explicitly handles the cold-start scenario:
  - **Content-based fallback**: When collaborative filtering data is insufficient (fewer than 100 user interactions in the system), fall back to content-based filtering using pgvector semantic similarity on product embeddings.
  - **Hybrid scoring**: Combine semantic similarity score with collaborative filtering score using a weighted formula. Weight shifts toward collaborative filtering as more interaction data accumulates.
  - **Graceful empty state**: If both algorithms return no results, return a curated "Popular Products" or "New Arrivals" list instead of an empty response. Never return an empty recommendation section to the user.
  - **Popularity baseline**: Maintain a Redis-sorted set (`products:popularity`) updated on order events, used as a universal fallback.
- **Validate**:
  - Semantic similarity finds products with similar meanings
  - Collaborative filtering suggests products frequently bought together
  - With zero interaction data, recommendations fall back to content-based similarity and popularity (no empty response)
  - With sufficient interaction data, collaborative filtering results are prioritized
  - Recommendation endpoints return relevant products
  - Fallback mechanisms work when insufficient data exists

### Task 7: Frontend Integration - Search Enhancement
- **Action**: Update ProductsPage and ProductStore to utilize faceted search and display filters
- **Mirror**: Follow existing Zustand store and API client patterns in frontend/src/
- **Validate**:
  - Search interface shows faceted filters (price, category, brand, etc.)
  - Filter selections update search results in real-time
  - Mobile-responsive design works correctly
  - Loading states and error handling are implemented

### Task 8: Frontend Integration - Recommendations Display
- **Action**: Add recommendation sections to ProductDetail page and potentially cart/checkout pages
- **Mirror**: Follow existing component patterns in frontend/src/components/
- **Validate**:
  - "Sản phẩm tương tự" section shows semantically similar products
  - "Khách hàng thường mua cùng" section shows relevant complementary products
  - Recommendations update based on current product/context
  - Components handle loading and empty states gracefully

### Task 9: Performance Optimization & Caching
- **Action**: Implement caching strategies for search results and recommendations
- **Mirror**: Follow existing Redis caching patterns in product API endpoints
- **Validate**:
  - Frequently accessed search results are cached appropriately
  - Cache invalidation works when product data changes
  - Recommendation caching prevents excessive database load
  - Cache TTL values are configured for different data types

### Task 10: Testing, Deployment & Documentation
- **Action**: Write integration tests, update deployment procedures, and document API usage
- **Mirror**: Follow existing testing patterns in backend/ and frontend/ test files
- **Validate**:
  - Unit and integration tests pass for new search and recommendation features
  - End-to-end tests verify search and recommendation workflows
  - Deployment scripts include Meilisearch and pgvector setup
  - API documentation is updated with new endpoints and parameters

## Validation
```bash
# Backend validation
cd backend
python -m pytest tests/test_search_service.py -v
python -m pytest tests/test_recommendation_service.py -v
python -m pytest tests/test_product_search.py -v
python -m pytest tests/test_reconciliation.py -v
python -m pytest tests/test_backfill.py -v

# Frontend validation
cd ../frontend
npm test -- --testPathPattern=search
npm test -- --testPathPattern=recommendation

# Docker validation
docker compose up -d meilisearch postgres redis
docker compose logs meilisearch | grep "HTTP API listening"
docker compose exec postgres psql -U ecommerce_user -d ecommerce_db -c "SELECT * FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');"

# Worker resource limits validation
docker compose up -d worker
docker stats worker --no-stream | grep -E "CPU|MEM"

# Embedding API validation (Free LLM API)
curl -s -H "Authorization: Bearer freellmapi-fa22e5cba463c21104c1c19f6ec9ddda0fbb0e6acb175651" \
  http://localhost:3001/v1/embeddings \
  -d '{"input": "test product", "model": "text-embedding-3-small"}' | jq '.data[0].embedding | length'

# End-to-end validation
curl -s "http://localhost:8000/api/v1/products/search?q=ao+thun&facets=[\"category\",\"brand\",\"price_range\"]" | jq '.facets'
curl -s "http://localhost:8000/api/v1/products/123e4567-e89b-12d3-a456-426614174000/recommendations" | jq 'length > 0'

# Reconciliation validation (inject inconsistency and verify fix)
python backend/scripts/reconcile_search.py --dry-run
python backend/scripts/reconcile_search.py --fix

# Backfill validation
python backend/scripts/backfill_search.py --dry-run
# Full backfill would be run manually on deploy
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Meilisearch resource consumption (memory/CPU) | Medium | Configure proper resource limits in docker-compose, monitor usage, implement indexing strategies |
| Embedding generation performance impact (CPU starvation) | **Medium** | Use **local Free LLM API** (`http://localhost:3001/v1`) instead of running heavy models in-process. The API handles model inference separately; ARQ worker only makes HTTP calls. Set Docker resource limits on worker service as additional guardrail. |
| **Silent data divergence between Postgres/Meilisearch/Redis** | **High** | Implement Dead Letter Queue for failed sync tasks, idempotent sync with `updated_at`/`version` checks, and a periodic Reconciliation Script to detect and repair inconsistencies. |
| **Backfill blocking database or worker during initial deploy** | **High** | Run backfill as a standalone CLI script (not in request path), process in batches of 100 with sleeps, persist progress for pause/resume, and skip embedding generation if API is unavailable. |
| Collaborative filtering cold-start (empty results) | Medium | Implement content-based fallback (pgvector semantic similarity), popularity baseline (Redis sorted set), and hybrid scoring that shifts toward collaborative filtering as interaction data grows. Never return an empty recommendation section. |
| Vietnamese language processing accuracy | Low | Test extensively with Vietnamese diacritics, use Meilisearch's built-in Vietnamese support |
| Cache invalidation complexity | Medium | Implement comprehensive cache key strategy, use Redis patterns, test invalidation scenarios |
| Search relevance tuning | Medium | Implement A/B testing framework, collect user feedback, tune ranking rules periodically |
| Database migration downtime | Low | Use online schema migrations where possible, test migrations on staging first |
| Frontend bundle size increase | Low | Code-split new components, lazy-load recommendation modules, monitor bundle analytics |