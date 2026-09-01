from app.models.user import User
from app.schemas.user import UserCreate
from app.interfaces.user import UserRepositoryInterface
from app.core.security import get_password_hash, verify_password

class UserService:
    def __init__(self, user_repo: UserRepositoryInterface):
        self.user_repo = user_repo

    async def create_user(self, user_in: UserCreate) -> User:
        existing_user = await self.user_repo.get_by_email(user_in.email)
        if existing_user:
            raise ValueError("Email already registered")
            
        # In a real implementation we would also check username uniqueness
            
        hashed_password = get_password_hash(user_in.password)
        new_user = User(
            username=user_in.username,
            email=user_in.email,
            hashed_password=hashed_password,
            is_active=True
        )
        return await self.user_repo.create(new_user)

    async def authenticate(self, email: str, password: str) -> User | None:
        user = await self.user_repo.get_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user
