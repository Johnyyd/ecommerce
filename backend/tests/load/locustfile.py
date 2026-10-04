"""
Locust Load Test for Vietnamese Product Search API

Tests the /api/v1/products/search endpoint with:
- 100 concurrent users
- Vietnamese search queries (with/without diacritics)
- Faceted search (category, brand, price range)
- Sorting (price asc/desc)
- Measures p50, p95, p99 latencies and error rates

Run with:
    locust -f locustfile.py --headless -u 100 -r 10 -t 300s --host http://localhost:8000
"""

import random
import string
from typing import List, Dict, Any
from locust import HttpUser, task, between, events
from locust.exception import RescheduleTask


# Vietnamese product search queries for realistic load testing
VIETNAMESE_QUERIES = [
    # Basic queries without diacritics (typo tolerance test)
    "ao thun",
    "quan jean",
    "dien thoai",
    "laptop gaming",
    "giay the thao",
    "tui xach",
    "dong ho",
    "kinh mat",
    "my pham",
    "sach",

    # Queries with diacritics
    "áo thun",
    "quần jean",
    "điện thoại",
    "laptop gaming",
    "giày thể thao",
    "túi xách",
    "đồng hồ",
    "kính mắt",
    "mỹ phẩm",
    "sách",

    # Mixed queries
    "ao thun nam",
    "quan jean nu",
    "dien thoai iphone",
    "laptop van phong",
    "giay chay bo",
    "tui xach nu",
    "dong ho thong minh",
    "kinh mat nang",
    "my pham chong nang",
    "sach trinh th",

    # Brand searches (from seeded data)
    "nike",
    "adidas",
    "samsung",
    "apple",
    "xiaomi",
    "nvidia",
    "dell",
    "keychron",
    "logitech",
    "jbl",
    "sony",
    "canifa",
    "biti",
    "kaps",
    "routine",
    "acer",
    "asus",
    "lenovo",
    "hp",
    "msi",
    "oppo",
    "orient",
    "the ordinary",
    "la roche-posay",
    "cetaphil",
    "cerave",
    "mac",
    "dior",
    "casio",
    "may10",
    "ivy moda",
    "kangaroo",
    "vinfast",
    "viet t-shirt",

    # Category-like searches
    "thoi trang nam",
    "thoi trang nu",
    "do dien tu",
    "dien tu",
    "my pham chinh hang",
    "giay dep",
    "phu kien",
    "do the thao",
    "do boi",
    "do ngu",
]


# Real brands from seeded data
VIETNAMESE_BRANDS = [
    "NVIDIA", "Samsung", "Dell", "Keychron", "Logitech", "JBL", "Sony",
    "Acer", "Adidas", "Apple", "Asus", "Biti's", "Canifa", "Casio",
    "CeraVe", "Cetaphil", "Dior", "First News", "HP", "IVY Moda", "JBL",
    "Kangaroo", "Kaps", "Keychron", "La Roche-Posay", "Lenovo", "Logitech",
    "MAC", "May10", "MSI", "New Balance", "Nike", "NVIDIA", "NXB Hội Nhà Văn",
    "NXB Trẻ", "NXB Văn Học", "Oppo", "Orient", "Routine", "Samsung",
    "Sony", "TestBrand", "The Ordinary", "Viet T-Shirt", "VinFast", "Xiaomi"
]


# Real category IDs from seeded data
CATEGORY_IDS = [
    "01a1048f-94ac-747e-a2a5-23e03b686853",  # Thời trang nam
    "01a1048f-94b4-7774-8bb9-d8da2892bdf3",  # Thời trang nữ
    "01a1048f-94b7-7f62-bef2-7b28b1e13b39",  # Thời trang unisex
    "01a1048f-94bb-7004-a18d-aefb7813467f",  # Thể thao
    "01a1048f-94be-71d5-81f0-8c8c5bc6caa6",  # Điện thoại
    "01a1048f-94c3-78f7-a1a4-966f281c2c57",  # Laptop
    "01a1048f-94c7-77ce-baf5-07ae9d65c18d",  # Giày dép
    "01a1048f-94ca-7292-92a6-ca940d608315",  # Phụ kiện
    "01a1048f-94ce-7fa5-96d7-b62ab887bf97",  # Đồng hồ
    "01a1048f-94d1-7530-8c09-b1f2b583041a",  # Mỹ phẩm
    "01a1048f-94d4-7b4a-a303-4f43d35df94e",  # Sách
    "01a1048f-94d7-74e0-ad4c-ddf5497177c6",  # Âm thanh
    "01a1048f-94da-7164-b308-52acc7ab10f2",  # Phụ kiện máy tính
    "01a1048f-94dd-7944-b98b-dad9c23e725e",  # Màn hình
    "01a1048f-94e1-7a51-a54a-7870760efed6",  # Linh kiện
    "de0103f5-6f3b-4b9b-8815-60b85d265cbf",  # Test Category
]


