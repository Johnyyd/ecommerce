from abc import ABC, abstractmethod
from uuid import UUID
from app.models.user import User
from typing import Optional

class UserRepositoryInterface(ABC):
    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        pass
        
    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[User]:
        pass

    @abstractmethod
    async def get_by_username(self, username: str) -> Optional[User]:
        pass

    @abstractmethod
    async def create(self, user: User) -> User:
        pass
        
    @abstractmethod
    async def update(self, user: User) -> User:
        pass

    @abstractmethod
    async def get_multi(self, skip: int = 0, limit: int = 100) -> list[User]:
        pass

