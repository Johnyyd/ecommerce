import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.models.base import Base
from app.models.product import Product, Category
from app.models.user import User
from app.core.security import get_password_hash
from app.core.config import settings
from app.core.utils import generate_uuidv7

DATABASE_URL = f"postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"

async def seed():
    engine = create_async_engine(DATABASE_URL, echo=True)
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

        # 2. Seed Categories
        result_categories = await session.execute(select(Category))
        categories = result_categories.scalars().all()
        
        if len(categories) == 0:
            print("Creating categories...")
            cat_apparel = Category(id=generate_uuidv7(), name="Apparel", slug="apparel")
            cat_footwear = Category(id=generate_uuidv7(), name="Footwear", slug="footwear")
            cat_accessories = Category(id=generate_uuidv7(), name="Accessories", slug="accessories")
            cat_home = Category(id=generate_uuidv7(), name="Home", slug="home")
            
            session.add_all([cat_apparel, cat_footwear, cat_accessories, cat_home])
            await session.commit()
            categories = [cat_apparel, cat_footwear, cat_accessories, cat_home]
        else:
            print("Categories already seeded.")

        # 3. Seed Products
        result_products = await session.execute(select(Product))
        products = result_products.scalars().all()
        if len(products) < 100:
            print("Seeding 100 products...")
            product_data = []
            import random
            
            brands = ["Acme", "Pace", "Hide", "Vision", "North", "TechCorp", "HomeGoods"]
            
            # First 10 specific products
            if len(products) == 0 and len(categories) >= 3:
                cat_apparel_id = categories[0].id
                cat_footwear_id = categories[1].id
                cat_accessories_id = categories[2].id
                
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
                    )
                ]
                product_data.extend(specific_products)
                
            # Fill the rest up to 100
            for i in range(len(product_data) + 1, 101):
                cat = random.choice(categories)
                brand = random.choice(brands)
                product_data.append(Product(
                    name=f"Premium Product {i}",
                    description=f"This is a high quality premium product {i} with excellent features and durability.",
                    price=25.0 + (i % 20) * 5,
                    stock_quantity=50 + (i % 10),
                    category_id=cat.id,
                    brand=brand,
                    rating=round(random.uniform(3.5, 5.0), 1)
                ))
                
            session.add_all(product_data)
        else:
            print("Products already seeded.")
            
        await session.commit()
        print("Seed completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
