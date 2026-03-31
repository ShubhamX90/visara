from __future__ import annotations

from pydantic import EmailStr

from app.schemas.common import APIModel, UserRole


class LoginRequest(APIModel):
    email: EmailStr
    password: str


class AuthTokenResponse(APIModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(APIModel):
    user_id: str
    email: EmailStr
    full_name: str
    role: UserRole
    institution: str
