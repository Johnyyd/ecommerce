import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, insert, func
from datetime import datetime, timezone

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.models.base import Base
from app.models.product import Product, Category
from app.models.user import User
from app.models.brand import Brand
from app.models.voucher import Voucher
from app.core.security import get_password_hash
from app.core.config import settings
from app.core.utils import generate_uuidv7
import random

DATABASE_URL = f"postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"

async def seed():
    echo_mode = os.getenv("SQL_ECHO", "false").lower() == "true"
    engine = create_async_engine(DATABASE_URL, echo=echo_mode)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        # Create tables if not exist
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        # 1. Seed Users
        result_users = await session.execute(select(User))
        users = result_users.scalars().all()
        if len(users) < 12:
            print("Seeding users (2 admins, 10 customers)...")
            user_data = []
            # 2 admins
            for i in range(1, 3):
                user_data.append(User(
                    username=f"admin{i}",
                    email=f"admin{i}@example.com",
                    hashed_password=get_password_hash("admin123"),
                    role="admin"
                ))
            # 10 users
            for i in range(1, 11):
                user_data.append(User(
                    username=f"user{i}",
                    email=f"user{i}@example.com",
                    hashed_password=get_password_hash("user123"),
                    role="customer"
                ))
            session.add_all(user_data)
        else:
            print("Users already seeded.")

        # Seed 1 manager account if not exists
        manager_check = await session.execute(select(User).where(User.username == "manager1"))
        if not manager_check.scalars().first():
            print("Seeding manager1 user...")
            session.add(User(
                username="manager1",
                email="manager1@example.com",
                hashed_password=get_password_hash("manager123"),
                role="manager"
            ))

        # 2. Seed Categories
        result_categories = await session.execute(select(Category))
        categories = result_categories.scalars().all()
        
        if not categories:
            print("Seeding categories...")
            cat_apparel = Category(id=generate_uuidv7(), name="Apparel", slug="apparel")
            cat_footwear = Category(id=generate_uuidv7(), name="Footwear", slug="footwear")
            cat_accessories = Category(id=generate_uuidv7(), name="Accessories", slug="accessories")
            cat_home = Category(id=generate_uuidv7(), name="Home", slug="home")
            session.add_all([cat_apparel, cat_footwear, cat_accessories, cat_home])
            await session.flush()
            categories = [cat_apparel, cat_footwear, cat_accessories, cat_home]
        else:
            print("Categories already seeded.")

        # 3. Seed Brands
        result_brands = await session.execute(select(Brand))
        if not result_brands.scalars().first():
            print("Seeding brands...")
            brand_data = [
                Brand(name="Nike", slug="nike", logo_url="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100", description="Just Do It. Athletic apparel and footwear."),
                Brand(name="Apple", slug="apple", logo_url="https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=100", description="Think Different. Consumer electronics."),
                Brand(name="Sony", slug="sony", logo_url="https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=100", description="Be Moved. Premium audio and cameras."),
                Brand(name="Uniqlo", slug="uniqlo", logo_url="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=100", description="LifeWear. Simple made better clothing.")
            ]
            session.add_all(brand_data)
        else:
            print("Brands already seeded.")

        # 4. Seed Vouchers
        result_vouchers = await session.execute(select(Voucher))
        if not result_vouchers.scalars().first():
            print("Seeding vouchers...")
            voucher_data = [
                Voucher(code="WELCOME10", discount_type="PERCENTAGE", discount_value=10.0, min_order_amount=20.0, max_discount_amount=50.0, usage_limit=1000, is_active=True),
                Voucher(code="FREESHIP", discount_type="FIXED", discount_value=5.0, min_order_amount=15.0, usage_limit=500, is_active=True),
                Voucher(code="SUPERVIP", discount_type="PERCENTAGE", discount_value=25.0, min_order_amount=100.0, max_discount_amount=100.0, usage_limit=50, is_active=True)
            ]
            session.add_all(voucher_data)
        else:
            print("Vouchers already seeded.")

        # 5. Seed Products
        count_products = (await session.execute(select(func.count(Product.id)))).scalar_one()
        
        target_count = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.getenv("SEED_PRODUCTS_COUNT", "1000000"))
        
        if count_products < target_count:
            print(f"Seeding products to reach target {target_count:,} (currently {count_products:,})...")
            brands = ["Acme", "Pace", "Hide", "Vision", "Nova", "Zenith", "Apex", "Vortex"]
            
            cat_apparel_id = next((c.id for c in categories if c.slug == "apparel"), categories[0].id)
            cat_footwear_id = next((c.id for c in categories if c.slug == "footwear"), categories[0].id)
            cat_accessories_id = next((c.id for c in categories if c.slug == "accessories"), categories[0].id)
            cat_home_id = next((c.id for c in categories if c.slug == "home"), categories[0].id)

            if count_products == 0:
                specific_products = [
                    Product(
                        id=generate_uuidv7(), name="Minimalist T-Shirt", description="Premium cotton t-shirt", 
                        price=35.0, stock_quantity=100, category_id=cat_apparel_id, brand="Acme", rating=4.5
                    ),
                    Product(
                        id=generate_uuidv7(), name="Everyday Hoodie", description="Heavyweight everyday hoodie", 
                        price=85.0, stock_quantity=50, category_id=cat_apparel_id, brand="Acme", rating=4.8
                    ),
                    Product(
                        id=generate_uuidv7(), name="Running Sneakers", description="Lightweight running shoes", 
                        price=120.0, stock_quantity=30, category_id=cat_footwear_id, brand="Pace", rating=4.2
                    ),
                    Product(
                        id=generate_uuidv7(), name="Leather Wallet", description="Slim bifold wallet", 
                        price=45.0, stock_quantity=200, category_id=cat_accessories_id, brand="Hide", rating=4.9
                    ),
                    Product(
                        id=generate_uuidv7(), name="Polarized Sunglasses", description="Classic aviator style", 
                        price=95.0, stock_quantity=40, category_id=cat_accessories_id, brand="Vision", rating=4.1
                    ),
                    Product(
                        id=generate_uuidv7(), name="Yoga Mat", description="Non-slip yoga mat", 
                        price=30.0, stock_quantity=150, category_id=cat_home_id, brand="Zenith", rating=4.4
                    )
                ]
                session.add_all(specific_products)
                await session.commit()
                count_products = len(specific_products)

            BATCH_SIZE = 5000
            total_to_insert = target_count - count_products
            print(f"Bulk inserting {total_to_insert:,} products in batches of {BATCH_SIZE:,}...")
            
            category_ids = [c.id for c in categories]
            now = datetime.now(timezone.utc)
            
            current = count_products
            while current < target_count:
                batch_limit = min(BATCH_SIZE, target_count - current)
                batch_data = []
                for i in range(current + 1, current + batch_limit + 1):
                    cat_id = random.choice(category_ids)
                    brand = random.choice(brands)
                    batch_data.append({
                        "id": generate_uuidv7(),
                        "name": f"Premium Product {i}",
                        "description": f"This is a high quality premium product {i} with excellent features and durability.",
                        "price": round(25.0 + (i % 20) * 5 + (i % 7) * 0.5, 2),
                        "stock_quantity": 50 + (i % 100),
                        "version": 1,
                        "category_id": cat_id,
                        "brand": brand,
                        "rating": round(3.5 + (i % 16) * 0.1, 1),
                        "image_url": None,
                        "created_at": now,
                        "updated_at": now,
                    })
                await session.execute(insert(Product), batch_data)
                await session.commit()
                current += batch_limit
                if current % 20000 == 0 or current >= target_count:
                    print(f"Progress: {current:,}/{target_count:,} products seeded ({(current / target_count) * 100:.1f}%)")
        else:
            print(f"Products already seeded ({count_products:,} existing).")
            
        await session.commit()
        print("Seed completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
