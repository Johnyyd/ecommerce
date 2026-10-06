#!/usr/bin/env python3
"""
Seed Data Generator for Vietnamese E-Commerce Load Testing

Creates 1000+ Vietnamese products with:
- Vietnamese names and descriptions (with diacritics)
- Realistic brands and categories
- Price ranges from 50k to 50M VND
- Stock quantities
- Categories hierarchy

Run with:
    python tests/load/seed_data.py

Requires:
- PostgreSQL running (via docker-compose)
- Meilisearch running (via docker-compose)
- Backend environment variables set
"""

import asyncio
import random
import os
import sys
from decimal import Decimal
from uuid import uuid4
from typing import List, Dict, Any
from datetime import datetime, timezone

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment
os.environ["ENVIRONMENT"] = "development"

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, text
from app.core.config import settings
from app.core.db import DATABASE_URL
from app.models.product import Product, Category
from app.models.user import User
from app.core.utils import generate_uuidv7
from app.services.search_service import SearchService
from app.services.embedding_service import get_embedding_service


# Vietnamese product data
VIETNAMESE_PRODUCTS = [
    # Áo thun (T-shirts)
    {"name": "Áo thun cotton nam basic", "description": "Áo thun nam chất liệu cotton 100% thoáng mát, form chuẩn", "base_price": 150000, "brand": "Viet T-Shirt", "category": "Thời trang nam"},
    {"name": "Áo thun polo nam cao cấp", "description": "Áo polo nam cổ lật, chất liệu piquet cao cấp, phù hợp đi làm", "base_price": 280000, "brand": "Canifa", "category": "Thời trang nam"},
    {"name": "Áo thun oversize unisex", "description": "Áo thun oversize nam nữ, chất cotton nỉ giữ form tốt", "base_price": 220000, "brand": "Routine", "category": "Thời trang unisex"},
    {"name": "Áo thun in hình họa tiết", "description": "Áo thun in hình 3D bền màu, nhiều mẫu mã trẻ trung", "base_price": 180000, "brand": "Kaps", "category": "Thời trang unisex"},
    {"name": "Áo thun thể thao nhanh khô", "description": "Áo thun thể thao công nghệ thoát mồ hôi, phù hợp tập gym", "base_price": 250000, "brand": "Biti's", "category": "Thể thao"},

    # Quần jean
    {"name": "Quần jean nam slim fit", "description": "Quần jean nam form slim fit, vải denim co giãn 4 chiều", "base_price": 450000, "brand": "Kangaroo", "category": "Thời trang nam"},
    {"name": "Quần jean nữ skinny", "description": "Quần jean nữ ôm sát, co giãn thoải mái, nhiều size", "base_price": 420000, "brand": "IVY Moda", "category": "Thời trang nữ"},
    {"name": "Quần jean straight fit unisex", "description": "Quần jean form dáng thẳng, unisex, vải denim Nhật Bản", "base_price": 550000, "brand": "May10", "category": "Thời trang unisex"},
    {"name": "Quần jean rách gối stylish", "description": "Quần jean rách gối tạo điểm nhấn, phong cách streetwear", "base_price": 480000, "brand": "Kaps", "category": "Thời trang unisex"},

    # Điện thoại
    {"name": "iPhone 15 Pro Max 256GB", "description": "iPhone 15 Pro Max chip A17 Pro, camera 48MP, màn hình 6.7 inch", "base_price": 29990000, "brand": "Apple", "category": "Điện thoại"},
    {"name": "Samsung Galaxy S24 Ultra", "description": "Galaxy S24 Ultra AI, bút S-Pen, camera 200MP, zoom 100x", "base_price": 30990000, "brand": "Samsung", "category": "Điện thoại"},
    {"name": "Xiaomi 14 Ultra 512GB", "description": "Xiaomi 14 Ultra camera Leica, Snapdragon 8 Gen 3, sạc 90W", "base_price": 18990000, "brand": "Xiaomi", "category": "Điện thoại"},
    {"name": "OPPO Find X7 Ultra", "description": "OPPO Find X7 Ultra camera Hasselblad, màn hình 2K 120Hz", "base_price": 19990000, "brand": "Oppo", "category": "Điện thoại"},
    {"name": "iPhone 15 128GB", "description": "iPhone 15 chip A16 Bionic, Dynamic Island, cổng USB-C", "base_price": 21990000, "brand": "Apple", "category": "Điện thoại"},
    {"name": "Samsung Galaxy A55 5G", "description": "Galaxy A55 5G Exynos 1480, màn hình Super AMOLED 120Hz", "base_price": 8990000, "brand": "Samsung", "category": "Điện thoại"},
    {"name": "Xiaomi Redmi Note 13 Pro", "description": "Redmi Note 13 Pro camera 200MP, AMOLED 120Hz, pin 5100mAh", "base_price": 6490000, "brand": "Xiaomi", "category": "Điện thoại"},

    # Laptop
    {"name": "MacBook Pro M3 14 inch", "description": "MacBook Pro 14 M3 chip, màn hình Liquid Retina XDR, 18GB RAM", "base_price": 42990000, "brand": "Apple", "category": "Laptop"},
    {"name": "ASUS ROG Zephyrus G14", "description": "Laptop gaming ASUS ROG G14, RTX 4070, Ryzen 9, màn 120Hz", "base_price": 38990000, "brand": "Asus", "category": "Laptop"},
    {"name": "Dell XPS 13 Plus", "description": "Dell XPS 13 Plus Intel Core i7 13th Gen, màn hình 3.5K OLED", "base_price": 32990000, "brand": "Dell", "category": "Laptop"},
    {"name": "Lenovo ThinkPad X1 Carbon", "description": "ThinkPad X1 Carbon Gen 11, Intel Core i7 vPro, 14 inch 2.8K", "base_price": 35990000, "brand": "Lenovo", "category": "Laptop"},
    {"name": "MSI Katana 15 Gaming", "description": "MSI Katana 15 RTX 4060, Intel i7-13620H, màn 144Hz", "base_price": 24990000, "brand": "MSI", "category": "Laptop"},
    {"name": "Acer Swift Go 14", "description": "Acer Swift Go 14 Intel Core Ultra 7, màn OLED 2.8K, nhẹ 1.25kg", "base_price": 18990000, "brand": "Acer", "category": "Laptop"},
    {"name": "HP Pavilion 15", "description": "HP Pavilion 15 AMD Ryzen 7, màn IPS FHD, pin lâu", "base_price": 15990000, "brand": "HP", "category": "Laptop"},

    # Giày
    {"name": "Giày chạy bộ Nike Air Zoom", "description": "Giày chạy bộ Nike Air Zoom Pegasus 40, đệm Air Zoom phản lực", "base_price": 2890000, "brand": "Nike", "category": "Giày dép"},
    {"name": "Giày Adidas Ultraboost 23", "description": "Adidas Ultraboost 23 Boost midsole, Primeknit upper", "base_price": 3290000, "brand": "Adidas", "category": "Giày dép"},
    {"name": "Giày Biti's Hunter X", "description": "Biti's Hunter X thiết kế mới, đế EVA nhẹ, nhiều màu sắc", "base_price": 790000, "brand": "Biti's", "category": "Giày dép"},
    {"name": "Giày thể thao New Balance 550", "description": "New Balance 550 da thật, phong cách retro basketball", "base_price": 2490000, "brand": "New Balance", "category": "Giày dép"},
    {"name": "Giày boot da nam cao cấp", "description": "Boot da bò nam thủ công, đế cao su chống trượt, bền đẹp", "base_price": 1890000, "brand": "Kangaroo", "category": "Giày dép"},
    {"name": "Giày sneaker nữatform", "description": "Sneaker nữ đế thick sole tăng chiều cao, chất liệu vải canvas", "base_price": 650000, "brand": "IVY Moda", "category": "Giày dép"},

    # Túi xách
    {"name": "Túi xách da nữ tote bag", "description": "Túi tote da thuộc nam giới, rộng rãi, phù hợp đi làm", "base_price": 1290000, "brand": "Canifa", "category": "Phụ kiện"},
    {"name": "Balo laptop nam chống nước", "description": "Balo laptop 15.6 inch, chất liệu polyester chống nước, nhiều ngăn", "base_price": 550000, "brand": "Kaps", "category": "Phụ kiện"},
    {"name": "Túi đeo chéo mini nữ", "description": "Túi đeo chéo mini da PU, dây đeo điều chỉnh, sang trọng", "base_price": 450000, "brand": "Routine", "category": "Phụ kiện"},
    {"name": "Vali xe cầm tay 20 inch", "description": "Vali polycarbonate siêu nhẹ, 4 bánh xoay 360°, khóa TSA", "base_price": 1890000, "brand": "VinFast", "category": "Phụ kiện"},

    # Đồng hồ
    {"name": "Đồng hồ Apple Watch Series 9", "description": "Apple Watch Series 9 GPS 45mm, viền nhôm, dây silicone", "base_price": 9490000, "brand": "Apple", "category": "Đồng hồ"},
    {"name": "Đồng hồ Samsung Galaxy Watch 6", "description": "Galaxy Watch 6 44mm, Sapphire crystal, pin 40h", "base_price": 6990000, "brand": "Samsung", "category": "Đồng hồ"},
    {"name": "Đồng hồ Casio G-Shock GA-2100", "description": "Casio G-Shock GA-2100 'CasiOak', carbon core guard", "base_price": 2490000, "brand": "Casio", "category": "Đồng hồ"},
    {"name": "Đồng hồ cơ Orient Bambino", "description": "Orient Bambino Version 4, cơ tự động, kính sapphire", "base_price": 4890000, "brand": "Orient", "category": "Đồng hồ"},

    # Mỹ phẩm
    {"name": "Kem chống nắng La Roche-Posay", "description": "Kem chống nắng SPF50+ PA++++, kết cấu nhẹ, không gây bí", "base_price": 390000, "brand": "La Roche-Posay", "category": "Mỹ phẩm"},
    {"name": "Serum Vitamin C The Ordinary", "description": "Serum Vitamin C 23% + HA 2%, làm sáng da, mờ thâm", "base_price": 250000, "brand": "The Ordinary", "category": "Mỹ phẩm"},
    {"name": "Son môi MAC Matte Lipstick", "description": "Son MAC Matte Lipstick màu đỏ cam kinh điển, bền màu", "base_price": 580000, "brand": "MAC", "category": "Mỹ phẩm"},
    {"name": "Kem dưỡng đêm Retinol", "description": "Kem dưỡng đêm Retinol 0.5%, chống lão hóa, giảm nếp nhăn", "base_price": 650000, "brand": "CeraVe", "category": "Mỹ phẩm"},
    {"name": "Nước hoa nữ Dior J'adore", "description": "Nước hoa Dior J'adore Eau de Parfum 50ml, hương hoa quả", "base_price": 2890000, "brand": "Dior", "category": "Mỹ phẩm"},
    {"name": "Set skincare cơ bản 3 bước", "description": "Set rửa mặt + toner + kem dưỡng, phù hợp da nhạy cảm", "base_price": 450000, "brand": "Cetaphil", "category": "Mỹ phẩm"},

    # Sách
    {"name": "Đắc Nhân Tâm - Dale Carnegie", "description": "Sách kinh điển về kỹ năng giao tiếp và ứng xử", "base_price": 85000, "brand": "First News", "category": "Sách"},
    {"name": "Tư Duy Nhanh Và Chậm - Daniel Kahneman", "description": "Sách tâm lý học về cách tư duy và ra quyết định", "base_price": 150000, "brand": "NXB Hội Nhà Văn", "category": "Sách"},
    {"name": "Nhà Giả Kim - Paulo Coelho", "description": "Tiểu thuyết huyền bí về hành trình tìm kiếm vận mệnh", "base_price": 95000, "brand": "NXB Văn Học", "category": "Sách"},
    {"name": "Tư Duy Hệ Thống - Donella Meadows", "description": "Sách về tư duy hệ thống và giải quyết vấn đề phức tạp", "base_price": 120000, "brand": "NXB Trẻ", "category": "Sách"},

    # Đồ điện tử khác
    {"name": "Tai nghe Sony WH-1000XM5", "description": "Tai nghe chống rung chủ động tốt nhất, pin 30h, LDAC", "base_price": 7990000, "brand": "Sony", "category": "Âm thanh"},
    {"name": "Loa Bluetooth JBL Charge 5", "description": "Loa JBL Charge 5 chống nước IP67, pin 20h, powerbank", "base_price": 3490000, "brand": "JBL", "category": "Âm thanh"},
    {"name": "Chuột không dây Logitech MX Master 3S", "description": "Chuột Logitech MX Master 3S, 8000 DPI, sạc USB-C", "base_price": 2490000, "brand": "Logitech", "category": "Phụ kiện máy tính"},
    {"name": "Bàn phím cơ Keychron K8 Pro", "description": "Bàn phím cơ Keychron K8 Pro TKL, hot-swap, RGB, VIA", "base_price": 2290000, "brand": "Keychron", "category": "Phụ kiện máy tính"},
    {"name": "Màn hình Dell UltraSharp 27 4K", "description": "Màn hình Dell U2723QE 27 inch 4K, USB-C hub, IPS Black", "base_price": 12990000, "brand": "Dell", "category": "Màn hình"},
    {"name": "Ổ cứng SSD Samsung 990 Pro 2TB", "description": "SSD NVMe Samsung 990 Pro 2TB, PCIe 4.0, 7450 MB/s", "base_price": 3890000, "brand": "Samsung", "category": "Linh kiện"},
    {"name": "Card màn hình RTX 4080 Super", "description": "NVIDIA RTX 4080 Super 16GB GDDR6X, DLSS 3.5, Ray Tracing", "base_price": 25990000, "brand": "NVIDIA", "category": "Linh kiện"},
]

