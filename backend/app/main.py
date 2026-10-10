import hashlib

import os
import re

import secrets
import time
import threading
from collections import defaultdict, deque

import smtplib

from datetime import datetime, timedelta, timezone

from email.message import EmailMessage

from typing import Any, Optional

from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request

from fastapi.middleware.cors import CORSMiddleware

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError
from pymongo.collection import ReturnDocument
from backend.database import client
from backend.app.collections import (

    users_collection,

    wallets_collection,

    transactions_collection,

    withdrawals_collection,

    payout_options_collection,

)

from backend.app.wallet_service import credit_wallet, get_transactions

from backend.app.models.auth import (

    RegisterRequest,

    LoginRequest,

    TokenResponse,

)

from backend.app.auth_service import (

    hash_password,

    verify_password,

)

from backend.app.jwt_service import (

    create_access_token,

    decode_access_token,

)

from backend.app.reward_service import (

    DAILY_REWARDS,

    CONVERSION_RATES,

    claim_daily_reward,

    convert_reward_to_ves,

    get_daily_status,

)

from backend.app import collections as app_collections

audit_logs_collection = getattr(app_collections, "audit_logs_collection", None)

APP_VERSION = "2.4.0"

MIN_WITHDRAWAL_VES = 100

RESET_TOKEN_MINUTES = 30

ALLOWED_CURRENCIES = {

    "ves",

    "sves",

    "gems",

    "tokens",

}

PAYOUT_OPTIONS = [

    {

        "method_id": "upi",

        "name": "UPI",

        "type": "UPI",

        "currency": "ves",

        "active": True,

        "denominations": [

            {"payout_value": 10, "required_amount": 2400},

            {"payout_value": 25, "required_amount": 5800},

            {"payout_value": 50, "required_amount": 10000},

            {"payout_value": 100, "required_amount": 19500},

            {"payout_value": 150, "required_amount": 28500},

            {"payout_value": 300, "required_amount": 52500},

            {"payout_value": 500, "required_amount": 80500},

            {"payout_value": 1000, "required_amount": 150000},

        ],

        "description": "UPI payout using VEs.",

    },

    {

        "method_id": "bank_transfer",

        "name": "Bank Transfer",

        "type": "BANK_TRANSFER",

        "currency": "ves",

        "active": True,

        "denominations": [

            {"payout_value": 10, "required_amount": 2400},

            {"payout_value": 25, "required_amount": 5800},

            {"payout_value": 50, "required_amount": 10000},

            {"payout_value": 100, "required_amount": 19500},

            {"payout_value": 150, "required_amount": 28500},

            {"payout_value": 300, "required_amount": 52500},

            {"payout_value": 500, "required_amount": 80500},

            {"payout_value": 1000, "required_amount": 150000},

        ],

        "description": "Bank transfer payout using VEs.",

    },

    {

        "method_id": "upi_qr",

        "name": "UPI QR",

        "type": "UPI_QR",

        "currency": "ves",

        "active": True,

        "denominations": [

            {"payout_value": 10, "required_amount": 2400},

            {"payout_value": 25, "required_amount": 5800},

            {"payout_value": 50, "required_amount": 10000},

            {"payout_value": 100, "required_amount": 19500},

            {"payout_value": 150, "required_amount": 28500},

            {"payout_value": 300, "required_amount": 52500},

            {"payout_value": 500, "required_amount": 80500},

            {"payout_value": 1000, "required_amount": 150000},

        ],

        "description": "UPI QR payout using VEs.",

    },

    {

        "method_id": "amazon_gift_card",

        "name": "Amazon Gift Card",

        "type": "AMAZON_GIFT_CARD",

        "currency": "ves",

        "active": True,

        "denominations": [

            {"payout_value": 10, "required_amount": 2400},

            {"payout_value": 25, "required_amount": 5800},

            {"payout_value": 50, "required_amount": 10000},

            {"payout_value": 100, "required_amount": 19500},

            {"payout_value": 150, "required_amount": 28500},

            {"payout_value": 300, "required_amount": 52500},

            {"payout_value": 500, "required_amount": 80500},

            {"payout_value": 1000, "required_amount": 150000},

        ],

        "description": "Amazon Gift Card redemption delivered to the provided email after manual review.",

    },

    {

        "method_id": "google_play_gift_card",

        "name": "Google Play Gift Card",

        "type": "GOOGLE_PLAY_GIFT_CARD",

        "currency": "ves",

        "active": True,

        "denominations": [

            {"payout_value": 10, "required_amount": 2400},

            {"payout_value": 25, "required_amount": 5800},

            {"payout_value": 50, "required_amount": 10000},

            {"payout_value": 100, "required_amount": 19500},

            {"payout_value": 150, "required_amount": 28500},

            {"payout_value": 300, "required_amount": 52500},

            {"payout_value": 500, "required_amount": 80500},

            {"payout_value": 1000, "required_amount": 150000},

        ],

        "description": "Google Play Gift Card redemption delivered to the provided email after manual review.",

    },

]

app = FastAPI(

    title="VELOOP Rewards API",

    description=(

        "Backend-driven rewards wallet, transaction and payout API "

        "for VELOOP Rewards."

    ),

    version=APP_VERSION,

    docs_url="/docs",

    redoc_url="/redoc",

)

