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
        UserCreate(email="invalidemail", password="SecurePassword123!", username="testuser")

    # Missing uppercase
    with pytest.raises(ValidationError, match="in hoa"):
        UserCreate(email="test@example.com", password="securepassword123!", username="testuser")

    # Missing lowercase
    with pytest.raises(ValidationError, match="in thường"):
        UserCreate(email="test@example.com", password="SECUREPASSWORD123!", username="testuser")

    # Missing digit
    with pytest.raises(ValidationError, match="chữ số"):
        UserCreate(email="test@example.com", password="SecurePassword!", username="testuser")

    # Missing special character
    with pytest.raises(ValidationError, match="ký tự đặc biệt"):
        UserCreate(email="test@example.com", password="SecurePassword123", username="testuser")

    # Too short (< 8 chars)
    with pytest.raises(ValidationError, match="at least 8 characters"):
        UserCreate(email="test@example.com", password="Sec1!", username="testuser")

def test_user_model_instantiation():
    u = User(id=generate_uuidv7(), email="test@example.com", hashed_password="hash", username="testuser")
    assert u.email == "test@example.com"
    assert u.username == "testuser"
