from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class WalletTransaction(BaseModel):
    transaction_id: str
    user_id: str
    currency: str
    type: str
    amount: int
    balance_before: int
    balance_after: int
    source: str
    reference_id: Optional[str] = None
    status: str = "COMPLETED"
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