_default_origins = [

    "http://localhost:5173",

    "http://localhost:5174",

    "http://localhost:5175",

    "http://localhost:5176",

    "http://localhost:5177",

    "http://localhost:5178",

    "http://127.0.0.1:5173",

    "http://127.0.0.1:5174",

    "http://127.0.0.1:5175",

    "http://127.0.0.1:5176",

    "http://127.0.0.1:5177",

    "http://127.0.0.1:5178",

    "https://veloop-rewards-frontend-ggzf.onrender.com",

]

_env_origins = [

    item.strip()

    for item in os.getenv("FRONTEND_ORIGINS", "").split(",")

    if item.strip()

]

allowed_origins = list(

    dict.fromkeys(_default_origins + _env_origins)

)

app.add_middleware(

    CORSMiddleware,

    allow_origins=allowed_origins,

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)

security = HTTPBearer()

# Lightweight per-process throttling for sensitive endpoints. For multi-instance
# production deployments, move these counters to Redis or an API gateway.
_rate_events = defaultdict(deque)
_rate_lock = threading.Lock()
_RATE_POLICIES = {
    "/auth/login": (12, 60),
    "/auth/register": (8, 3600),
    "/auth/forgot-password": (4, 900),
    "/auth/reset-password": (8, 900),
    "/admin/auth/reset-password": (5, 300),
    "/admin/rewards/credit": (20, 60),
    "/wallet/me/withdrawal": (10, 60),
}

@app.middleware("http")
async def throttle_sensitive_requests(request: Request, call_next):
    policy = _RATE_POLICIES.get(request.url.path)
    if policy:
        limit, window = policy
        client_ip = request.client.host if request.client else "unknown"
        key = (client_ip, request.method, request.url.path)
        now = time.monotonic()
        with _rate_lock:
            events = _rate_events[key]
            while events and now - events[0] >= window:
                events.popleft()
            if len(events) >= limit:
                from starlette.responses import JSONResponse
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                    headers={"Retry-After": str(max(1, int(window - (now - events[0]))))},
                )
            events.append(now)
    return await call_next(request)

def now_utc() -> datetime:

    return datetime.now(timezone.utc)

def public_document(document: Optional[dict]) -> dict:

    if not document:

        return {}

    result = dict(document)

    result.pop("_id", None)

    result.pop("password_hash", None)

    result.pop("reset_token_hash", None)
    # Legacy wallet documents may still contain the old game-field; keep it
    # out of the public API while the feature remains removed from the app.
    result.pop("spins", None)

    return result

def get_user_by_email(email: str) -> Optional[dict]:

    return users_collection.find_one(

        {"email": email.strip().lower()}

    )

def get_user_wallet(user_id: str) -> dict:

    wallet = wallets_collection.find_one(

        {"user_id": user_id}

    )

    if not wallet:

        raise HTTPException(

            status_code=404,

            detail="Wallet not found",

        )

    return wallet

def validate_currency(currency: str) -> str:

    currency = currency.strip().lower()

    if currency not in ALLOWED_CURRENCIES:

        raise HTTPException(

            status_code=400,

            detail="Invalid currency",

        )

    return currency

def write_audit(user_id: str, action: str, metadata: Optional[dict] = None):

    if audit_logs_collection is None:

        return

    try:

        audit_logs_collection.insert_one({

            "audit_id": str(uuid4()),

            "user_id": user_id,

            "action": action,

            "metadata": metadata or {},

            "created_at": now_utc(),

        })

    except Exception as exc:
        # Audit failure must not leak data or break user flows; log the event for ops.
        print("AUDIT_LOG_WRITE_FAILED:", type(exc).__name__)

def get_payout_option(option_id: str) -> dict:

    """

    Find an active payout method.

    The backend owns this configuration.

    """

    option = payout_options_collection.find_one(
        {"method_id": option_id, "active": True},
        {"_id": 0},
    )
    if option:
        return option

    raise HTTPException(

        status_code=400,

        detail="Invalid or inactive payout option",

    )

def get_payout_denomination(

    option: dict,

    payout_value: int,

) -> dict:

    """

    Find the server-authoritative payout denomination.

    Example:

        ₹10 -> 2400 VEs

        ₹100 -> 19500 VEs

    """

    for denomination in option.get("denominations", []):

        if int(denomination["payout_value"]) == int(payout_value):

            return denomination

    raise HTTPException(

        status_code=400,

        detail="Invalid or unavailable payout denomination",

    )

def mask_payout_details(details: dict) -> dict:

    """

    Return safe payout details for history responses.

    Sensitive values are masked.

    """

    safe = {}

    for key, value in (details or {}).items():

        text = str(value) if value is not None else ""

        if key == "email":
            if "@" in text:
                local, domain = text.split("@", 1)
                safe[key] = f"{local[:1]}***@{domain}"
            else:
                safe[key] = "***"
        elif key in {"account_number", "upi_id"}:

            if "@" in text:

                name, domain = text.split("@", 1)

                safe[key] = (

                    f"{name[:2]}***@{domain}"

                )

            elif len(text) > 4:

                safe[key] = (

                    f"••••{text[-4:]}"

                )

            else:

                safe[key] = "••••"

        elif key in {

            "qr_file_name",

            "bank_name",

            "account_name",

            "payout_mode",

        }:

            safe[key] = text

        else:

            safe[key] = text

    return safe

def sanitize_withdrawal(document: dict) -> dict:

    result = public_document(document)

    result["payout_details"] = mask_payout_details(

        result.get("payout_details", {})

    )

    return result

