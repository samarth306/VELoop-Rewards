
from pydantic import BaseModel, Field
from typing import Dict, Any


class PayoutOption(BaseModel):
    method_id: str
    name: str
    type: str
    currency: str = "ves"
    payout_value: int = Field(gt=0)
    required_amount: int = Field(gt=0)
    active: bool = True
    eligibility: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}
