import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.product import Product
from app.models.user import User
from app.core.security import get_password_hash
from app.core.config import settings

DATABASE_URL = f"postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"

async def seed():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
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

        # 2. Seed Products
        result_products = await session.execute(select(Product))
        products = result_products.scalars().all()
        if len(products) < 100:
            print("Seeding 100 products...")
            product_data = []
            for i in range(1, 101):
                product_data.append(Product(
                    name=f"Premium Product {i}",
                    description=f"This is a high quality premium product {i} with excellent features and durability.",
                    price=25.0 + i,
                    stock_quantity=50 + (i % 10)
                ))
            session.add_all(product_data)
        else:
            print("Products already seeded.")
            
        await session.commit()
        print("Seed completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
