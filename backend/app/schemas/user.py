import re
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Mật khẩu phải có tối thiểu 8 ký tự")
        if len(v) > 128:
            raise ValueError("Mật khẩu không được vượt quá 128 ký tự")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Mật khẩu phải chứa ít nhất 1 chữ cái in hoa (A-Z)")
        if not re.search(r"[a-z]", v):
            raise ValueError("Mật khẩu phải chứa ít nhất 1 chữ cái in thường (a-z)")
        if not re.search(r"\d", v):
            raise ValueError("Mật khẩu phải chứa ít nhất 1 chữ số (0-9)")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+~`\[\]\\;'/]", v):
            raise ValueError("Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...)")
        return v


class UserRegisterRequest(UserCreate):
    captcha_id: Optional[str] = None
    captcha_code: Optional[str] = None


class CaptchaResponse(BaseModel):
    captcha_id: str
    captcha_svg: str
    expires_in_seconds: int = 300


class UserResponse(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    is_active: bool
    role: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserAdminUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