def validate_payout_details(

    option_id: str,

    details: dict,

) -> dict:

    if not isinstance(details, dict):

        raise HTTPException(

            status_code=422,

            detail="payout_details must be an object",

        )

    option = get_payout_option(option_id)

    payout_type = option["type"]

    normalized = {

        str(k): v

        for k, v in details.items()

    }

    if payout_type == "UPI":

        upi_id = str(

            normalized.get("upi_id", "")

        ).strip()

        if (

            not upi_id

            or "@" not in upi_id

            or " " in upi_id

        ):

            raise HTTPException(

                status_code=422,

                detail=(

                    "A valid UPI ID is required, "

                    "for example name@upi"

                ),

            )

        normalized = {

            "upi_id": upi_id,

            "payout_mode": "UPI_ID",

        }

    elif payout_type == "BANK_TRANSFER":

        account_name = str(

            normalized.get("account_name", "")

        ).strip()

        account_number = str(

            normalized.get("account_number", "")

        ).strip()

        ifsc = str(

            normalized.get("ifsc", "")

        ).strip().upper()

        bank_name = str(

            normalized.get("bank_name", "")

        ).strip()

        if len(account_name) < 2:

            raise HTTPException(

                status_code=422,

                detail=(

                    "Valid account holder name is required"

                ),

            )

        if (

            not account_number.isdigit()

            or not (8 <= len(account_number) <= 18)

        ):

            raise HTTPException(

                status_code=422,

                detail=(

                    "Valid bank account number is required"

                ),

            )

        if not (

            len(ifsc) == 11

            and ifsc[:4].isalpha()

            and ifsc[4] == "0"

            and ifsc[5:].isalnum()

        ):

            raise HTTPException(

                status_code=422,

                detail="Valid IFSC code is required",

            )

        if len(bank_name) < 2:

            raise HTTPException(

                status_code=422,

                detail="Bank name is required",

            )

        normalized = {

            "account_name": account_name,

            "account_number": account_number,

            "ifsc": ifsc,

            "bank_name": bank_name,

        }

    elif payout_type in {"AMAZON_GIFT_CARD", "GOOGLE_PLAY_GIFT_CARD"}:

        email = str(normalized.get("email", "")).strip().lower()

        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):

            raise HTTPException(

                status_code=422,

                detail="A valid gift-card delivery email is required",

            )

        normalized = {"email": email}

    elif payout_type == "UPI_QR":

        upi_id = str(

            normalized.get("upi_id", "")

        ).strip()

        qr_file_name = str(

            normalized.get("qr_file_name", "")

        ).strip()

        if not upi_id and not qr_file_name:

            raise HTTPException(

                status_code=422,

                detail=(

                    "UPI ID or QR reference is required "

                    "for UPI QR payout"

                ),

            )

        if upi_id and (

            "@" not in upi_id

            or " " in upi_id

        ):

            raise HTTPException(

                status_code=422,

                detail="Invalid UPI ID in QR payout details",

            )

        normalized = {

            "upi_id": upi_id or None,

            "payout_mode": "UPI_QR",

            "qr_file_name": qr_file_name or None,

        }

    else:

        raise HTTPException(

            status_code=400,

            detail="Unsupported payout type",

        )

    return normalized

def create_wallet_transaction(

    *,

    user_id: str,

    transaction_type: str,

    amount: int,

    balance_before: Optional[int],

    balance_after: Optional[int],

    source: str,

    reference_id: Optional[str],

    status: str,

    description: str,

    metadata: Optional[dict] = None,

) -> dict:

    if amount <= 0:

        raise HTTPException(

            status_code=400,

            detail="Transaction amount must be greater than zero",

        )

    transaction = {

        "transaction_id": str(uuid4()),

        "user_id": user_id,

        "currency": "ves",

        "type": transaction_type,

        "amount": amount,

        "balance_before": balance_before,

        "balance_after": balance_after,

        "source": source,

        "reference_id": reference_id,

        "status": status,

        "description": description,

        "metadata": metadata or {},

        "created_at": now_utc(),

        "updated_at": now_utc(),

    }

    transactions_collection.insert_one(

        transaction

    )

    return public_document(transaction)

def send_reset_email(

    email: str,

    reset_token: str,

) -> bool:

    smtp_host = os.getenv(

        "SMTP_HOST",

        "",

    ).strip()

    smtp_port = int(

        os.getenv(

            "SMTP_PORT",

            "587",

        )

    )

    smtp_user = os.getenv(

        "SMTP_USER",

        "",

    ).strip()

    smtp_password = os.getenv(

        "SMTP_PASSWORD",

        "",

    )

    smtp_from = os.getenv(

        "SMTP_FROM",

        smtp_user,

    ).strip()

    frontend_url = os.getenv(

        "FRONTEND_URL",

        "http://localhost:5173",

    ).rstrip("/")

    if (

        not smtp_host

        or not smtp_user

        or not smtp_password

        or not smtp_from

    ):

        return False

    reset_link = (

        f"{frontend_url}/reset-password"

        f"?token={reset_token}"

    )

    message = EmailMessage()

    message["Subject"] = (

        "VELOOP Rewards — Password Reset"

    )

    message["From"] = smtp_from

    message["To"] = email

    message.set_content(

        "We received a request to reset your "

        "VELOOP Rewards password.\n\n"

        f"Reset your password here:\n{reset_link}\n\n"

        f"This link expires in "

        f"{RESET_TOKEN_MINUTES} minutes.\n"

        "If you did not request this, "

        "you can safely ignore this email."

    )

    with smtplib.SMTP(

        smtp_host,

        smtp_port,

        timeout=10,

    ) as server:

        server.starttls()

        server.login(

            smtp_user,

            smtp_password,

        )

        server.send_message(message)

    return True

