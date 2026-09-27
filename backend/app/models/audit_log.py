from pydantic import BaseModel
from typing import Optional, Dict, Any


class AuditLog(BaseModel):
    audit_id: str
    user_id: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: str
