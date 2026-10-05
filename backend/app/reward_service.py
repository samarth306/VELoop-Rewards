from datetime import datetime, timezone, date
from uuid import uuid4

from fastapi import HTTPException

from backend.app.database import client, db

wallets_collection = db["wallets"]
transactions_collection = db["wallet_transactions"]
reward_claims_collection = db["reward_claims"]

# Confirmed reward schedule.
DAILY_REWARDS = {
    1: {"ves": 100},
    2: {"ves": 100},
    3: {"ves": 100},
    4: {"ves": 100},
    5: {"ves": 100, "sves": 1, "spins": 1},
    6: {"ves": 100},
    7: {"ves": 100},
    8: {"ves": 100},
    9: {"ves": 100},
    10: {"ves": 200, "sves": 1, "tokens": 1, "gems": 1, "spins": 1},
}

CONVERSION_RATES = {
    "sves": 500,
    "tokens": 2000,
    "gems": 5000,
}

ACCOUNT_BONUS = {"ves": 1000, "spins": 1}
SPIN_REWARD_VES = 100

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
    # Index creation is best-effort during app import; Mongo will enforce it
    # on deployed startup when the collection is available.
    pass


def _now():
    return datetime.now(timezone.utc)


def _ledger_doc(user_id, currency, tx_type, amount, before, after, source, description, reference_id, metadata=None, now=None):
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
        {"user_id": user_id, "claim_date": today},
        {"_id": 0},
    )
    wallet = wallets_collection.find_one({"user_id": user_id}, {"_id": 0}) or {}
    last_date = wallet.get("daily_last_claim_date")
    streak_day = int(wallet.get("daily_streak_day", 0) or 0)
    if claim:
        return {
            "claimed_today": True,
            "claim_date": today,
            "day": streak_day or 1,
            "reward": claim.get("reward", {}),
            "next_reward": DAILY_REWARDS.get(1 if streak_day >= 10 else streak_day + 1, DAILY_REWARDS[1]),
            "streak_day": streak_day,
        }
    next_day = 1
    if last_date:
        try:
            previous = date.fromisoformat(str(last_date))
            delta = (date.today() - previous).days
            if delta == 1:
                next_day = 1 if streak_day >= 10 else streak_day + 1
            elif delta == 0:
                next_day = streak_day or 1
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
                {"user_id": user_id, "claim_date": today},
                session=session,
            )
            if existing:
                return {"already_claimed": True, "claim": {k: v for k, v in existing.items() if k != "_id"}}

            wallet = wallets_collection.find_one({"user_id": user_id}, session=session)
            if not wallet:
                raise HTTPException(status_code=404, detail="Wallet not found")

            streak_day = int(wallet.get("daily_streak_day", 0) or 0)
            last_date = wallet.get("daily_last_claim_date")
            next_day = 1
            if last_date:
                try:
                    delta = (date.today() - date.fromisoformat(str(last_date))).days
                    if delta == 1:
                        next_day = 1 if streak_day >= 10 else streak_day + 1
                    elif delta == 0:
                        next_day = streak_day or 1
                except ValueError:
                    next_day = 1

            reward = DAILY_REWARDS[next_day]
            for currency, amount in reward.items():
                before = int(wallet.get(currency, 0) or 0)
                after = before + int(amount)
                wallets_collection.update_one(
                    {"user_id": user_id},
                    {"$inc": {currency: int(amount)}, "$set": {"updated_at": now}},
                    session=session,
                )
                tx = _ledger_doc(
                    user_id, currency, "DAILY_REWARD", int(amount), before, after,
                    "daily_reward", f"Daily reward — Day {next_day}",
                    f"daily:{today}:day-{next_day}", {"day": next_day}, now,
                )
                transactions_collection.insert_one(tx, session=session)

            claim = {
                "claim_id": str(uuid4()),
                "user_id": user_id,
                "claim_date": today,
                "day": next_day,
                "reward": reward,
                "created_at": now,
            }
            try:
                reward_claims_collection.insert_one(claim, session=session)
            except Exception:
                existing = reward_claims_collection.find_one(
                    {"user_id": user_id, "claim_date": today}, session=session
                )
                if existing:
                    raise HTTPException(status_code=409, detail="Daily reward already claimed today")
                raise

            wallets_collection.update_one(
                {"user_id": user_id},
                {"$set": {"daily_streak_day": next_day, "daily_last_claim_date": today, "updated_at": now}},
                session=session,
            )

    claim.pop("_id", None)
    return {"already_claimed": False, "claim": claim}


