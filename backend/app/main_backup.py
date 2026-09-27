from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from uuid import uuid4

from backend.app.collections import (
    users_collection,
    wallets_collection,
    transactions_collection,
    withdrawals_collection,
)

from backend.app.models.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
)

from backend.app.auth_service import (
    hash_password,
    verify_password,
)
from backend.app.jwt_service import create_access_token, decode_access_token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


app = FastAPI(title="VELOOP Rewards API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.post("/auth/register", response_model=TokenResponse)
def register(request: RegisterRequest):
    existing_user = users_collection.find_one(
        {"email": request.email.lower()}
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    user_id = str(uuid4())
    wallet_id = str(uuid4())

    password_hash = hash_password(request.password)

    user = {
        "user_id": user_id,
        "email": request.email.lower(),
        "name": request.name,
        "password_hash": password_hash,
        "account_status": "ACTIVE",
        "wallet_id": wallet_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    wallet = {
        "wallet_id": wallet_id,
        "user_id": user_id,
        "ves": 0,
        "sves": 0,
        "gems": 0,
        "tokens": 0,
        "spins": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    users_collection.insert_one(user)
    wallets_collection.insert_one(wallet)

    access_token = create_access_token(user_id)

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
@app.post("/auth/login", response_model=TokenResponse)
def login(request: LoginRequest):
    user = users_collection.find_one(
        {"email": request.email.lower()}
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        request.password,
        user["password_hash"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if user.get("account_status") != "ACTIVE":
        raise HTTPException(
            status_code=403,
            detail="Account is not active"
        )

    access_token = create_access_token(
        user["user_id"]
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

# =========================
# REQUEST MODELS
# =========================

class TransactionRequest(BaseModel):
    currency: str
    amount: int = Field(gt=0)
    source: str
    description: str = ""


class WithdrawalRequest(BaseModel):
    amount: int = Field(gt=0)
    payout_option_id: str
    payout_details: dict


# =========================
# BASIC ENDPOINTS
# =========================

@app.get("/")
def home():
    return {
        "message": "VELOOP Rewards API is running successfully"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "database": "connected"
    }


# =========================
# DEMO WALLET
# =========================

@app.get("/wallet/demo")
def get_demo_wallet():

    user = users_collection.find_one(
        {"email": "demo@veloop.test"},
        {"_id": 0}
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Demo user not found"
        )

    wallet = wallets_collection.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0}
    )

    if not wallet:
        raise HTTPException(
            status_code=404,
            detail="Wallet not found"
        )

    return wallet


# =========================
# PAYOUT OPTIONS
# =========================

@app.get("/payout-options")
def get_payout_options():

    return {
        "options": [
            {
                "method_id": "demo_upi",
                "name": "Demo UPI",
                "type": "UPI",
                "currency": "ves",
                "payout_value": 1,
                "required_amount": 100,
                "active": True
            },
            {
                "method_id": "demo_bank",
                "name": "Demo Bank Transfer",
                "type": "BANK_TRANSFER",
                "currency": "ves",
                "payout_value": 1,
                "required_amount": 500,
                "active": True
            }
        ]
    }


# =========================
# CREATE DEMO TRANSACTION
# =========================

@app.post("/wallet/demo/transaction")
def create_demo_transaction(
    request: TransactionRequest
):

    user = users_collection.find_one(
        {"email": "demo@veloop.test"},
        {"_id": 0}
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Demo user not found"
        )

    wallet = wallets_collection.find_one(
        {"user_id": user["user_id"]}
    )

    if not wallet:
        raise HTTPException(
            status_code=404,
            detail="Wallet not found"
        )

    currency = request.currency.lower()

    if currency not in [
        "ves",
        "sves",
        "gems",
        "tokens",
        "spins"
    ]:
        raise HTTPException(
            status_code=400,
            detail="Invalid currency"
        )

    balance_before = wallet.get(currency, 0)
    balance_after = balance_before + request.amount

    wallets_collection.update_one(
        {"user_id": user["user_id"]},
        {
            "$inc": {
                currency: request.amount
            },
            "$set": {
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    transaction = {
        "transaction_id": str(uuid4()),
        "user_id": user["user_id"],
        "currency": currency,
        "type": "REWARD",
        "amount": request.amount,
        "balance_before": balance_before,
        "balance_after": balance_after,
        "source": request.source,
        "reference_id": None,
        "status": "COMPLETED",
        "description": request.description,
        "metadata": {},
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    transactions_collection.insert_one(transaction)

    transaction.pop("_id", None)

    return transaction


# =========================
# GET DEMO TRANSACTIONS
# =========================

@app.get("/wallet/demo/transactions")
def get_demo_transactions():

    user = users_collection.find_one(
        {"email": "demo@veloop.test"},
        {"_id": 0}
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Demo user not found"
        )

    transactions = list(
        transactions_collection.find(
            {"user_id": user["user_id"]},
            {"_id": 0}
        ).sort("created_at", -1)
    )

    return {
        "user_id": user["user_id"],
        "count": len(transactions),
        "transactions": transactions
    }


# =========================
# CREATE DEMO WITHDRAWAL
# =========================

@app.post("/wallet/demo/withdrawal")
def create_demo_withdrawal(
    request: WithdrawalRequest
):

    user = users_collection.find_one(
        {"email": "demo@veloop.test"},
        {"_id": 0}
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Demo user not found"
        )

    if request.payout_option_id not in [
        "demo_upi",
        "demo_bank"
    ]:
        raise HTTPException(
            status_code=400,
            detail="Invalid payout option"
        )

    if request.amount < 100:
        raise HTTPException(
            status_code=400,
            detail="Minimum withdrawal amount is 100 VEs"
        )

    # Atomic balance deduction.
    # This prevents withdrawal when balance is insufficient.
    result = wallets_collection.update_one(
        {
            "user_id": user["user_id"],
            "ves": {
                "$gte": request.amount
            }
        },
        {
            "$inc": {
                "ves": -request.amount
            },
            "$set": {
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=400,
            detail="Insufficient VEs balance"
        )

    withdrawal_id = str(uuid4())

    withdrawal = {
        "withdrawal_id": withdrawal_id,
        "user_id": user["user_id"],
        "currency": "ves",
        "amount": request.amount,
        "payout_option_id": request.payout_option_id,
        "payout_details": request.payout_details,
        "status": "PENDING",
        "transaction_id": None,
        "failure_reason": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    withdrawals_collection.insert_one(withdrawal)

    # Withdrawal transaction
    transaction_id = str(uuid4())

    transaction = {
        "transaction_id": transaction_id,
        "user_id": user["user_id"],
        "currency": "ves",
        "type": "WITHDRAWAL",
        "amount": request.amount,
        "balance_before": None,
        "balance_after": None,
        "source": "withdrawal",
        "reference_id": withdrawal_id,
        "status": "PENDING",
        "description": "Wallet withdrawal",
        "metadata": {
            "payout_option_id": request.payout_option_id
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    transactions_collection.insert_one(transaction)

    withdrawals_collection.update_one(
        {"withdrawal_id": withdrawal_id},
        {
            "$set": {
                "transaction_id": transaction_id,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    withdrawal["transaction_id"] = transaction_id

    withdrawal.pop("_id", None)

    return withdrawal


# =========================
# GET DEMO WITHDRAWALS
# =========================

@app.get("/wallet/demo/withdrawals")
def get_demo_withdrawals():

    user = users_collection.find_one(
        {"email": "demo@veloop.test"},
        {"_id": 0}
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Demo user not found"
        )

    withdrawals = list(
        withdrawals_collection.find(
            {"user_id": user["user_id"]},
            {"_id": 0}
        ).sort("created_at", -1)
    )

    return {
        "user_id": user["user_id"],
        "count": len(withdrawals),
        "withdrawals": withdrawals
    }
    

# =========================
# AUTHENTICATED USER
# =========================

security = HTTPBearer()


@app.get("/auth/me")
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    user = users_collection.find_one(
        {"user_id": user_id},
        {"_id": 0, "password_hash": 0}
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return user

@app.get("/wallet/me")
def get_my_wallet(current_user: dict = Depends(get_current_user)):
    wallet = wallets_collection.find_one(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    )

    if not wallet:
        raise HTTPException(
            status_code=404,
            detail="Wallet not found"
        )

    return wallet
@app.post("/wallet/me/transaction")
def create_my_transaction(
    request: TransactionRequest,
    current_user: dict = Depends(get_current_user)
):
    currency = request.currency.lower()

    if currency not in ["ves", "sves", "gems", "tokens", "spins"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid currency"
        )

    wallet = wallets_collection.find_one(
        {"user_id": current_user["user_id"]}
    )

    if not wallet:
        raise HTTPException(
            status_code=404,
            detail="Wallet not found"
        )

    balance_before = wallet.get(currency, 0)
    balance_after = balance_before + request.amount

    wallets_collection.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$inc": {
                currency: request.amount
            },
            "$set": {
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    transaction = {
        "transaction_id": str(uuid4()),
        "user_id": current_user["user_id"],
        "currency": currency,
        "type": "REWARD",
        "amount": request.amount,
        "balance_before": balance_before,
        "balance_after": balance_after,
        "source": request.source,
        "reference_id": None,
        "status": "COMPLETED",
        "description": request.description,
        "metadata": {},
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    transactions_collection.insert_one(transaction)
    transaction.pop("_id", None)

    return transaction 
@app.get("/wallet/me/transactions")
def get_my_transactions(current_user: dict = Depends(get_current_user)):
    transactions = list(
        transactions_collection.find(
            {"user_id": current_user["user_id"]},
            {"_id": 0}
        ).sort("created_at", -1)
    )

    return {
        "user_id": current_user["user_id"],
        "count": len(transactions),
        "transactions": transactions
    }
@app.post("/wallet/me/withdrawal")
def create_my_withdrawal(
    request: WithdrawalRequest,
    current_user: dict = Depends(get_current_user)
):
    if request.payout_option_id not in [
        "demo_upi",
        "demo_bank"
    ]:
        raise HTTPException(
            status_code=400,
            detail="Invalid payout option"
        )

    if request.amount < 100:
        raise HTTPException(
            status_code=400,
            detail="Minimum withdrawal amount is 100 VEs"
        )

    wallet = wallets_collection.find_one(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    )

    if not wallet:
        raise HTTPException(
            status_code=404,
            detail="Wallet not found"
        )

    balance_before = wallet.get("ves", 0)

    if balance_before < request.amount:
        raise HTTPException(
            status_code=400,
            detail="Insufficient VEs balance"
        )

    result = wallets_collection.update_one(
        {
            "user_id": current_user["user_id"],
            "ves": {"$gte": request.amount}
        },
        {
            "$inc": {"ves": -request.amount},
            "$set": {
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=400,
            detail="Insufficient VEs balance"
        )

    balance_after = balance_before - request.amount

    withdrawal_id = str(uuid4())

    withdrawal = {
        "withdrawal_id": withdrawal_id,
        "user_id": current_user["user_id"],
        "currency": "ves",
        "amount": request.amount,
        "payout_option_id": request.payout_option_id,
        "payout_details": request.payout_details,
        "status": "PENDING",
        "transaction_id": None,
        "failure_reason": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    withdrawals_collection.insert_one(withdrawal)

    transaction_id = str(uuid4())

    transaction = {
        "transaction_id": transaction_id,
        "user_id": current_user["user_id"],
        "currency": "ves",
        "type": "WITHDRAWAL",
        "amount": request.amount,
        "balance_before": balance_before,
        "balance_after": balance_after,
        "source": "withdrawal",
        "reference_id": withdrawal_id,
        "status": "PENDING",
        "description": "Wallet withdrawal",
        "metadata": {
            "payout_option_id": request.payout_option_id
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    transactions_collection.insert_one(transaction)

    withdrawals_collection.update_one(
        {"withdrawal_id": withdrawal_id},
        {
            "$set": {
                "transaction_id": transaction_id,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    withdrawal["transaction_id"] = transaction_id
    withdrawal.pop("_id", None)

    return withdrawal

@app.get("/wallet/me/withdrawals")
def get_my_withdrawals(current_user: dict = Depends(get_current_user)):
    withdrawals = list(
        withdrawals_collection.find(
            {"user_id": current_user["user_id"]},
            {"_id": 0}
        ).sort("created_at", -1)
    )

    return {
        "user_id": current_user["user_id"],
        "count": len(withdrawals),
        "withdrawals": withdrawals
    }
    
    
