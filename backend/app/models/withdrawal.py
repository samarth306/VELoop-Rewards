from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class Withdrawal(BaseModel):
    withdrawal_id: str
    user_id: str
    currency: str
    amount: int = Field(gt=0)
    payout_option_id: str
    payout_details: Dict[str, Any]
    status: str = "PENDING"
    transaction_id: Optional[str] = None
    failure_reason: Optional[str] = None
