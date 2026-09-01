from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.interfaces.user import UserRepositoryInterface
from typing import Optional

class UserRepository(UserRepositoryInterface):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalars().first()
        
    async def get_by_email(self, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email, User.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user
        
    async def update(self, user: User) -> User:
        # In SQLAlchemy, modifying the object and committing is enough,
        # but we can explicitly merge if needed.
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user
