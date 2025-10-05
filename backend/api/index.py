from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid
import sys
import os

# Add parent directory to path to import our modules
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# Import our modules
import aeternity_client as ae
import state as db
from models import Account, Position, OpenPositionRequest

app = FastAPI()

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- HELPER FUNCTIONS ---
def get_or_create_account(address: str) -> Account:
    """Get account from KV store or create a new one."""
    account = db.get_account(address)

    if not account:
        # First time we see this user, create an account for them
        on_chain_balance = ae.get_on_chain_balance(address)
        account = Account(
            address=address,
            on_chain_balance_ae=on_chain_balance,
            available_collateral_ae=on_chain_balance,
            positions=[]
        )
        db.save_account(account)
    else:
        # Always refresh on-chain balance on fetch
        account.on_chain_balance_ae = ae.get_on_chain_balance(address)
        db.save_account(account)

    return account

# --- API ENDPOINTS ---

@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "Claerdex Backend", "deployment": "vercel"}

@app.get("/prices")
def get_all_prices():
    """Endpoint for the frontend to get all relevant asset prices at once."""
    import time

    prices = {
        "AE": ae.get_oracle_price("AE"),
        "BTC": ae.get_oracle_price("BTC"),
        "ETH": ae.get_oracle_price("ETH"),
        "SOL": ae.get_oracle_price("SOL"),
    }

    # Add metadata for the frontend
    return {
        "prices": prices,
        "timestamp": int(time.time()),
        "update_interval": 5,  # Prices update every 5 seconds
    }

@app.get("/blockchain/status")
def get_blockchain_status():
    """
    Get current Aeternity blockchain status including latest block information.

    Returns the latest keyblock height, hash, and other network statistics.
    """
    block_info = ae.get_latest_block()

    return {
        "network": "mainnet",
        "latest_block": block_info,
        "explorer_url": f"https://explorer.aeternity.io/keyblock/{block_info.get('hash', '')}" if block_info.get('hash') else None
    }

@app.get("/account/{user_address}", response_model=Account)
def get_account_state(user_address: str):
    """The main data endpoint for the frontend dashboard."""
    account = get_or_create_account(user_address)

    # Recalculate PnL for all open positions in real-time
    for position in account.positions:
        current_price = ae.get_oracle_price(position.asset)
        # The frontend can do PnL calculations for visual effect
        pass

    return account

@app.post("/positions/open")
def open_position(request: OpenPositionRequest):
    """Endpoint to open a new perpetual futures position."""
    account = get_or_create_account(request.user_address)

    # 1. Validation
    if request.collateral_to_use_ae > account.available_collateral_ae:
        raise HTTPException(status_code=400, detail="Insufficient available collateral")

    # 2. Get current price to use as entry price
    entry_price = ae.get_oracle_price(request.asset)
    if entry_price == 0.0:
        raise HTTPException(status_code=500, detail="Could not fetch oracle price")

    # 3. Calculations
    position_size_usd = request.collateral_to_use_ae * entry_price * request.leverage
    # Simplified liquidation price calculation
    liquidation_price = entry_price * (1 - (1 / request.leverage)) if request.side == 'long' else entry_price * (1 + (1 / request.leverage))

    # 4. Create and store the new position
    new_position = Position(
        id=str(uuid.uuid4()),
        asset=request.asset,
        side=request.side,
        size_usd=position_size_usd,
        collateral_ae=request.collateral_to_use_ae,
        leverage=request.leverage,
        entry_price=entry_price,
        liquidation_price=liquidation_price
    )

    account.positions.append(new_position)
    account.available_collateral_ae -= request.collateral_to_use_ae

    # Save updated account state to KV
    db.save_account(account)

    # 5. The "Hybrid Model" Proof: Record the trade on-chain for auditing
    tx_hash = ae.record_trade_on_chain(new_position)
    print(f"Trade {new_position.id} recorded on-chain with tx: {tx_hash}")

    return {"message": "Position opened successfully", "position": new_position, "on_chain_tx": tx_hash}

@app.post("/positions/close/{position_id}")
def close_position(user_address: str, position_id: str):
    """Endpoint to close an existing position."""
    account = get_or_create_account(user_address)

    position_to_close = next((p for p in account.positions if p.id == position_id), None)

    if not position_to_close:
        raise HTTPException(status_code=404, detail="Position not found")

    # 1. Get closing price
    closing_price = ae.get_oracle_price(position_to_close.asset)

    # 2. Calculate PnL
    pnl_usd = (closing_price - position_to_close.entry_price) * (position_to_close.size_usd / position_to_close.entry_price)
    pnl_ae = pnl_usd / closing_price  # Convert PnL back to AE

    # 3. Settle the position
    account.available_collateral_ae += position_to_close.collateral_ae + pnl_ae
    account.positions = [p for p in account.positions if p.id != position_id]

    # Save updated account state to KV
    db.save_account(account)

    return {"message": "Position closed", "realized_pnl_ae": pnl_ae}

# Vercel requires the app to be exported as 'app'
# This handler makes it compatible with Vercel's serverless function environment
handler = app