class WithdrawalRequest(BaseModel):

    amount: int = Field(

        gt=0,

    )

    payout_option_id: str = Field(

        min_length=1,

        max_length=50,

    )

    payout_details: dict

    request_id: str = Field(
        min_length=8,
        max_length=100,
        pattern=r"^[A-Za-z0-9._:-]+$",
    )

class WithdrawalStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(PROCESSING|APPROVED|REJECTED)$")
    rejection_reason: Optional[str] = Field(default=None, max_length=500)
    review_note: Optional[str] = Field(default=None, max_length=500)
    transaction_id: Optional[str] = Field(default=None, max_length=150)


class ProfileUpdateRequest(BaseModel):

    name: str = Field(

        min_length=2,

        max_length=100,

    )

class ChangePasswordRequest(BaseModel):

    current_password: str = Field(

        min_length=1,

    )

    new_password: str = Field(

        min_length=8,

        max_length=128,

    )

class ForgotPasswordRequest(BaseModel):

    email: EmailStr
    
class ConversionRequest(BaseModel):
    currency: str = Field(..., pattern="^(sves|gems|tokens)$")
    amount: int = Field(..., gt=0)


ConversionRequest.model_rebuild()


class ResetPasswordRequest(BaseModel):
    token: str = Field(
        min_length=20,
    )

    new_password: str = Field(
        min_length=8,
        max_length=128,
    )

    token: str = Field(

        min_length=20,

    )

    new_password: str = Field(

        min_length=8,

        max_length=128,

    )

def get_current_user(

    credentials: HTTPAuthorizationCredentials = Depends(

        security

    ),

):

    try:

        payload = decode_access_token(

            credentials.credentials

        )

    except Exception:

        raise HTTPException(

            status_code=401,

            detail="Invalid or expired token",

        )

    user_id = payload.get("sub")

    if not user_id:

        raise HTTPException(

            status_code=401,

            detail="Invalid token",

        )

    user = users_collection.find_one(

        {"user_id": user_id},

        {

            "_id": 0,

            "password_hash": 0,

            "reset_token_hash": 0,

        },

    )

    if not user:

        raise HTTPException(

            status_code=404,

            detail="User not found",

        )

    if user.get("account_status") != "ACTIVE":

        raise HTTPException(

            status_code=403,

            detail="Account is not active",

        )

    return user

@app.post(

    "/auth/register",

    response_model=TokenResponse,

)

def register(

    request: RegisterRequest,

):

    email = request.email.strip().lower()

    if get_user_by_email(email):

        raise HTTPException(

            status_code=400,

            detail="Email already registered",

        )

    user_id = str(uuid4())

    wallet_id = str(uuid4())

    timestamp = now_utc()

    user = {

        "user_id": user_id,

        "email": email,

        "name": request.name.strip(),

        "password_hash": hash_password(

            request.password

        ),

        "account_status": "ACTIVE",

        "wallet_id": wallet_id,

        "created_at": timestamp,

        "updated_at": timestamp,

    }

    wallet = {

        "wallet_id": wallet_id,

        "user_id": user_id,

        "ves": 0,

        "sves": 0,

        "gems": 0,

        "tokens": 0,

        "created_at": timestamp,

        "updated_at": timestamp,

    }

    try:

        users_collection.insert_one(user)

        wallets_collection.insert_one(wallet)

    except Exception:

        users_collection.delete_one(

            {"user_id": user_id}

        )

        wallets_collection.delete_one(

            {"wallet_id": wallet_id}

        )

        raise HTTPException(

            status_code=500,

            detail="Unable to create account",

        )

    return {

        "access_token": create_access_token(

            user_id

        ),

        "token_type": "bearer",

    }

@app.post(

    "/auth/login",

    response_model=TokenResponse,

)

def login(

    request: LoginRequest,

):

    email = request.email.strip().lower()

    user = get_user_by_email(email)

    if (

        not user

        or not verify_password(

            request.password,

            user["password_hash"],

        )

    ):

        raise HTTPException(

            status_code=401,

            detail="Invalid email or password",

        )

    if user.get("account_status") != "ACTIVE":

        raise HTTPException(

            status_code=403,

            detail="Account is not active",

        )

    timestamp = now_utc()

    users_collection.update_one(

        {"user_id": user["user_id"]},

        {

            "$set": {

                "last_login_at": timestamp,

                "updated_at": timestamp,

            }

        },

    )

    return {

        "access_token": create_access_token(

            user["user_id"]

        ),

        "token_type": "bearer",

    }

@app.get("/auth/me")

def auth_me(

    current_user: dict = Depends(

        get_current_user

    ),

):

    return public_document(

        current_user

    )

@app.patch("/auth/me")

def update_profile(

    request: ProfileUpdateRequest,

    current_user: dict = Depends(

        get_current_user

    ),

):

    name = request.name.strip()

    users_collection.update_one(

        {"user_id": current_user["user_id"]},

        {

            "$set": {

                "name": name,

                "updated_at": now_utc(),

            }

        },

    )

    updated = users_collection.find_one(

        {"user_id": current_user["user_id"]},

        {

            "_id": 0,

            "password_hash": 0,

            "reset_token_hash": 0,

        },

    )

    return updated

@app.post("/auth/change-password")

