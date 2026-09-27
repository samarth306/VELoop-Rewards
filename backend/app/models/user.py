from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100)


class UserResponse(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    account_status: str = "ACTIVE"
    wallet_id: Optional[str] = None
    