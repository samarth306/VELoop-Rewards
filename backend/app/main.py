import hashlib

import os

import secrets

import smtplib

from datetime import datetime, timedelta, timezone

from email.message import EmailMessage

from typing import Any, Optional

from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException

from fastapi.middleware.cors import CORSMiddleware

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from pydantic import BaseModel, EmailStr, Field
from pymongo import ReturnDocument
from backend.database import client
from backend.app.collections import (

    users_collection,

    wallets_collection,

    transactions_collection,

    withdrawals_collection,

)

from backend.app.wallet_service import credit_wallet

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

    claim_daily_reward,

    get_daily_status,

)

from backend.app import collections as app_collections

audit_logs_collection = getattr(app_collections, "audit_logs_collection", None)

APP_VERSION = "2.3.0"

MIN_WITHDRAWAL_VES = 100

RESET_TOKEN_MINUTES = 30

ALLOWED_CURRENCIES = {

    "ves",

    "sves",

    "gems",

    "tokens",

    "spins",

}

PAYOUT_OPTIONS = [

    {

        "method_id": "upi",

        "name": "UPI",

        "type": "UPI",

        "currency": "ves",

        "active": True,

        "denominations": [

            {"payout_value": 10, "required_amount": 1000},

            {"payout_value": 25, "required_amount": 2500},

            {"payout_value": 50, "required_amount": 5000},

            {"payout_value": 100, "required_amount": 10000},

            {"payout_value": 150, "required_amount": 15000},

            {"payout_value": 300, "required_amount": 30000},

            {"payout_value": 500, "required_amount": 50000},

            {"payout_value": 1000, "required_amount": 100000},

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

            {"payout_value": 10, "required_amount": 1000},

            {"payout_value": 25, "required_amount": 2500},

            {"payout_value": 50, "required_amount": 5000},

            {"payout_value": 100, "required_amount": 10000},

            {"payout_value": 150, "required_amount": 15000},

            {"payout_value": 300, "required_amount": 30000},

            {"payout_value": 500, "required_amount": 50000},

            {"payout_value": 1000, "required_amount": 100000},

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

            {"payout_value": 10, "required_amount": 1000},

            {"payout_value": 25, "required_amount": 2500},

            {"payout_value": 50, "required_amount": 5000},

            {"payout_value": 100, "required_amount": 10000},

            {"payout_value": 150, "required_amount": 15000},

            {"payout_value": 300, "required_amount": 30000},

            {"payout_value": 500, "required_amount": 50000},

            {"payout_value": 1000, "required_amount": 100000},

        ],

        "description": "UPI QR payout using VEs.",

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

    "http://127.0.0.1:5173",

    "http://127.0.0.1:5174",

    "http://127.0.0.1:5175",

    "http://127.0.0.1:5176",

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

def now_utc() -> datetime:

    return datetime.now(timezone.utc)

def public_document(document: Optional[dict]) -> dict:

    if not document:

        return {}

    result = dict(document)

    result.pop("_id", None)

    result.pop("password_hash", None)

    result.pop("reset_token_hash", None)

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

    except Exception:

        pass

def get_payout_option(option_id: str) -> dict:

    """

    Find an active payout method.

    The backend owns this configuration.

    """

    for option in PAYOUT_OPTIONS:

        if (

            option["method_id"] == option_id

            and option.get("active", False)

        ):

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

        ₹10 -> 1000 VEs

        ₹100 -> 10000 VEs

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

        if key in {"account_number", "upi_id"}:

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

class TransactionRequest(BaseModel):

    currency: str = Field(

        min_length=1,

        max_length=20,

    )

    amount: int = Field(

        gt=0,

    )

    source: str = Field(

        min_length=1,

        max_length=80,

    )

    description: str = Field(

        default="",

        max_length=250,

    )

class WithdrawalRequest(BaseModel):

    amount: int = Field(

        gt=0,

    )

    payout_option_id: str = Field(

        min_length=1,

        max_length=50,

    )

    payout_details: dict

    request_id: Optional[str] = Field(

        default=None,

        max_length=100,

    )

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

class ResetPasswordRequest(BaseModel):

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

        "spins": 0,

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

@app.get("/payout-options")

def get_payout_options():

    return {

        "currency": "ves",

        "options": PAYOUT_OPTIONS,

    }

@app.get("/payout-options/{option_id}")

def get_single_payout_option(

    option_id: str,

):

    option = get_payout_option(

        option_id

    )

    return option

@app.get("/wallet/demo")

def get_demo_wallet():

    user = users_collection.find_one(

        {"email": "demo@veloop.test"},

        {"_id": 0},

    )

    if not user:

        raise HTTPException(

            status_code=404,

            detail="Demo user not found",

        )

    wallet = wallets_collection.find_one(

        {"user_id": user["user_id"]},

        {"_id": 0},

    )

    if not wallet:

        raise HTTPException(

            status_code=404,

            detail="Wallet not found",

        )

    return wallet

@app.post("/wallet/demo/transaction")

def create_demo_transaction(

    request: TransactionRequest,

):

    user = users_collection.find_one(

        {"email": "demo@veloop.test"},

        {"_id": 0},

    )

    if not user:

        raise HTTPException(

            status_code=404,

            detail="Demo user not found",

        )

    currency = validate_currency(

        request.currency

    )

    wallet = get_user_wallet(

        user["user_id"]

    )

    balance_before = int(

        wallet.get(currency, 0)

    )

    balance_after = (

        balance_before

        + request.amount

    )

    result = wallets_collection.update_one(

        {

            "user_id": user["user_id"]

        },

        {

            "$inc": {

                currency: request.amount

            },

            "$set": {

                "updated_at": now_utc()

            },

        },

    )

    if result.modified_count != 1:

        raise HTTPException(

            status_code=500,

            detail="Unable to update demo wallet",

        )

    return create_wallet_transaction(

        user_id=user["user_id"],

        transaction_type="REWARD",

        amount=request.amount,

        balance_before=balance_before,

        balance_after=balance_after,

        source=request.source,

        reference_id=None,

        status="COMPLETED",

        description=request.description,

        metadata={

            "demo": True

        },

    )

@app.get("/wallet/demo/transactions")

def get_demo_transactions():

    user = users_collection.find_one(

        {"email": "demo@veloop.test"},

        {"_id": 0},

    )

    if not user:

        raise HTTPException(

            status_code=404,

            detail="Demo user not found",

        )

    transactions = list(

        transactions_collection.find(

            {

                "user_id": user["user_id"]

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

        "user_id": user["user_id"],

        "count": len(transactions),

        "transactions": transactions,

    }

def _create_withdrawal(

    user: dict,

    request: WithdrawalRequest,

) -> dict:

    option = get_payout_option(

        request.payout_option_id

    )

    denomination = get_payout_denomination(

        option,

        request.amount,

    )

    required_ves = int(

        denomination["required_amount"]

    )

    normalized_details = (

        validate_payout_details(

            request.payout_option_id,

            request.payout_details,

        )

    )

    if request.request_id:

        existing = withdrawals_collection.find_one(

            {

                "user_id": user["user_id"],

                "request_id": request.request_id,

            }

        )

        if existing:

            return sanitize_withdrawal(

                existing

            )

    wallet = get_user_wallet(

        user["user_id"]

    )

    balance_before = int(

        wallet.get("ves", 0)

    )

    result = wallets_collection.update_one(

        {

            "user_id": user["user_id"],

            "ves": {

                "$gte": required_ves

            },

        },

        {

            "$inc": {

                "ves": -required_ves

            },

            "$set": {

                "updated_at": now_utc()

            },

        },

    )

    if result.modified_count != 1:

        raise HTTPException(

            status_code=400,

            detail="Insufficient VEs balance",

        )

    balance_after = (

        balance_before

        - required_ves

    )

    withdrawal_id = str(

        uuid4()

    )

    transaction_id = str(

        uuid4()

    )

    timestamp = now_utc()

    withdrawal = {

        "withdrawal_id": withdrawal_id,

        "request_id": request.request_id,

        "user_id": user["user_id"],

        "currency": "ves",

        "amount": required_ves,

        "payout_value": request.amount,

        "payout_option_id": (

            request.payout_option_id

        ),

        "payout_details": (

            normalized_details

        ),

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

        "description": (

            f"Withdrawal of ₹{request.amount} "

            f"via {option['name']}"

        ),

        "metadata": {

            "payout_option_id": (

                request.payout_option_id

            ),

            "payout_type": option["type"],

            "payout_value": request.amount,

            "required_ves": required_ves,

        },

        "created_at": timestamp,

        "updated_at": timestamp,

    }

    try:

        withdrawals_collection.insert_one(

            withdrawal

        )

        transactions_collection.insert_one(

            transaction

        )

    except Exception:

        wallets_collection.update_one(

            {

                "user_id": user["user_id"]

            },

            {

                "$inc": {

                    "ves": required_ves

                },

                "$set": {

                    "updated_at": now_utc()

                },

            },

        )

        withdrawals_collection.delete_one(

            {

                "withdrawal_id": withdrawal_id

            }

        )

        transactions_collection.delete_one(

            {

                "transaction_id": transaction_id

            }

        )

        raise HTTPException(

            status_code=500,

            detail=(

                "Withdrawal could not be created; "

                "balance has been restored"

            ),

        )

    write_audit(

        user["user_id"],

        "WITHDRAWAL_CREATED",

        {

            "withdrawal_id": withdrawal_id,

            "payout_value": request.amount,

            "required_ves": required_ves,

            "payout_option_id": request.payout_option_id,

        },

    )

    return sanitize_withdrawal(withdrawal)

@app.post("/wallet/demo/withdrawal")

def create_demo_withdrawal(

    request: WithdrawalRequest,

):

    user = users_collection.find_one(

        {"email": "demo@veloop.test"},

        {"_id": 0},

    )

    if not user:

        raise HTTPException(

            status_code=404,

            detail="Demo user not found",

        )

    return _create_withdrawal(

        user,

        request,

    )

@app.get("/wallet/demo/withdrawals")

def get_demo_withdrawals():

    user = users_collection.find_one(

        {"email": "demo@veloop.test"},

        {"_id": 0},

    )

    if not user:

        raise HTTPException(

            status_code=404,

            detail="Demo user not found",

        )

    withdrawals = list(

        withdrawals_collection.find(

            {

                "user_id": user["user_id"]

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

        "user_id": user["user_id"],

        "count": len(withdrawals),

        "withdrawals": [

            sanitize_withdrawal(item)

            for item in withdrawals

        ],

    }

@app.get("/rewards/config")

def get_reward_config():

    return {

        "daily_rewards": DAILY_REWARDS,

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

CONVERSION_RATES = {
    "sves": 500,
    "tokens": 2000,
    "gems": 5000,
}


@app.post("/rewards/convert")
def convert_my_reward(
    request: ConversionRequest,
    current_user: dict = Depends(get_current_user),
):
    currency = request.currency.lower().strip()
    amount = int(request.amount)

    if currency not in CONVERSION_RATES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported conversion currency",
        )

    if amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Conversion amount must be greater than zero",
        )

    rate = CONVERSION_RATES[currency]
    converted_ves = amount * rate
    user_id = current_user["user_id"]
    now = datetime.now(timezone.utc)

    with client.start_session() as session:
        with session.start_transaction():
            wallet = wallets_collection.find_one(
                {"user_id": user_id},
                session=session,
            )

            if not wallet:
                raise HTTPException(
                    status_code=404,
                    detail="Wallet not found",
                )

            current_balance = int(wallet.get(currency, 0) or 0)

            if current_balance < amount:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient {currency.upper()} balance",
                )

            result = wallets_collection.update_one(
                {
                    "user_id": user_id,
                    currency: {"$gte": amount},
                },
                {
                    "$inc": {
                        currency: -amount,
                        "ves": converted_ves,
                    },
                    "$set": {
                        "updated_at": now,
                    },
                },
                session=session,
            )

            if result.modified_count != 1:
                raise HTTPException(
                    status_code=409,
                    detail="Wallet changed during conversion. Please try again.",
                )

            transaction = {
                "transaction_id": str(uuid4()),
                "user_id": user_id,
                "currency": currency,
                "type": "CONVERSION",
                "amount": amount,
                "converted_ves": converted_ves,
                "conversion_rate": rate,
                "balance_before": current_balance,
                "balance_after": current_balance - amount,
                "ves_credit": converted_ves,
                "status": "COMPLETED",
                "source": "REWARD_CONVERSION",
                "description": (
                    f"Converted {amount} {currency.upper()} "
                    f"to {converted_ves:,} VEs"
                ),
                "created_at": now,
                "updated_at": now,
            }

            transactions_collection.insert_one(
                transaction,
                session=session,
            )

    return {
        "success": True,
        "currency": currency,
        "amount": amount,
        "conversion_rate": rate,
        "converted_ves": converted_ves,
        "message": (
            f"{amount:,} {currency.upper()} converted "
            f"to {converted_ves:,} VEs successfully"
        ),
    }

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
class ConversionRequest(BaseModel):
    currency: str = Field(..., pattern="^(sves|gems|tokens)$")
    amount: int = Field(..., gt=0)
    
class AdminRewardCreditRequest(BaseModel):

    email: EmailStr

    sves: int = Field(default=0, ge=0)

    gems: int = Field(default=0, ge=0)

    tokens: int = Field(default=0, ge=0)

    spins: int = Field(default=0, ge=0)

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

):

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

    "spins": request.spins,

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

):

    transactions = list(

        transactions_collection.find(

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

        "count": len(transactions),

        "transactions": transactions,

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
