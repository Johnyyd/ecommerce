import pytest
from pydantic import ValidationError
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from uuid import UUID
from app.core.utils import generate_uuidv7

def test_generate_uuidv7():
    val = generate_uuidv7()
    assert isinstance(val, UUID)
    assert val.version == 7

def test_user_schema_validation():
    # Valid create
    user_in = UserCreate(email="test@example.com", password="SecurePassword123!", username="testuser")
    assert user_in.email == "test@example.com"
    
    # Invalid email
    with pytest.raises(ValidationError):
        UserCreate(email="invalidemail", password="pw", username="us")
        
    # Invalid password (maybe too short in the future, for now just ensure it's required)
    with pytest.raises(ValidationError):
        UserCreate(email="test@example.com", username="u")

def test_user_model_instantiation():
    u = User(id=generate_uuidv7(), email="test@example.com", hashed_password="hash", username="testuser")
    assert u.email == "test@example.com"
    assert u.username == "testuser"