def change_password(

    request: ChangePasswordRequest,

    current_user: dict = Depends(

        get_current_user

    ),

):

    stored_user = users_collection.find_one(

        {

            "user_id": current_user["user_id"]

        }

    )

    if (

        not stored_user

        or not verify_password(

            request.current_password,

            stored_user["password_hash"],

        )

    ):

        raise HTTPException(

            status_code=401,

            detail="Current password is incorrect",

        )

    if (

        request.current_password

        == request.new_password

    ):

        raise HTTPException(

            status_code=400,

            detail=(

                "New password must be different "

                "from the current password"

            ),

        )

    timestamp = now_utc()

    users_collection.update_one(

        {

            "user_id": current_user["user_id"]

        },

        {

            "$set": {

                "password_hash": hash_password(

                    request.new_password

                ),

                "updated_at": timestamp,

                "password_changed_at": timestamp,

            }

        },

    )

    return {

        "message": "Password changed successfully"

    }

@app.post("/auth/forgot-password")

def forgot_password(

    request: ForgotPasswordRequest,

):

    """

    Generic response prevents email enumeration.

    """

    user = get_user_by_email(

        str(request.email)

    )

    if user:

        raw_token = secrets.token_urlsafe(

            48

        )

        token_hash = hashlib.sha256(

            raw_token.encode("utf-8")

        ).hexdigest()

        expires_at = (

            now_utc()

            + timedelta(

                minutes=RESET_TOKEN_MINUTES

            )

        )

        users_collection.update_one(

            {

                "user_id": user["user_id"]

            },

            {

                "$set": {

                    "reset_token_hash": token_hash,

                    "reset_token_expires_at": expires_at,

                    "updated_at": now_utc(),

                }

            },

        )

        try:

            send_reset_email(

                user["email"],

                raw_token,

            )

        except Exception:

            pass

    return {

        "message": (

            "If an account exists for this email, "

            "a password reset link has been sent."

        )

    }

@app.post("/auth/reset-password")

def reset_password(

    request: ResetPasswordRequest,

):

    token_hash = hashlib.sha256(

        request.token.encode("utf-8")

    ).hexdigest()

    user = users_collection.find_one(

        {

            "reset_token_hash": token_hash,

            "reset_token_expires_at": {

                "$gt": now_utc()

            },

        }

    )

    if not user:

        raise HTTPException(

            status_code=400,

            detail="Invalid or expired reset token",

        )

    timestamp = now_utc()

    users_collection.update_one(

        {

            "user_id": user["user_id"]

        },

        {

            "$set": {

                "password_hash": hash_password(

                    request.new_password

                ),

                "updated_at": timestamp,

                "password_changed_at": timestamp,

            },

            "$unset": {

                "reset_token_hash": "",

                "reset_token_expires_at": "",

            },

        },

    )

    return {

        "message": "Password reset successfully"

    }

@app.get("/")

def home():

    return {

        "name": "VELOOP Rewards API",

        "version": APP_VERSION,

        "status": "running",

        "docs": "/docs",

    }

@app.get("/health")

def health():

    from backend.database import db
    try:

        db.command("ping")

    except Exception:

        raise HTTPException(

            status_code=503,

            detail="Database unavailable",

        )

    return {

        "status": "healthy",

        "database": "connected",

        "version": APP_VERSION,

        "timestamp": now_utc(),

    }

@app.on_event("startup")
def initialize_payout_configuration():
    """Seed missing payout methods and migrate only the exact incorrect defaults from the prior release."""
    previous_release_default_denominations = {
        (10, 1000),
        (25, 2500),
        (50, 5000),
        (100, 10000),
        (150, 15000),
        (300, 30000),
        (500, 50000),
        (1000, 100000),
    }
    migratable_methods = {
        "upi", "bank_transfer", "upi_qr",
        "amazon_gift_card", "google_play_gift_card",
    }

    for order, raw in enumerate(PAYOUT_OPTIONS):
        item = dict(raw)
        item["sort_order"] = order
        item["updated_at"] = now_utc()
        payout_options_collection.update_one(
            {"method_id": item["method_id"]},
            {"$setOnInsert": item},
            upsert=True,
        )

        # Migrate only the exact incorrect default table from the previous ZIP. Customized DB config is preserved.
        existing = payout_options_collection.find_one(
            {"method_id": item["method_id"]},
            {"_id": 0, "denominations": 1},
        )
        if existing and item["method_id"] in migratable_methods:
            current_pairs = {
                (int(row.get("payout_value", 0)), int(row.get("required_amount", 0)))
                for row in existing.get("denominations", [])
                if isinstance(row, dict)
            }
            if current_pairs == previous_release_default_denominations:
                payout_options_collection.update_one(
                    {"method_id": item["method_id"]},
                    {"$set": {
                        "denominations": item["denominations"],
                        "updated_at": item["updated_at"],
                    }},
                )

    payout_options_collection.create_index(
        [("method_id", 1)], unique=True, name="unique_payout_method_id"
    )

@app.get("/payout-options")

def get_payout_options():

    options = list(payout_options_collection.find(
        {"active": True}, {"_id": 0}
    ).sort("sort_order", 1))
    return {"currency": "ves", "options": options}

@app.get("/payout-options/{option_id}")

def get_single_payout_option(

    option_id: str,

):

    option = get_payout_option(

        option_id

    )

    return option

