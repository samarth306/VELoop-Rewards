from pydantic import BaseModel, Field


class Wallet(BaseModel):
    user_id: str
    ves: int = Field(default=0, ge=0)
    sves: int = Field(default=0, ge=0)
    gems: int = Field(default=0, ge=0)
    tokens: int = Field(default=0, ge=0)
    spins: int = Field(default=0, ge=0)
