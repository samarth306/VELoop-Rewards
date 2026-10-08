

from datetime import date, datetime, timezone
from uuid import uuid4

from fastapi import HTTPException

from backend.database import client, db




wallets_collection = db["wallets"]
transactions_collection = db["wallet_transactions"]
reward_claims_collection = db["reward_claims"]




DAILY_REWARDS = {
    1: {
        "ves": 100,
    },
    2: {
        "ves": 100,
    },
    3: {
        "ves": 100,
    },
    4: {
        "ves": 100,
    },
    5: {
        "ves": 100,
        "sves": 1,
    },
    6: {
        "ves": 100,
    },
    7: {
        "ves": 100,
    },
    8: {
        "ves": 100,
    },
    9: {
        "ves": 100,
    },
    10: {
        "ves": 200,
        "sves": 1,
        "tokens": 1,
        "gems": 1,
    },
}




CONVERSION_RATES = {
    "sves": 500,
    "tokens": 2000,
    "gems": 5000,
}



try:
    reward_claims_collection.create_index(
        [("user_id", 1), ("claim_date", 1)],
        unique=True,
        name="unique_daily_reward_claim",
    )

    reward_claims_collection.create_index(
        [("user_id", 1), ("created_at", -1)],
        name="user_reward_claims_created_at",
    )

except Exception:
    # Index creation is best-effort during application startup.
    pass




def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ledger_doc(
    user_id,
    currency,
    tx_type,
    amount,
    before,
    after,
    source,
    description,
    reference_id,
    metadata=None,
    now=None,
):
    timestamp = now or _now()

    return {
        "transaction_id": str(uuid4()),
        "user_id": user_id,
        "currency": currency,
        "type": tx_type,
        "amount": amount,
        "balance_before": before,
        "balance_after": after,
        "source": source,
        "reference_id": reference_id,
        "status": "COMPLETED",
        "description": description,
        "metadata": metadata or {},
        "created_at": timestamp,
        "updated_at": timestamp,
    }



def get_daily_status(user_id):
    today = date.today().isoformat()

    claim = reward_claims_collection.find_one(
        {
            "user_id": user_id,
            "claim_date": today,
        },
        {
            "_id": 0,
        },
    )

    wallet = wallets_collection.find_one(
        {
            "user_id": user_id,
        },
        {
            "_id": 0,
        },
    ) or {}

    last_date = wallet.get("daily_last_claim_date")
    streak_day = int(wallet.get("daily_streak_day", 0) or 0)

    if claim:
        next_day = 1 if streak_day >= 10 else streak_day + 1

        return {
            "claimed_today": True,
            "claim_date": today,
            "day": streak_day or 1,
            "reward": claim.get("reward", {}),
            "next_reward": DAILY_REWARDS.get(
                next_day,
                DAILY_REWARDS[1],
            ),
            "streak_day": streak_day,
        }

    next_day = 1

    if last_date:
        try:
            previous = date.fromisoformat(str(last_date))
            delta = (date.today() - previous).days

            if delta == 1:
                next_day = (
                    1
                    if streak_day >= 10
                    else streak_day + 1
                )

            elif delta == 0:
                next_day = streak_day or 1

            elif delta > 1:
                next_day = 1

        except ValueError:
            next_day = 1

    return {
        "claimed_today": False,
        "claim_date": today,
        "day": next_day,
        "reward": DAILY_REWARDS[next_day],
        "next_reward": DAILY_REWARDS[next_day],
        "streak_day": streak_day,
    }



