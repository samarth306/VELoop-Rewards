from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException

from backend.app.database import client
from backend.app.collections import (
    wallets_collection,
    transactions_collection,
)

SUPPORTED_CURRENCIES = {
    "ves",
    "sves",
    "gems",
    "tokens",
    "spins",
}


def validate_currency(currency: str) -> str:
    currency = currency.lower().strip()

    if currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported currency: {currency}",
        )

    return currency


def get_wallet(user_id: str) -> dict:
    wallet = wallets_collection.find_one(
        {"user_id": user_id},
        {"_id": 0},
    )

    if not wallet:
        raise HTTPException(
            status_code=404,
            detail="Wallet not found",
        )

    return wallet


def credit_wallet(
    user_id: str,
    currency: str,
    amount: int,
    source: str,
    description: str = "",
    reference_id: str | None = None,
    transaction_type: str = "REWARD",
) -> dict:

    currency = validate_currency(currency)

    if amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Credit amount must be greater than zero",
        )

    now = datetime.now(timezone.utc)

    # Wallet update and ledger entry are committed together.
    # If either operation fails, MongoDB rolls back the transaction.
    with client.start_session() as session:
        with session.start_transaction():

            wallet = wallets_collection.find_one(
                {"user_id": user_id},
                {"_id": 0},
                session=session,
            )

            if not wallet:
                raise HTTPException(
                    status_code=404,
                    detail="Wallet not found",
                )

            balance_before = int(wallet.get(currency, 0))
            balance_after = balance_before + amount

            result = wallets_collection.update_one(
                {"user_id": user_id},
                {
                    "$inc": {currency: amount},
                    "$set": {"updated_at": now},
                },
                session=session,
            )

            if result.modified_count != 1:
                raise HTTPException(
                    status_code=500,
                    detail="Wallet credit failed",
                )

            transaction = {
                "transaction_id": str(uuid4()),
                "user_id": user_id,
                "currency": currency,
                "type": transaction_type,
                "amount": amount,
                "balance_before": balance_before,
                "balance_after": balance_after,
                "source": source,
                "reference_id": reference_id,
                "status": "COMPLETED",
                "description": description,
                "metadata": {},
                "created_at": now,
                "updated_at": now,
            }

            transactions_collection.insert_one(
                transaction,
                session=session,
            )

    transaction.pop("_id", None)

    return transaction

def debit_wallet(
    user_id: str,
    currency: str,
    amount: int,
    source: str,
    description: str = "",
    reference_id: str | None = None,
    transaction_type: str = "ADMIN_DEBIT",
) -> dict:

    currency = validate_currency(currency)

    if amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Debit amount must be greater than zero",
        )

    now = datetime.now(timezone.utc)

    # Wallet debit and ledger entry are committed together.
    # The balance condition is part of the database update itself,
    # protecting against concurrent withdrawals/debits.
    with client.start_session() as session:
        with session.start_transaction():

            wallet = wallets_collection.find_one(
                {"user_id": user_id},
                {"_id": 0},
                session=session,
            )

            if not wallet:
                raise HTTPException(
                    status_code=404,
                    detail="Wallet not found",
                )

            balance_before = int(wallet.get(currency, 0))

            if balance_before < amount:
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
                    "$inc": {currency: -amount},
                    "$set": {"updated_at": now},
                },
                session=session,
            )

            if result.modified_count != 1:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient {currency.upper()} balance",
                )

            balance_after = balance_before - amount

            transaction = {
                "transaction_id": str(uuid4()),
                "user_id": user_id,
                "currency": currency,
                "type": transaction_type,
                "amount": amount,
                "balance_before": balance_before,
                "balance_after": balance_after,
                "source": source,
                "reference_id": reference_id,
                "status": "COMPLETED",
                "description": description,
                "metadata": {},
                "created_at": now,
                "updated_at": now,
            }

            transactions_collection.insert_one(
                transaction,
                session=session,
            )

    transaction.pop("_id", None)

    return transaction

def get_transactions(
    user_id: str,
    page: int = 1,
    limit: int = 20,
) -> dict:

    if page < 1:
        raise HTTPException(
            status_code=400,
            detail="Page must be greater than or equal to 1",
        )

    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=400,
            detail="Limit must be between 1 and 100",
        )

    skip = (page - 1) * limit

    query = {"user_id": user_id}

    total = transactions_collection.count_documents(query)

    transactions = list(
        transactions_collection.find(
            query,
            {"_id": 0},
        )
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    total_pages = (total + limit - 1) // limit if total else 0

    return {
        "transactions": transactions,
        "page": page,
        "limit": limit,
        "total_elements": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_previous": page > 1,
    }
