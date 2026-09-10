import asyncio
import sys
import argparse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User

async def create_staff(username: str, email: str, password: str, role: str):
    if role not in ["admin", "manager"]:
        print("Error: role must be either 'admin' or 'manager'")
        return

    async with AsyncSessionLocal() as session:
        session: AsyncSession
        hashed_password = get_password_hash(password)
        new_user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            role=role,
            is_active=True
        )
        session.add(new_user)
        try:
            await session.commit()
            print(f"User '{username}' with role '{role}' created successfully.")
        except Exception as e:
            await session.rollback()
            print(f"Failed to create user: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a staff user (admin or manager)")
    parser.add_argument("--username", required=True, help="Username")
    parser.add_argument("--email", required=True, help="Email")
    parser.add_argument("--password", required=True, help="Password")
    parser.add_argument("--role", default="manager", choices=["admin", "manager"], help="Role: admin or manager (default: manager)")
    
    args = parser.parse_args()
    
    asyncio.run(create_staff(args.username, args.email, args.password, args.role))
