# Using Pydantic for clear, validated data models

from pydantic import BaseModel
from typing import List, Literal, Optional

class Position(BaseModel):
    id: str  # A unique ID for the position, e.g., a UUID
    asset: str  # e.g., "AE", "BTC"
    side: Literal["long", "short"]
    size_usd: float
    collateral_ae: float
    leverage: float
    entry_price: float
    liquidation_price: float
    unrealized_pnl_usd: Optional[float] = 0.0  # Calculated in real-time
    unrealized_pnl_ae: Optional[float] = 0.0  # PnL in AE tokens
    current_price: Optional[float] = None  # Current market price (for frontend display)

class Account(BaseModel):
    address: str
    on_chain_balance_ae: float  # Fetched directly from the smart contract
    available_collateral_ae: float # On-chain balance minus collateral in use
    positions: List[Position]

class OpenPositionRequest(BaseModel):
    user_address: str
    asset: str
    side: Literal["long", "short"]
    collateral_to_use_ae: float
    leverage: float