def claim_daily_reward(user_id):
    today = date.today().isoformat()
    now = _now()

    with client.start_session() as session:
        with session.start_transaction():

            existing = reward_claims_collection.find_one(
                {
                    "user_id": user_id,
                    "claim_date": today,
                },
                session=session,
            )

            if existing:
                return {
                    "already_claimed": True,
                    "claim": {
                        key: value
                        for key, value in existing.items()
                        if key != "_id"
                    },
                }

            wallet = wallets_collection.find_one(
                {
                    "user_id": user_id,
                },
                session=session,
            )

            if not wallet:
                raise HTTPException(
                    status_code=404,
                    detail="Wallet not found",
                )

            streak_day = int(
                wallet.get("daily_streak_day", 0) or 0
            )

            last_date = wallet.get(
                "daily_last_claim_date"
            )

            next_day = 1

            if last_date:
                try:
                    delta = (
                        date.today()
                        - date.fromisoformat(str(last_date))
                    ).days

                    if delta == 1:
                        next_day = (
                            1
                            if streak_day >= 10
                            else streak_day + 1
                        )

                    elif delta == 0:
                        next_day = streak_day or 1

                    elif delta > 1:
                        next_day = 1

                except ValueError:
                    next_day = 1

            reward = DAILY_REWARDS[next_day]

            for currency, amount in reward.items():


                before = int(
                    wallet.get(currency, 0) or 0
                )

                amount = int(amount)
                after = before + amount

                wallets_collection.update_one(
                    {
                        "user_id": user_id,
                    },
                    {
                        "$inc": {
                            currency: amount,
                        },
                        "$set": {
                            "updated_at": now,
                        },
                    },
                    session=session,
                )

                transaction = _ledger_doc(
                    user_id=user_id,
                    currency=currency,
                    tx_type="DAILY_REWARD",
                    amount=amount,
                    before=before,
                    after=after,
                    source="daily_reward",
                    description=f"Daily reward — Day {next_day}",
                    reference_id=(
                        f"daily:{today}:day-{next_day}"
                    ),
                    metadata={
                        "day": next_day,
                    },
                    now=now,
                )

                transactions_collection.insert_one(
                    transaction,
                    session=session,
                )

            claim = {
                "claim_id": str(uuid4()),
                "user_id": user_id,
                "claim_date": today,
                "day": next_day,
                "reward": reward,
                "created_at": now,
            }

            try:
                reward_claims_collection.insert_one(
                    claim,
                    session=session,
                )

            except Exception:
                existing = reward_claims_collection.find_one(
                    {
                        "user_id": user_id,
                        "claim_date": today,
                    },
                    session=session,
                )

                if existing:
                    raise HTTPException(
                        status_code=409,
                        detail="Daily reward already claimed today",
                    )

                raise

            wallets_collection.update_one(
                {
                    "user_id": user_id,
                },
                {
                    "$set": {
                        "daily_streak_day": next_day,
                        "daily_last_claim_date": today,
                        "updated_at": now,
                    },
                },
                session=session,
            )

    claim.pop("_id", None)

    return {
        "already_claimed": False,
        "claim": claim,
    }



def convert_reward_to_ves(user_id, currency, amount):
    """
    Convert a user-selected amount of SVE, Tokens or Gems into VEs.

    Rates are backend-controlled:
        1 SVE   = 500 VEs
        1 Token = 2,000 VEs
        1 Gem   = 5,000 VEs

    The source-currency debit and VEs credit are committed in one MongoDB
    transaction and both sides are recorded in the wallet ledger.
    """
    currency = str(currency).lower().strip()
    if currency not in CONVERSION_RATES:
        raise HTTPException(status_code=400, detail="Unsupported conversion currency")

    try:
        amount = int(amount)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Conversion amount must be a whole number")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Conversion amount must be greater than zero")

    rate = int(CONVERSION_RATES[currency])
    converted_ves = amount * rate
    now = _now()

    with client.start_session() as session:
        with session.start_transaction():
            wallet = wallets_collection.find_one(
                {"user_id": user_id},
                {"_id": 0},
                session=session,
            )

            if not wallet:
                raise HTTPException(status_code=404, detail="Wallet not found")

            source_before = int(wallet.get(currency, 0) or 0)
            ves_before = int(wallet.get("ves", 0) or 0)

            if source_before < amount:
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
                    "$set": {"updated_at": now},
                },
                session=session,
            )

            if result.modified_count != 1:
                raise HTTPException(
                    status_code=409,
                    detail="Wallet changed during conversion. Please try again.",
                )

            source_tx = _ledger_doc(
                user_id=user_id,
                currency=currency,
                tx_type="CONVERSION_DEBIT",
                amount=amount,
                before=source_before,
                after=source_before - amount,
                source="reward_conversion",
                description=f"Converted {amount:,} {currency.upper()} into VEs",
                reference_id=None,
                metadata={"rate": rate, "ves_credit": converted_ves},
                now=now,
            )

            ves_tx = _ledger_doc(
                user_id=user_id,
                currency="ves",
                tx_type="CONVERSION_CREDIT",
                amount=converted_ves,
                before=ves_before,
                after=ves_before + converted_ves,
                source="reward_conversion",
                description=f"Received {converted_ves:,} VEs from {amount:,} {currency.upper()}",
                reference_id=source_tx["transaction_id"],
                metadata={"source_currency": currency, "source_amount": amount, "rate": rate},
                now=now,
            ) 
            source_tx["reference_id"] = ves_tx["transaction_id"]

            transactions_collection.insert_one(
                source_tx,
                session=session,
            )

            transactions_collection.insert_one(
                ves_tx,
                session=session,
            )

    return {
        "success": True,
        "currency": currency,
        "amount": amount,
        "conversion_rate": rate,
        "converted_ves": converted_ves,
        "new_ves_balance": ves_before + converted_ves,
        "transactions": [source_tx, ves_tx],
        "message": (
            f"{amount:,} {currency.upper()} converted to "
            f"{converted_ves:,} VEs successfully"
        ),
    }

