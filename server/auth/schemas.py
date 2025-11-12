from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    age: Optional[int] = None
    interests: Optional[list[str]] = None
    goals: Optional[str] = None
    learning_pace: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    studies: Optional[list[dict]] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# New schemas for password reset and refresh tokens
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=6)

class RefreshRequest(BaseModel):
    refresh_token: str

class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LogoutRequest(BaseModel):
    refresh_token: str