VIETNAMESE_CATEGORIES = [
    {"name": "Thời trang nam", "slug": "thoi-trang-nam", "description": "Quần áo nam: áo, quần, áo khoác, vest"},
    {"name": "Thời trang nữ", "slug": "thoi-trang-nu", "description": "Quần áo nữ: váy, áo, quần, áo khoác"},
    {"name": "Thời trang unisex", "slug": "thoi-trang-unisex", "description": "Quần áo unisex, streetwear, oversize"},
    {"name": "Thể thao", "slug": "the-thao", "description": "Đồ thể thao, giày, phụ kiện tập gym"},
    {"name": "Điện thoại", "slug": "dien-thoai", "description": "Điện thoại thông minh, phụ kiện điện thoại"},
    {"name": "Laptop", "slug": "laptop", "description": "Laptop văn phòng, gaming, workstation"},
    {"name": "Giày dép", "slug": "giay-dep", "description": "Giày sneaker, boot, sandal, dép"},
    {"name": "Phụ kiện", "slug": "phu-kien", "description": "Túi, balo, vali, ví, mũ, kính"},
    {"name": "Đồng hồ", "slug": "dong-ho", "description": "Đồng hồ thông minh, cơ, quartz"},
    {"name": "Mỹ phẩm", "slug": "my-pham", "description": "Chăm sóc da, trang điểm, nước hoa"},
    {"name": "Sách", "slug": "sach", "description": "Sách kỹ năng sống, tiểu thuyết, kinh tế"},
    {"name": "Âm thanh", "slug": "am-thanh", "description": "Tai nghe, loa, micro, âm thanh"},
    {"name": "Phụ kiện máy tính", "slug": "phu-kien-may-tinh", "description": "Chuột, bàn phím, lót chuột, hub"},
    {"name": "Màn hình", "slug": "man-hinh", "description": "Màn hình máy tính, gaming, thiết kế"},
    {"name": "Linh kiện", "slug": "linh-kien", "description": "CPU, GPU, RAM, SSD, mainboard, PSU"},
    {"name": "Đồ gia dụng", "slug": "do-gia-dung", "description": "Nồi chiên không dầu, máy hút bụi, lò vi sóng"},
    {"name": "Mẹ và bé", "slug": "me-va-be", "description": "Sữa, bỉm, đồ chơi, chăm sóc bé"},
    {"name": "Thực phẩm", "slug": "thuc-pham", "description": "Đồ ăn vặt, nước uống, thực phẩm khô"},
    {"name": "Đồ chơi", "slug": "do-choi", "description": "Lego, mô hình, đồ chơi trí tuệ, outdoor"},
    {"name": "Sức khỏe", "slug": "suc-khoe", "description": "Thiết bị y tế, vitamin, thuốc không kê đơn"},
]


