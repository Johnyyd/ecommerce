#!/usr/bin/env bash

#=== Load Test Automation Script ===
#
# Runs the following steps in order to validate Vietnamese search performance:
#   1. Run unit tests for tokenizer config
#   2. Seed database & sync to Meilisearch
#   3. Execute Locust load test
#   4. Store results as load_test_results.json
#
# Usage:
#   ./run_load_test.sh
#
# Requirements:
#   - Docker Compose running services (backend, meilisearch, redis, postgres)
#   - Locust installed on host machine (pip install locust)
#   - Python 3.10+ with project dependencies installed
#   - Ensure env vars are set (ENVIRONMENT=test etc.)

set -eu

echo "=== Vietnamese Search Performance Validation ==="

# 1. Run pytest for tokenizer validation
if ! pytest backend/tests/load/test_vietnamese_tokenizer.py -v; then
    echo "❌ Tokenizer validation tests failed. Aborting."
    exit 1
fi

# 2. Seed data & sync to Meilisearch
#   Start services if not already running
if ! docker compose ps | grep backend; then
    echo "Services not running. Starting docker compose…"
    docker compose up -d backend meilisearch redis postgres
    echo "Waiting for services to be healthy…"
    sleep 10
fi

#   Run the seed script
python backend/tests/load/seed_data.py

# 3. Run Locust load test
echo "Running Locust load test…"
locust -f backend/tests/load/locustfile.py --headless -u 100 -r 10 -t 300s --host http://localhost:8000

# 4. Result is saved by the Locust script as load_test_results.json
if [ -f load_test_results.json ]; then
    echo "✅ Load test results saved to load_test_results.json"
else
    echo "⚠️  No results file found – check Locust logs"
fi

# 5. Summarize key metrics
if [ -f load_test_results.json ]; then
    p95=$(jq -r '.p95_ms' load_test_results.json)
    rps=$(jq -r '.requests_per_second' load_test_results.json)
    fail=$(jq -r '.failure_rate' load_test_results.json)
    echo "Performance Summary:"
    echo "  p95 latency: ${p95} ms"
    echo "  Requests/sec: ${rps}"
    echo "  Failure rate: ${fail}"%
fi

echo "=== Done ==="