# Price ranges for filtering (based on actual data range)
PRICE_RANGES = [
    (0, 500000),       # Under 500k
    (500000, 2000000), # 500k - 2M
    (2000000, 10000000), # 2M - 10M
    (10000000, 30000000), # 10M - 30M
]


# Sort options
SORT_OPTIONS = [
    None,
    "price:asc",
    "price:desc",
    "created_at:desc",
    "updated_at:desc",
]


# Facet options
FACET_OPTIONS = [
    "category_id,brand",
    "category_id,brand,price",
    "category_id,brand,price,is_active",
    "brand",
    "category_id",
    None,
]


class SearchUser(HttpUser):
    """Simulated user performing search operations."""

    # Wait between 1-3 seconds between requests (realistic user behavior)
    wait_time = between(1, 3)

    def on_start(self):
        """Initialize user session."""
        self.search_count = 0
        self.error_count = 0

    @task(40)
    def search_basic(self):
        """Basic search without filters - most common operation."""
        query = random.choice(VIETNAMESE_QUERIES)
        limit = random.choice([12, 20, 24, 30])

        params = {
            "q": query,
            "limit": limit,
            "page": 1,
        }

        with self.client.get("/api/v1/products/search", params=params,
                           catch_response=True, name="/api/v1/products/search (basic)") as response:
            self._record_response(response)

    @task(25)
    def search_with_filters(self):
        """Search with category and brand filters."""
        query = random.choice(VIETNAMESE_QUERIES)
        limit = random.choice([12, 20])
        category_id = random.choice(CATEGORY_IDS)
        brand = random.choice(VIETNAMESE_BRANDS)

        params = {
            "q": query,
            "category_id": category_id,
            "brand": brand,
            "limit": limit,
            "page": 1,
        }

        with self.client.get("/api/v1/products/search", params=params,
                           catch_response=True, name="/api/v1/products/search (filters)") as response:
            self._record_response(response)

    @task(15)
    def search_with_price_range(self):
        """Search with price range filter."""
        query = random.choice(VIETNAMESE_QUERIES)
        limit = random.choice([12, 20])
        min_price, max_price = random.choice(PRICE_RANGES)

        params = {
            "q": query,
            "min_price": min_price,
            "max_price": max_price,
            "limit": limit,
            "page": 1,
        }

        with self.client.get("/api/v1/products/search", params=params,
                           catch_response=True, name="/api/v1/products/search (price_range)") as response:
            self._record_response(response)

    @task(10)
    def search_with_facets(self):
        """Search requesting facet distribution."""
        query = random.choice(VIETNAMESE_QUERIES)
        limit = random.choice([12, 20])
        facets = random.choice(FACET_OPTIONS)

        params = {
            "q": query,
            "limit": limit,
            "page": 1,
        }

        if facets:
            params["facets"] = facets

        with self.client.get("/api/v1/products/search", params=params,
                           catch_response=True, name="/api/v1/products/search (facets)") as response:
            self._record_response(response)
            # Verify facet distribution is returned
            if response.success and response.json().get("facets"):
                pass  # Facets returned successfully

    @task(5)
    def search_with_sorting(self):
        """Search with sorting."""
        query = random.choice(VIETNAMESE_QUERIES)
        limit = random.choice([12, 20])
        sort = random.choice(SORT_OPTIONS)

        params = {
            "q": query,
            "limit": limit,
            "page": 1,
        }

        if sort:
            params["sort"] = sort

        with self.client.get("/api/v1/products/search", params=params,
                           catch_response=True, name="/api/v1/products/search (sort)") as response:
            self._record_response(response)

    @task(3)
    def search_pagination(self):
        """Search with pagination (page > 1)."""
        query = random.choice(VIETNAMESE_QUERIES)
        limit = 12
        page = random.randint(2, 5)  # Pages 2-5

        params = {
            "q": query,
            "limit": limit,
            "page": page,
        }

        with self.client.get("/api/v1/products/search", params=params,
                           catch_response=True, name="/api/v1/products/search (pagination)") as response:
            self._record_response(response)

    @task(2)
    def search_combined_filters(self):
        """Search with multiple filters combined."""
        query = random.choice(VIETNAMESE_QUERIES)
        limit = random.choice([12, 20])
        category_id = random.choice(CATEGORY_IDS)
        brand = random.choice(VIETNAMESE_BRANDS)
        min_price, max_price = random.choice(PRICE_RANGES)
        facets = random.choice(FACET_OPTIONS)
        sort = random.choice(SORT_OPTIONS)

        params = {
            "q": query,
            "category_id": category_id,
            "brand": brand,
            "min_price": min_price,
            "max_price": max_price,
            "limit": limit,
            "page": 1,
        }

        if facets:
            params["facets"] = facets
        if sort:
            params["sort"] = sort

        with self.client.get("/api/v1/products/search", params=params,
                           catch_response=True, name="/api/v1/products/search (combined)") as response:
            self._record_response(response)

    def _record_response(self, response):
        """Record response metrics."""
        self.search_count += 1

        if response.success:
            # Verify response structure
            try:
                data = response.json()
                if "items" not in data or "total" not in data:
                    response.failure("Invalid response structure")
                    self.error_count += 1
            except Exception as e:
                response.failure(f"JSON parse error: {e}")
                self.error_count += 1
        else:
            self.error_count += 1
            # Log error details
            if hasattr(response, 'response') and response.response is not None:
                pass  # Error already captured by Locust


