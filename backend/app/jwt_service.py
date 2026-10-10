import os
import jwt
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
if not JWT_SECRET or JWT_SECRET == "replace_with_a_long_random_jwt_secret":
    raise RuntimeError("JWT_SECRET must be configured with a strong random secret")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def create_access_token(user_id: str):
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str):
    return jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALGORITHM]
    )