def _create_withdrawal(
    user: dict,
    request: WithdrawalRequest,
) -> dict:
    option = get_payout_option(request.payout_option_id)
    denomination = get_payout_denomination(option, request.amount)
    required_ves = int(denomination["required_amount"])
    normalized_details = validate_payout_details(
        request.payout_option_id,
        request.payout_details,
    )

    withdrawal = None
    transaction = None

    try:
        with client.start_session() as session:
            with session.start_transaction():
                # Idempotency is checked inside the transaction so concurrent
                # requests observe a consistent state. The unique database
                # index is the final guard against duplicate request IDs.
                if request.request_id:
                    existing = withdrawals_collection.find_one(
                        {
                            "user_id": user["user_id"],
                            "request_id": request.request_id,
                        },
                        {"_id": 0},
                        session=session,
                    )
                    if existing:
                        same_request = (
                            int(existing.get("payout_value", -1)) == request.amount
                            and existing.get("payout_option_id") == request.payout_option_id
                            and (existing.get("payout_details") or {}) == normalized_details
                        )
                        if not same_request:
                            raise HTTPException(
                                status_code=409,
                                detail="request_id was already used for a different withdrawal payload",
                            )
                        withdrawal = existing
                    else:
                        wallet = wallets_collection.find_one(
                            {"user_id": user["user_id"]},
                            {"_id": 0},
                            session=session,
                        )
                        if not wallet:
                            raise HTTPException(status_code=404, detail="Wallet not found")

                        balance_before = int(wallet.get("ves", 0) or 0)
                        timestamp = now_utc()
                        withdrawal_id = str(uuid4())
                        transaction_id = str(uuid4())
                        balance_after = balance_before - required_ves

                        if balance_before < required_ves:
                            raise HTTPException(status_code=400, detail="Insufficient VEs balance")

                        debit_result = wallets_collection.update_one(
                            {
                                "user_id": user["user_id"],
                                "ves": {"$gte": required_ves},
                            },
                            {
                                "$inc": {"ves": -required_ves},
                                "$set": {"updated_at": timestamp},
                            },
                            session=session,
                        )

                        if debit_result.modified_count != 1:
                            raise HTTPException(status_code=400, detail="Insufficient VEs balance")

                        withdrawal = {
                            "withdrawal_id": withdrawal_id,
                            "request_id": request.request_id,
                            "user_id": user["user_id"],
                            "currency": "ves",
                            "amount": required_ves,
                            "payout_value": request.amount,
                            "payout_option_id": request.payout_option_id,
                            "payout_details": normalized_details,
                            "status": "PENDING",
                            "transaction_id": transaction_id,
                            "failure_reason": None,
                            "created_at": timestamp,
                            "updated_at": timestamp,
                        }

                        transaction = {
                            "transaction_id": transaction_id,
                            "user_id": user["user_id"],
                            "currency": "ves",
                            "type": "WITHDRAWAL",
                            "amount": required_ves,
                            "balance_before": balance_before,
                            "balance_after": balance_after,
                            "source": "withdrawal",
                            "reference_id": withdrawal_id,
                            "status": "PENDING",
                            "description": f"Withdrawal of ₹{request.amount} via {option['name']}",
                            "metadata": {
                                "payout_option_id": request.payout_option_id,
                                "payout_type": option["type"],
                                "payout_value": request.amount,
                                "required_ves": required_ves,
                            },
                            "created_at": timestamp,
                            "updated_at": timestamp,
                        }

                        withdrawals_collection.insert_one(withdrawal, session=session)
                        transactions_collection.insert_one(transaction, session=session)
                else:
                    wallet = wallets_collection.find_one(
                        {"user_id": user["user_id"]},
                        {"_id": 0},
                        session=session,
                    )
                    if not wallet:
                        raise HTTPException(status_code=404, detail="Wallet not found")

                    balance_before = int(wallet.get("ves", 0) or 0)
                    timestamp = now_utc()
                    withdrawal_id = str(uuid4())
                    transaction_id = str(uuid4())
                    balance_after = balance_before - required_ves

                    if balance_before < required_ves:
                        raise HTTPException(status_code=400, detail="Insufficient VEs balance")

                    debit_result = wallets_collection.update_one(
                        {
                            "user_id": user["user_id"],
                            "ves": {"$gte": required_ves},
                        },
                        {
                            "$inc": {"ves": -required_ves},
                            "$set": {"updated_at": timestamp},
                        },
                        session=session,
                    )

                    if debit_result.modified_count != 1:
                        raise HTTPException(status_code=400, detail="Insufficient VEs balance")

                    withdrawal = {
                        "withdrawal_id": withdrawal_id,
                        "request_id": None,
                        "user_id": user["user_id"],
                        "currency": "ves",
                        "amount": required_ves,
                        "payout_value": request.amount,
                        "payout_option_id": request.payout_option_id,
                        "payout_details": normalized_details,
                        "status": "PENDING",
                        "transaction_id": transaction_id,
                        "failure_reason": None,
                        "created_at": timestamp,
                        "updated_at": timestamp,
                    }

                    transaction = {
                        "transaction_id": transaction_id,
                        "user_id": user["user_id"],
                        "currency": "ves",
                        "type": "WITHDRAWAL",
                        "amount": required_ves,
                        "balance_before": balance_before,
                        "balance_after": balance_after,
                        "source": "withdrawal",
                        "reference_id": withdrawal_id,
                        "status": "PENDING",
                        "description": f"Withdrawal of ₹{request.amount} via {option['name']}",
                        "metadata": {
                            "payout_option_id": request.payout_option_id,
                            "payout_type": option["type"],
                            "payout_value": request.amount,
                            "required_ves": required_ves,
                        },
                        "created_at": timestamp,
                        "updated_at": timestamp,
                    }

                    withdrawals_collection.insert_one(withdrawal, session=session)
                    transactions_collection.insert_one(transaction, session=session)
   
    except DuplicateKeyError:
        # Another concurrent request may have used this idempotency key.
        if request.request_id:
            existing = withdrawals_collection.find_one(
                {
                    "user_id": user["user_id"],
                    "request_id": request.request_id,
                },
                {"_id": 0},
            )
            if existing:
                same_request = (
                    int(existing.get("payout_value", -1)) == request.amount
                    and existing.get("payout_option_id") == request.payout_option_id
                    and (existing.get("payout_details") or {}) == normalized_details
                )
                if same_request:
                    return sanitize_withdrawal(existing)

                raise HTTPException(
                    status_code=409,
                    detail="request_id was already used for a different withdrawal payload",
                )

        raise HTTPException(status_code=409, detail="Duplicate withdrawal request")


    if withdrawal is None:
        raise HTTPException(status_code=500, detail="Withdrawal could not be created")

    withdrawal.pop("_id", None)

    if transaction is not None:
        transaction.pop("_id", None)
        write_audit(
            user["user_id"],
            "WITHDRAWAL_CREATED",
            {
                "withdrawal_id": withdrawal["withdrawal_id"],
                "payout_value": request.amount,
                "required_ves": required_ves,
                "payout_option_id": request.payout_option_id,
            },
        )

    return sanitize_withdrawal(withdrawal)

