from backend.database import db


# =========================
# DATABASE COLLECTIONS
# =========================

users_collection = db["users"]
wallets_collection = db["wallets"]
transactions_collection = db["wallet_transactions"]
withdrawals_collection = db["withdrawals"]
payout_options_collection = db["payout_options"]
audit_logs_collection = db["audit_logs"]


# =========================
# SAFE INDEX CREATOR
# =========================

def ensure_index(collection, keys, name, unique=False, sparse=False):
    """
    Create an index only when the same key pattern does not
    already exist in MongoDB.

    This prevents startup failure when an older index exists
    with a different name.
    """

    existing_indexes = collection.index_information()

    # Normalize requested key pattern
    requested_keys = tuple(keys)

    for index_name, index_info in existing_indexes.items():
        existing_keys = tuple(index_info.get("key", []))

        if existing_keys == requested_keys:
            # Preserve an existing equivalent index unless uniqueness is required.
            if unique and not index_info.get("unique", False):
                collection.drop_index(index_name)
                break
            return index_name

    return collection.create_index(
        keys,
        unique=unique,
        sparse=sparse,
        name=name,
    )


# =========================
# DATABASE INDEXES
# =========================


# Enforce one account per normalized email and one wallet per user.
# Existing duplicate data must be reconciled before these unique indexes can be created.
ensure_index(users_collection, [("email", 1)], name="unique_user_email", unique=True)
ensure_index(wallets_collection, [("user_id", 1)], name="unique_wallet_user", unique=True)


# Fast transaction history lookup
ensure_index(
    transactions_collection,
    [("user_id", 1), ("created_at", -1)],
    name="user_transactions_created_at",
)


# Fast withdrawal history lookup
ensure_index(
    withdrawals_collection,
    [("user_id", 1), ("created_at", -1)],
    name="user_withdrawals_created_at",
)



# Prevent duplicate withdrawal requests
# Only real request IDs are included in the unique index.
withdrawals_collection.create_index(
    [("user_id", 1), ("request_id", 1)],
    name="unique_withdrawal_request",
    unique=True,
    partialFilterExpression={
        "request_id": {"$type": "string"}
    },
)

# Fast withdrawal status lookup
ensure_index(
    withdrawals_collection,
    [("status", 1), ("created_at", -1)],
    name="withdrawal_status_created_at",
)


# Audit log lookup
ensure_index(
    audit_logs_collection,
    [("user_id", 1), ("created_at", -1)],
    name="user_audit_logs_created_at",
)