def spin_reward(user_id):
    now = _now()
    with client.start_session() as session:
        with session.start_transaction():
            wallet = wallets_collection.find_one({"user_id": user_id}, session=session)
            if not wallet:
                raise HTTPException(status_code=404, detail="Wallet not found")
            spins = int(wallet.get("spins", 0) or 0)
            if spins < 1:
                raise HTTPException(status_code=400, detail="No spins available")

            before_spins = spins
            before_ves = int(wallet.get("ves", 0) or 0)
            after_spins = before_spins - 1
            after_ves = before_ves + SPIN_REWARD_VES

            result = wallets_collection.update_one(
                {"user_id": user_id, "spins": {"$gte": 1}},
                {"$inc": {"spins": -1, "ves": SPIN_REWARD_VES}, "$set": {"updated_at": now}},
                session=session,
            )
            if result.modified_count != 1:
                raise HTTPException(status_code=409, detail="Spin could not be completed; please try again")

            ref = str(uuid4())
            transactions_collection.insert_one(
                _ledger_doc(user_id, "spins", "SPIN", 1, before_spins, after_spins,
                            "spin_reward", "Spin used", ref, {"reward_ves": SPIN_REWARD_VES}, now),
                session=session,
            )
            transactions_collection.insert_one(
                _ledger_doc(user_id, "ves", "SPIN_REWARD", SPIN_REWARD_VES, before_ves, after_ves,
                            "spin_reward", "Spin reward", ref, {"spin_cost": 1}, now),
                session=session,
            )

    return {"reward_ves": SPIN_REWARD_VES, "spins_remaining": after_spins, "ves_balance": after_ves}


def convert_all_to_ves(user_id):
    now = _now()
    with client.start_session() as session:
        with session.start_transaction():
            wallet = wallets_collection.find_one({"user_id": user_id}, session=session)
            if not wallet:
                raise HTTPException(status_code=404, detail="Wallet not found")

            total_ves = 0
            conversions = {}
            reference_id = str(uuid4())
            for currency, rate in CONVERSION_RATES.items():
                amount = int(wallet.get(currency, 0) or 0)
                if amount <= 0:
                    continue
                ves_value = amount * rate
                before = amount
                total_ves += ves_value
                conversions[currency] = {"amount": amount, "ves": ves_value, "rate": rate}
                wallets_collection.update_one(
                    {"user_id": user_id},
                    {"$inc": {currency: -amount}, "$set": {"updated_at": now}},
                    session=session,
                )
                transactions_collection.insert_one(
                    _ledger_doc(user_id, currency, "CONVERSION_DEBIT", amount, before, 0,
                                "conversion", f"Convert {currency.upper()} to VEs", reference_id,
                                {"rate_to_ves": rate, "ves_value": ves_value}, now),
                    session=session,
                )

            if total_ves <= 0:
                raise HTTPException(status_code=400, detail="No convertible rewards available")

            before_ves = int(wallet.get("ves", 0) or 0)
            after_ves = before_ves + total_ves
            wallets_collection.update_one(
                {"user_id": user_id},
                {"$inc": {"ves": total_ves}, "$set": {"updated_at": now}},
                session=session,
            )
            transactions_collection.insert_one(
                _ledger_doc(user_id, "ves", "CONVERSION_CREDIT", total_ves, before_ves, after_ves,
                            "conversion", "Converted rewards to VEs", reference_id,
                            {"conversions": conversions}, now),
                session=session,
            )

    return {"converted_ves": total_ves, "ves_balance": after_ves, "conversions": conversions}