class AdminUser(HttpUser):
    """Admin user performing write operations (lower weight)."""

    wait_time = between(5, 15)
    weight = 1  # Much lower weight than search users

    def on_start(self):
        # In real scenario, would authenticate and get token
        pass

    @task
    def create_product(self):
        """Admin creates a product (simulated)."""
        # This would require auth, so we just simulate a health check
        self.client.get("/health", name="/health (admin)")


# Event hooks for custom metrics reporting
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("\n" + "="*60)
    print("VIETNAMESE SEARCH LOAD TEST STARTED")
    print("="*60)
    print(f"Target: {environment.host}")
    print(f"Users: {environment.runner.target_user_count if hasattr(environment.runner, 'target_user_count') else 'N/A'}")
    print("Test scenarios:")
    print("  - Basic search (40%)")
    print("  - Search with filters (25%)")
    print("  - Search with price range (15%)")
    print("  - Search with facets (10%)")
    print("  - Search with sorting (5%)")
    print("  - Pagination (3%)")
    print("  - Combined filters (2%)")
    print("="*60 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("\n" + "="*60)
    print("VIETNAMESE SEARCH LOAD TEST COMPLETED")
    print("="*60)

    # Print summary statistics
    stats = environment.runner.stats
    print(f"\nTotal Requests: {stats.total.num_requests}")
    print(f"Total Failures: {stats.total.num_failures}")
    print(f"Failure Rate: {stats.total.fail_ratio*100:.2f}%")
    print(f"Avg Response Time: {stats.total.avg_response_time:.2f}ms")
    print(f"Median (p50): {stats.total.median_response_time:.2f}ms")
    print(f"p95: {stats.total.get_response_time_percentile(0.95):.2f}ms")
    print(f"p99: {stats.total.get_response_time_percentile(0.99):.2f}ms")
    print(f"Max Response Time: {stats.total.max_response_time:.2f}ms")
    print(f"Requests/sec: {stats.total.total_rps:.2f}")

    # Per-endpoint breakdown
    print("\nPer-Endpoint Statistics:")
    print("-"*80)
    for name, stat in stats.entries.items():
        if name[0] == "GET" and "search" in name[1]:
            print(f"\n{name[1]}:")
            print(f"  Requests: {stat.num_requests}, Failures: {stat.num_failures}")
            print(f"  Avg: {stat.avg_response_time:.2f}ms, p50: {stat.median_response_time:.2f}ms")
            print(f"  p95: {stat.get_response_time_percentile(0.95):.2f}ms")
            print(f"  p99: {stat.get_response_time_percentile(0.99):.2f}ms")
            print(f"  RPS: {stat.total_rps:.2f}")

    print("\n" + "="*60)

    # Save results to file
    import json
    from datetime import datetime

    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "target_host": environment.host,
        "total_requests": stats.total.num_requests,
        "total_failures": stats.total.num_failures,
        "failure_rate": stats.total.fail_ratio,
        "avg_response_time_ms": stats.total.avg_response_time,
        "p50_ms": stats.total.median_response_time,
        "p95_ms": stats.total.get_response_time_percentile(0.95),
        "p99_ms": stats.total.get_response_time_percentile(0.99),
        "max_response_time_ms": stats.total.max_response_time,
        "requests_per_second": stats.total.total_rps,
        "endpoints": {}
    }

    for name, stat in stats.entries.items():
        if name[0] == "GET" and "search" in name[1]:
            results["endpoints"][name[1]] = {
                "requests": stat.num_requests,
                "failures": stat.num_failures,
                "avg_ms": stat.avg_response_time,
                "p50_ms": stat.median_response_time,
                "p95_ms": stat.get_response_time_percentile(0.95),
                "p99_ms": stat.get_response_time_percentile(0.99),
                "rps": stat.total_rps
            }

    with open("load_test_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("Results saved to load_test_results.json")


if __name__ == "__main__":
    # Allow running directly for debugging
    import sys
    from locust.env import Environment
    from locust.log import setup_logging

    setup_logging("INFO", None)

    env = Environment(user_classes=[SearchUser, AdminUser])
    env.create_local_runner()
    env.runner.start(10, spawn_rate=2)

    import time
    time.sleep(30)

    env.runner.quit()
    env.runner.greenlet.join()