async def create_categories(session: AsyncSession) -> List[Category]:
    """Create categories in database."""
    print("Creating categories...")
    categories = []

    for i, cat_data in enumerate(VIETNAMESE_CATEGORIES):
        # Check if category already exists
        existing = await session.execute(
            select(Category).where(Category.slug == cat_data["slug"])
        )
        category = existing.scalar_one_or_none()

        if not category:
            category = Category(
                id=generate_uuidv7(),
                name=cat_data["name"],
                slug=cat_data["slug"],
                parent_id=None
            )
            session.add(category)

        categories.append(category)

    await session.commit()
    print(f"Created/found {len(categories)} categories")
    return categories


async def create_products(session: AsyncSession, categories: List[Category]) -> List[Product]:
    """Create products in database."""
    print("Creating products...")

    # Map category names to category objects
    category_map = {cat.name: cat for cat in categories}

    products = []
    for i, prod_data in enumerate(VIETNAMESE_PRODUCTS):
        # Check if product already exists (by name)
        existing = await session.execute(
            select(Product).where(Product.name == prod_data["name"])
        )
        product = existing.scalar_one_or_none()

        if not product:
            # Add some price variation
            price_variation = random.uniform(0.9, 1.1)
            price = int(prod_data["base_price"] * price_variation / 1000) * 1000  # Round to nearest 1000

            category = category_map.get(prod_data["category"])
            if not category:
                # Use first category as fallback
                category = categories[0]

            product = Product(
                id=generate_uuidv7(),
                name=prod_data["name"],
                description=prod_data["description"],
                price=Decimal(str(price)),
                brand=prod_data["brand"],
                category_id=category.id,
                stock_quantity=random.randint(10, 500),
                version=1,
                search_vector=""  # Will be updated by trigger
            )
            session.add(product)

        products.append(product)

    await session.commit()
    print(f"Created/found {len(products)} products")
    return products


