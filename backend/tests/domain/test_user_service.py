import pytest
from uuid import UUID
from app.models.user import User
from app.schemas.user import UserCreate
from app.services.user import UserService
from app.interfaces.user import UserRepositoryInterface
from app.core.security import verify_password
from app.core.utils import generate_uuidv7

class MockUserRepository(UserRepositoryInterface):
    def __init__(self):
        self.users = {}

    async def get_by_id(self, user_id: UUID) -> User | None:
        return self.users.get(user_id)

    async def get_by_email(self, email: str) -> User | None:
        for user in self.users.values():
            if user.email == email and user.deleted_at is None:
                return user
        return None

    async def create(self, user: User) -> User:
        if user.id is None:
            user.id = generate_uuidv7()
        self.users[user.id] = user
        return user

    async def update(self, user: User) -> User:
        self.users[user.id] = user
        return user

@pytest.mark.asyncio
async def test_user_service_create_user():
    repo = MockUserRepository()
    service = UserService(repo)
    
    user_in = UserCreate(username="testuser", email="test@example.com", password="SecretPassword123!")
    user = await service.create_user(user_in)
    
    assert user.id is not None
    assert user.email == "test@example.com"
    assert verify_password("SecretPassword123!", user.hashed_password)
    
    # Try creating again with same email
    with pytest.raises(ValueError):
        await service.create_user(user_in)

@pytest.mark.asyncio
async def test_user_service_authenticate():
    repo = MockUserRepository()
    service = UserService(repo)
    
    user_in = UserCreate(username="testuser2", email="test2@example.com", password="SecretPassword123!")
    await service.create_user(user_in)
    
    user = await service.authenticate("test2@example.com", "SecretPassword123!")
    assert user is not None
    assert user.email == "test2@example.com"
    
    user_fail = await service.authenticate("test2@example.com", "wrong")
    assert user_fail is None
