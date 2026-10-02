#!/usr/bin/env python3
"""
Test script to verify that POSTGRES_PASSWORD is now required and has no default value.
"""
import sys
import os
sys.path.insert(0, '/home/tringuyen/Documents/GitHub/ecommerce/backend')

try:
    from app.core.config import Settings
    # This should raise an error because POSTGRES_PASSWORD is not set
    settings = Settings()
    print("ERROR: Settings loaded successfully when POSTGRES_PASSWORD should be required")
    sys.exit(1)
except Exception as e:
    if "POSTGRES_PASSWORD" in str(e) or "validation" in str(e).lower():
        print("SUCCESS: Settings correctly failed to load due to missing POSTGRES_PASSWORD")
        print(f"Error message: {e}")
        sys.exit(0)
    else:
        print(f"UNEXPECTED ERROR: {e}")
        sys.exit(1)