@app.get("/rewards/config")

def get_reward_config():

    return {

        "daily_rewards": DAILY_REWARDS,

        "conversion_rates": CONVERSION_RATES,

    }

@app.get("/rewards/daily")

def get_daily_reward_status(current_user: dict = Depends(get_current_user)):

    return get_daily_status(current_user["user_id"])

@app.post("/rewards/daily/claim")

def claim_my_daily_reward(current_user: dict = Depends(get_current_user)):

    result = claim_daily_reward(current_user["user_id"])

    if not result.get("already_claimed"):

        write_audit(

            current_user["user_id"],

            "DAILY_REWARD_CLAIM",

            {"day": result.get("claim", {}).get("day")},

        )

    return result

@app.post("/rewards/convert")
def convert_my_reward(
    request: ConversionRequest,
    current_user: dict = Depends(get_current_user),
):
    return convert_reward_to_ves(
        current_user["user_id"],
        request.currency,
        request.amount,
    )

@app.get("/wallet/me")

def get_my_wallet(

    current_user: dict = Depends(

        get_current_user

    ),

):

    return public_document(

        get_user_wallet(

            current_user["user_id"]

        )

    )
class AdminRewardCreditRequest(BaseModel):

    email: EmailStr

    sves: int = Field(default=0, ge=0)

    gems: int = Field(default=0, ge=0)

    tokens: int = Field(default=0, ge=0)

    description: str = Field(

        default="Manual reward credit",

        max_length=200,

    )

class AdminPasswordResetRequest(BaseModel):

    email: EmailStr

    new_password: str = Field(min_length=8, max_length=128)

    admin_secret: str = Field(min_length=16, max_length=256)

@app.post("/admin/auth/reset-password")

def admin_reset_password(

    request: AdminPasswordResetRequest,

):

    admin_secret = os.getenv("ADMIN_RESET_SECRET", "").strip()

    if not admin_secret:

        raise HTTPException(

            status_code=503,

            detail="Password reset maintenance is not configured",

        )

    if not secrets.compare_digest(

        request.admin_secret,

        admin_secret,

    ):

        raise HTTPException(

            status_code=403,

            detail="Invalid admin reset secret",

        )

    email = request.email.strip().lower()

    user = users_collection.find_one(

        {"email": email},

        {"_id": 0},

    )

    if not user:

        raise HTTPException(

            status_code=404,

            detail="User not found",

        )

    result = users_collection.update_one(

        {"user_id": user["user_id"]},

        {

            "$set": {

                "password_hash": hash_password(

                    request.new_password

                ),

                "updated_at": now_utc(),

                "password_changed_at": now_utc(),

            }

        },

    )

    if result.modified_count != 1:

        raise HTTPException(

            status_code=500,

            detail="Password update failed",

        )

    return {

        "message": "Password reset successfully",

        "email": email,

    }

@app.post("/admin/rewards/credit")

def admin_reward_credit(

    request: AdminRewardCreditRequest,
    x_admin_key: str = Header(default="", alias="X-Admin-Key"),

):

    configured_key = os.getenv("ADMIN_REWARD_KEY", "").strip()
    if not configured_key:
        raise HTTPException(status_code=503, detail="Reward administration is not configured")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, configured_key):
        raise HTTPException(status_code=403, detail="Invalid admin key")

    user = users_collection.find_one(

        {"email": request.email.lower().strip()},

        {"_id": 0},

    )

    if not user:

        raise HTTPException(

            status_code=404,

            detail="User not found",

        )

    try:

        credits = {

    "sves": request.sves,

    "gems": request.gems,

    "tokens": request.tokens,

}

        credits = {

            currency: amount

            for currency, amount in credits.items()

            if amount > 0

        }

        if not credits:

            raise HTTPException(

                status_code=400,

                detail="At least one reward amount must be greater than zero",

            )

        results = []

        for currency, amount in credits.items():

            results.append(

                credit_wallet(

                    user_id=user["user_id"],

                    currency=currency,

                    amount=amount,

                    source="ADMIN_REWARD",

                    description=request.description,

                    transaction_type="REWARD",

                )

            )

        return {

            "message": "Rewards credited successfully",

            "email": str(request.email).lower().strip(),

            "credits": credits,

            "transactions": results,

        }

    except HTTPException:

        raise

    except Exception as exc:

        print(

            "ADMIN REWARD CREDIT ERROR:",

            type(exc).__name__,

            str(exc),

        )

        raise HTTPException(

            status_code=500,

            detail="Reward credit failed",

        )