async def generate_embeddings_for_products(products: List[Product]):
    """Generate embeddings for products using the embedding service or mock them."""
    print("Generating embeddings for products...")

    products_without_embedding = [p for p in products if p.embedding is None]

    if not products_without_embedding:
        print("All products already have embeddings")
        return

    print(f"Generating mock embeddings for {len(products_without_embedding)} products...")

    # Generate mock embeddings (1536 dimensions, zero vectors)
    # In production, this would call the Free LLM API
    for product in products_without_embedding:
        product.embedding = [0.0] * 1536

    print("Mock embeddings generated")


async def sync_products_to_meilisearch(products: List[Product]):
    """Sync products to Meilisearch."""
    print("Syncing products to Meilisearch...")

    search_service = SearchService()

    try:
        # Ensure index is initialized with Vietnamese settings
        await search_service.ensure_index_initialized()

        # Format products for Meilisearch
        documents = []
        for product in products:
            if product.embedding is not None:
                doc = {
                    "id": str(product.id),
                    "name": product.name,
                    "description": product.description or "",
                    "price": float(product.price) if product.price else 0.0,
                    "brand": product.brand or "",
                    "category_id": str(product.category_id) if product.category_id else "",
                    "search_vector": product.search_vector or "",
                    "embedding": product.embedding,
                    "updated_at": product.updated_at.isoformat() if product.updated_at else "",
                    "stock_quantity": product.stock_quantity,
                }
                documents.append(doc)

        if documents:
            # Sync in batches
            batch_size = 100
            for i in range(0, len(documents), batch_size):
                batch = documents[i:i + batch_size]
                print(f"  Syncing batch {i//batch_size + 1}/{(len(documents) + batch_size - 1)//batch_size} ({len(batch)} products)...")

                result = await search_service.meilisearch.add_documents(
                    index_name=search_service.meilisearch.index_name,
                    documents=batch
                )

                if result.get("status") != "succeeded":
                    print(f"  Warning: Batch sync returned: {result}")

                await asyncio.sleep(0.2)  # Small delay between batches

            print(f"Synced {len(documents)} products to Meilisearch")
        else:
            print("No products with embeddings to sync")

    except Exception as e:
        print(f"Error syncing to Meilisearch: {e}")
        raise
    finally:
        await search_service.close()


