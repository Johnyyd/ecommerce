#!/usr/bin/env python3
"""
Test script to verify Meilisearch service connection and basic functionality.
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.services.search_service import MeilisearchService, SearchService
from app.core.config import settings


async def test_meilisearch_connection():
    """Test basic connection to Meilisearch."""
    print("Testing Meilisearch connection...")

    try:
        # Test MeilisearchService
        meilisearch = MeilisearchService()

        # Test index existence check
        index_exists = await meilisearch.index_exists()
        print(f"Index 'products' exists: {index_exists}")

        # Test getting stats
        stats = await meilisearch.get_stats()
        print(f"Index stats: {stats}")

        await meilisearch.close()
        print("✓ MeilisearchService connection test passed")
        return True

    except Exception as e:
        print(f"✗ MeilisearchService connection test failed: {e}")
        return False


async def test_search_service():
    """Test high-level search service."""
    print("\nTesting SearchService...")

    try:
        search_service = SearchService()

        # Test getting popular products (should work even with empty index)
        popular = await search_service.get_popular_products(limit=5)
        print(f"Popular products result: {popular}")

        await search_service.close()
        print("✓ SearchService test passed")
        return True

    except Exception as e:
        print(f"✗ SearchService test failed: {e}")
        return False


async def main():
    """Run all tests."""
    print("=== Meilisearch Service Tests ===\n")

    # Show configuration
    print(f"Meilisearch URL: {settings.MEILISEARCH_URL}")
    print(f"Meilisearch Master Key: {'*' * len(settings.MEILISEARCH_MASTER_KEY) if settings.MEILISEARCH_MASTER_KEY else 'Not set'}")
    print()

    # Run tests
    test1_passed = await test_meilisearch_connection()
    test2_passed = await test_search_service()

    print("\n=== Test Results ===")
    if test1_passed and test2_passed:
        print("✓ All tests passed!")
        return 0
    else:
        print("✗ Some tests failed!")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)