@app.get("/wallet/me/transactions")

def get_my_transactions(

    current_user: dict = Depends(

        get_current_user

    ),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),

):

    result = get_transactions(
        current_user["user_id"],
        page=page,
        limit=limit,
    )

    return {
        "user_id": current_user["user_id"],
        "count": len(result["transactions"]),
        **result,
    }

@app.post("/wallet/me/withdrawal")

def create_my_withdrawal(

    request: WithdrawalRequest,

    current_user: dict = Depends(

        get_current_user

    ),

):

    return _create_withdrawal(

        current_user,

        request,

    )

@app.get("/wallet/me/withdrawals")

def get_my_withdrawals(

    current_user: dict = Depends(

        get_current_user

    ),

):

    withdrawals = list(

        withdrawals_collection.find(

            {

                "user_id": current_user[

                    "user_id"

                ]

            },

            {

                "_id": 0

            },

        ).sort(

            "created_at",

            -1,

        )

    )

    return {

        "user_id": current_user[

            "user_id"

        ],

        "count": len(withdrawals),

        "withdrawals": [

            sanitize_withdrawal(item)

            for item in withdrawals

        ],

    }


@app.patch("/admin/withdrawals/{withdrawal_id}/status")
def update_withdrawal_status(
    withdrawal_id: str,
    request: WithdrawalStatusUpdateRequest,
    x_admin_key: str = Header(default="", alias="X-Admin-Key"),
):
    """Admin-only review action; rejection refunds the reserved VEs atomically."""
    configured_key = os.getenv("ADMIN_WITHDRAWAL_KEY", "").strip()
    if not configured_key:
        raise HTTPException(status_code=503, detail="Withdrawal administration is not configured")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, configured_key):
        raise HTTPException(status_code=403, detail="Invalid admin key")
    target_status = request.status.upper()
    if target_status == "REJECTED" and not (request.rejection_reason or "").strip():
        raise HTTPException(status_code=422, detail="rejection_reason is required when rejecting a withdrawal")

    timestamp = now_utc()
    result_document = None
    try:
        with client.start_session() as session:
            with session.start_transaction():
                withdrawal = withdrawals_collection.find_one(
                    {"withdrawal_id": withdrawal_id}, session=session
                )
                if not withdrawal:
                    raise HTTPException(status_code=404, detail="Withdrawal not found")
                current_status = str(withdrawal.get("status", "")).upper()
                if current_status not in {"PENDING", "PROCESSING"}:
                    if current_status == target_status:
                        result_document = withdrawal
                    else:
                        raise HTTPException(status_code=409, detail=f"Cannot change withdrawal from {current_status} to {target_status}")
                else:
                    update_fields = {
                        "status": target_status,
                        "updated_at": timestamp,
                        "review_note": request.review_note,
                    }
                    if target_status == "REJECTED":
                        update_fields["failure_reason"] = request.rejection_reason.strip()
                    if target_status == "APPROVED" and request.transaction_id:
                        update_fields["payout_transaction_id"] = request.transaction_id
                    if target_status == "REJECTED":
                        user_id = withdrawal["user_id"]
                        amount = int(withdrawal["amount"])
                        wallet = wallets_collection.find_one({"user_id": user_id}, session=session)
                        if not wallet:
                            raise HTTPException(status_code=404, detail="Wallet not found for refund")
                        before = int(wallet.get("ves", 0) or 0)
                        wallets_collection.update_one(
                            {"user_id": user_id},
                            {"$inc": {"ves": amount}, "$set": {"updated_at": timestamp}},
                            session=session,
                        )
                        refund = {
                            "transaction_id": str(uuid4()), "user_id": user_id,
                            "currency": "ves", "type": "WITHDRAWAL_REFUND", "amount": amount,
                            "balance_before": before, "balance_after": before + amount,
                            "source": "withdrawal_rejection", "reference_id": withdrawal_id,
                            "status": "COMPLETED", "description": f"Refund for rejected withdrawal {withdrawal_id}",
                            "metadata": {"reason": request.rejection_reason.strip()},
                            "created_at": timestamp, "updated_at": timestamp,
                        }
                        transactions_collection.insert_one(refund, session=session)
                        update_fields["refund_transaction_id"] = refund["transaction_id"]
                    updated = withdrawals_collection.find_one_and_update(
                        {"withdrawal_id": withdrawal_id, "status": current_status},
                        {"$set": update_fields},
                        return_document=ReturnDocument.AFTER,
                        session=session,
                    )
                    if not updated:
                        raise HTTPException(status_code=409, detail="Withdrawal status changed concurrently")
                    result_document = updated
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Withdrawal status update conflict")

    write_audit(withdrawal.get("user_id", "system"), "WITHDRAWAL_STATUS_UPDATED", {
        "withdrawal_id": withdrawal_id, "status": target_status
    })
    return sanitize_withdrawal(result_document or {})