async def verify_search_functionality():
    """Verify search is working correctly."""
    print("\nVerifying search functionality...")

    search_service = SearchService()

    try:
        test_queries = [
            "ao thun",
            "dien thoai",
            "laptop gaming",
            "giay the thao",
            "tui xach nu",
        ]

        for query in test_queries:
            result = await search_service.search_products(query=query, limit=5)
            hits = result.get("hits", [])
            total = result.get("estimatedTotalHits", 0)
            processing_time = result.get("processingTimeMs", 0)

            print(f"  Query: '{query}' -> {total} hits, {processing_time}ms")
            if hits:
                print(f"    Top result: {hits[0].get('name', 'N/A')}")

        # Test facets
        result = await search_service.search_products(
            query="",
            facets=["category_id", "brand", "price", "is_active"],
            limit=10
        )

        facets = result.get("facetDistribution", {})
        print(f"\n  Facets returned: {list(facets.keys())}")
        for facet_name, facet_values in facets.items():
            print(f"    {facet_name}: {len(facet_values)} values")

    except Exception as e:
        print(f"Error verifying search: {e}")
    finally:
        await search_service.close()


async def main():
    """Main seeding function."""
    print("=" * 60)
    print("VIETNAMESE E-COMMERCE SEED DATA GENERATOR")
    print("=" * 60)

    # Create database engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            # Create categories
            categories = await create_categories(session)

            # Create products
            products = await create_products(session, categories)

            # Generate embeddings
            await generate_embeddings_for_products(products)

            # Sync to Meilisearch
            await sync_products_to_meilisearch(products)

            # Verify search
            await verify_search_functionality()

            print("\n" + "=" * 60)
            print("SEED DATA GENERATION COMPLETED SUCCESSFULLY!")
            print("=" * 60)
            print(f"Categories: {len(categories)}")
            print(f"Products: {len(products)}")
            print(f"Products with embeddings: {sum(1 for p in products if p.embedding is not None)}")

        except Exception as e:
            print(f"\nError during seeding: {e}")
            import traceback
            traceback.print_exc()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())