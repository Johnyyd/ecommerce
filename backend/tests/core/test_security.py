from app.core.security import verify_password, get_password_hash, create_access_token
from passlib.hash import argon2
import jwt
from app.core.config import settings
from datetime import timedelta

def test_password_hashing():
    password = "supersecretpassword123!"
    hashed = get_password_hash(password)
    
    assert password != hashed
    assert verify_password(password, hashed)
    assert not verify_password("wrongpassword", hashed)
    
    # Ensure it's using argon2
    assert hashed.startswith("$argon2")

def test_create_access_token():
    subject = "user123"
    token = create_access_token(subject, expires_delta=timedelta(minutes=15))
    
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    
    assert payload["sub"] == subject
    assert "exp" in payload
