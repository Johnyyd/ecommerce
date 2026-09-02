import asyncio
import sys
import argparse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User

async def create_admin(username: str, email: str, password: str):
    async with AsyncSessionLocal() as session:
        session: AsyncSession
        hashed_password = get_password_hash(password)
        new_user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            role="admin",
            is_active=True
        )
        session.add(new_user)
        try:
            await session.commit()
            print(f"Admin user '{username}' created successfully.")
        except Exception as e:
            await session.rollback()
            print(f"Failed to create admin user: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create an admin user")
    parser.add_argument("--username", required=True, help="Admin username")
    parser.add_argument("--email", required=True, help="Admin email")
    parser.add_argument("--password", required=True, help="Admin password")
    
    args = parser.parse_args()
    
    asyncio.run(create_admin(args.username, args.email, args.password))
