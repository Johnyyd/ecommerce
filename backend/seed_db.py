import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.product import Product
from app.core.config import settings

# Usually this would be imported, but for a quick script we define it
DATABASE_URL = f"postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"

async def seed():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        # Check if already seeded
        from sqlalchemy import select
        result = await session.execute(select(Product))
        products = result.scalars().all()
        if len(products) > 0:
            print("Already seeded!")
            return

        print("Seeding products...")
        seed_data = [
            Product(name="Apparel Collection", description="Engineered fabrics built for movement and comfort.", price=120.00, stock_quantity=100),
            Product(name="Titanium Watch", description="Precision crafted with high-grade titanium.", price=299.99, stock_quantity=50),
            Product(name="Desk Object", description="A spatial design for modern workspaces.", price=85.00, stock_quantity=200),
            Product(name="Leather Wallet", description="Minimalist wallet made from full-grain leather.", price=45.00, stock_quantity=150)
        ]
        
        session.add_all(seed_data)
        await session.commit()
        print("Seed completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
