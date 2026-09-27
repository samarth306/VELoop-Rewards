from datetime import datetime, timezone
from uuid import uuid4

from backend.app.collections import wallets_collection, transactions_collection


VALID_CURRENCIES = {"ves", "sves", "gems", "tokens", "spins"}


def credit_wallet(user_id: str, currency: str, amount: int, source: str, description: str = ""):
    if currency not in VALID_CURRENCIES:
        raise ValueError("Invalid currency")

    if amount <= 0:
        raise ValueError("Amount must be greater than 0")

    wallet = wallets_collection.find_one({"user_id": user_id})

    if not wallet:
        raise ValueError("Wallet not found")

    balance_before = wallet.get(currency, 0)

    result = wallets_collection.update_one(
        {"user_id": user_id},
        {"$inc": {currency: amount}}
    )

    if result.modified_count != 1:
        raise ValueError("Wallet update failed")

    balance_after = balance_before + amount

    transaction_id = str(uuid4())
    now = datetime.now(timezone.utc)

    transactions_collection.insert_one({
        "transaction_id": transaction_id,
        "user_id": user_id,
        "currency": currency,
        "type": "REWARD",
        "amount": amount,
        "balance_before": balance_before,
        "balance_after": balance_after,
        "source": source,
        "status": "COMPLETED",
        "description": description,
        "created_at": now,
        "updated_at": now
    })

    return {
        "transaction_id": transaction_id,
        "currency": currency,
        "amount": amount,
        "balance_before": balance_before,
        "balance_after": balance_after,
        "status": "COMPLETED"
    }
