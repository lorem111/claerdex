from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid
import time
import json

# Import from same directory (api/) using relative imports
from . import aeternity_client as ae
from . import state as db
from .models import Account, Position, OpenPositionRequest

# Import Vercel KV
try:
    from vercel_kv import kv
    KV_AVAILABLE = True
    print("[KV] ✓ Vercel KV available")
except ImportError:
    KV_AVAILABLE = False
    print("[KV] ✗ Vercel KV not available, using in-memory storage")

app = FastAPI()

# Server-side price history storage - our source of truth
# Format: {asset: [(timestamp, price), (timestamp, price), ...]}
RECORDED_PRICE_HISTORY = {
    "AE": [],
    "BTC": [],
    "ETH": [],
    "SOL": []
}
MAX_HISTORY_POINTS = 1000  # Keep last 1000 price recordings per asset

def get_kv_key(asset: str) -> str:
    """Generate KV key for price history"""
    return f"price_history:{asset}"

def load_history_from_kv(asset: str) -> bool:
    """Load price history from KV into memory"""
    if not KV_AVAILABLE:
        return False

    try:
        key = get_kv_key(asset)
        data = kv.get(key)

        if data:
            # Parse JSON if it's a string
            if isinstance(data, str):
                history = json.loads(data)
            else:
                history = data

            RECORDED_PRICE_HISTORY[asset] = [tuple(point) for point in history]
            print(f"[KV LOAD] ✓ Loaded {len(RECORDED_PRICE_HISTORY[asset])} points for {asset} from KV")
            return True
        else:
            print(f"[KV LOAD] No stored history for {asset} in KV")
            return False
    except Exception as e:
        print(f"[KV LOAD] ✗ Failed to load {asset} from KV: {e}")
        return False

def save_history_to_kv(asset: str) -> bool:
    """Save price history from memory to KV"""
    if not KV_AVAILABLE:
        return False

    try:
        key = get_kv_key(asset)
        history = RECORDED_PRICE_HISTORY[asset]

        # Convert to JSON-serializable format
        kv.set(key, json.dumps(history))
        print(f"[KV SAVE] ✓ Saved {len(history)} points for {asset} to KV")
        return True
    except Exception as e:
        print(f"[KV SAVE] ✗ Failed to save {asset} to KV: {e}")
        return False

def append_recorded_price(asset: str, price: float, timestamp_ms: int = None):
    """Record a price point to our ongoing history and persist to KV"""
    if asset not in RECORDED_PRICE_HISTORY:
        return

    if timestamp_ms is None:
        timestamp_ms = int(time.time() * 1000)

    # Load from KV if we don't have data in memory (cold start)
    if len(RECORDED_PRICE_HISTORY[asset]) == 0:
        load_history_from_kv(asset)

    # Append new price
    RECORDED_PRICE_HISTORY[asset].append((timestamp_ms, price))

    # Keep only the last MAX_HISTORY_POINTS
    if len(RECORDED_PRICE_HISTORY[asset]) > MAX_HISTORY_POINTS:
        RECORDED_PRICE_HISTORY[asset] = RECORDED_PRICE_HISTORY[asset][-MAX_HISTORY_POINTS:]

    # Save to KV every time (ensures persistence)
    save_history_to_kv(asset)

    print(f"[PRICE RECORD] {asset}: ${price} recorded (total: {len(RECORDED_PRICE_HISTORY[asset])} points)")

def get_recorded_history(asset: str, limit: int = 180) -> list:
    """Get recorded price history in OHLC format"""
    if asset not in RECORDED_PRICE_HISTORY:
        return []

    # Load from KV if we don't have data in memory (cold start)
    if len(RECORDED_PRICE_HISTORY[asset]) == 0:
        load_history_from_kv(asset)

    history = RECORDED_PRICE_HISTORY[asset]
    if not history:
        return []

    # Get last 'limit' points
    recent = history[-limit:] if len(history) > limit else history

    # Convert to OHLC format
    decimals = 6 if asset == "AE" else 2
    ohlc_data = []

    for timestamp_ms, price in recent:
        rounded_price = round(price, decimals)
        ohlc_data.append({
            "timestamp": timestamp_ms,
            "open": rounded_price,
            "high": rounded_price,
            "low": rounded_price,
            "close": rounded_price,
        })

    return ohlc_data

def initialize_price_history():
    """Load price history from KV or seed from CoinGecko if needed"""
    assets = ["AE", "BTC", "ETH", "SOL"]

    print("[HISTORY INIT] Initializing price history...")
    for asset in assets:
        # Skip if already in memory
        if len(RECORDED_PRICE_HISTORY[asset]) > 0:
            print(f"[HISTORY INIT] ✓ {asset} already has {len(RECORDED_PRICE_HISTORY[asset])} points in memory")
            continue

        # Try to load from KV first
        if load_history_from_kv(asset):
            print(f"[HISTORY INIT] ✓ Loaded {asset} from KV, skipping seed")
            continue

        # No data in KV - seed from CoinGecko
        print(f"[HISTORY INIT] No KV data for {asset}, seeding from CoinGecko...")
        try:
            # Fetch initial data from CoinGecko or fallback
            history = ae.get_price_history(asset, "1m", 180)
            if history:
                # Convert to our format and store
                for point in history:
                    RECORDED_PRICE_HISTORY[asset].append((point["timestamp"], point["close"]))

                # Save to KV for future cold starts
                save_history_to_kv(asset)
                print(f"[HISTORY INIT] ✓ Seeded {len(history)} points for {asset} and saved to KV")
            else:
                print(f"[HISTORY INIT] ✗ No seed data for {asset}")
            # Small delay to avoid rate limiting
            time.sleep(0.5)
        except Exception as e:
            print(f"[HISTORY INIT] ✗ Failed to seed {asset}: {e}")

@app.on_event("startup")
async def startup_event():
    """Run initialization tasks on server startup"""
    initialize_price_history()

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Export app for Vercel (Vercel's Python runtime handles FastAPI directly)

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
    import os
    oracle_url_set = "ORACLE_API_URL" in os.environ

    # Show how much recorded history we have
    history_counts = {asset: len(RECORDED_PRICE_HISTORY[asset]) for asset in RECORDED_PRICE_HISTORY}

    return {
        "status": "ok",
        "service": "Claerdex Backend",
        "deployment": "vercel",
        "version": "2.2",
        "oracle_configured": oracle_url_set,
        "recorded_history_points": history_counts
    }

@app.get("/prices")
def get_all_prices():
    """Endpoint for the frontend to get all relevant asset prices at once."""
    import time
    from fastapi.responses import JSONResponse

    assets = ["AE", "BTC", "ETH", "SOL"]

    # Get current prices
    prices = {}
    stats_24h = {}

    for asset in assets:
        current_price = ae.get_oracle_price(asset)
        prices[asset] = current_price
        stats_24h[asset] = ae.get_24h_stats(asset)

        # RECORD PRICE TO HISTORY: Append current price to our ongoing history
        # This builds real price history over time as frontend polls /prices
        append_recorded_price(asset, current_price)

    # Combine current prices with 24h statistics
    price_data = {}
    for asset in assets:
        price_data[asset] = {
            "price": prices[asset],
            "high_24h": stats_24h[asset]["high_24h"],
            "low_24h": stats_24h[asset]["low_24h"],
            "open_24h": stats_24h[asset]["open_24h"],
            "change_24h": stats_24h[asset]["change_24h"],
            "change_percent_24h": stats_24h[asset]["change_percent_24h"],
        }

    # Add metadata for the frontend
    response_data = {
        "data": price_data,
        "timestamp": int(time.time()),
        "update_interval": 5,  # Prices update every 5 seconds
    }

    # Add cache headers for instant browser caching (stale-while-revalidate)
    # Browser can use cached version for up to 5 seconds, and revalidate in background for up to 60 seconds
    return JSONResponse(
        content=response_data,
        headers={
            "Cache-Control": "public, max-age=5, stale-while-revalidate=60",
            "CDN-Cache-Control": "public, max-age=5",
        }
    )

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

@app.post("/admin/seed-history")
def seed_history():
    """Admin endpoint to force seed price history from CoinGecko/fallback"""
    print("[ADMIN] Manual history seeding requested...")
    initialize_price_history()

    counts = {asset: len(RECORDED_PRICE_HISTORY[asset]) for asset in RECORDED_PRICE_HISTORY}
    return {
        "message": "Price history seeded",
        "recorded_points": counts
    }

@app.get("/debug/coingecko")
def debug_coingecko():
    """
    Debug endpoint to test CoinGecko connectivity from Vercel.
    """
    import requests
    import traceback

    results = {}

    # Test 1: Simple price fetch
    try:
        url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
        }
        response = requests.get(url, headers=headers, timeout=15)
        results['simple_price'] = {
            'status_code': response.status_code,
            'data': response.json() if response.status_code == 200 else response.text[:200],
            'success': response.status_code == 200
        }
    except Exception as e:
        results['simple_price'] = {
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }

    # Test 2: Market chart fetch (the one that's failing)
    try:
        url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart"
        params = {'vs_currency': 'usd', 'days': 1}
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
        }
        response = requests.get(url, params=params, headers=headers, timeout=15)
        data = response.json() if response.status_code == 200 else response.text[:200]
        results['market_chart'] = {
            'status_code': response.status_code,
            'has_prices': 'prices' in data if isinstance(data, dict) else False,
            'price_count': len(data.get('prices', [])) if isinstance(data, dict) else 0,
            'sample_data': data if response.status_code != 200 else f"Got {len(data.get('prices', []))} prices",
            'success': response.status_code == 200
        }
    except Exception as e:
        results['market_chart'] = {
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }

    return results

@app.get("/prices/history")
def get_price_history_endpoint(asset: str = "AE", interval: str = "1m", limit: int = 60, debug: bool = False):
    """
    Get historical price data for charting.

    Args:
        asset: Asset symbol (AE, BTC, ETH, SOL)
        interval: Time interval (1m, 5m, 15m, 1h, 4h, 1d)
        limit: Number of data points (max 1000)
        debug: Return diagnostic information instead of data

    Returns:
        Historical OHLC price data
    """
    # Debug mode: test CoinGecko connectivity
    if debug:
        import requests
        import traceback

        results = {}

        # Test direct CoinGecko call
        try:
            url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart"
            params = {'vs_currency': 'usd', 'days': 1}
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
            }
            response = requests.get(url, params=params, headers=headers, timeout=15)
            data = response.json() if response.status_code == 200 else response.text[:500]
            results['coingecko_test'] = {
                'status_code': response.status_code,
                'success': response.status_code == 200,
                'has_prices': 'prices' in data if isinstance(data, dict) else False,
                'price_count': len(data.get('prices', [])) if isinstance(data, dict) else 0,
                'error_message': data if response.status_code != 200 else None
            }
        except Exception as e:
            results['coingecko_test'] = {
                'error': str(e),
                'traceback': traceback.format_exc()[-500:],
                'success': False
            }

        return results

    # Validate inputs
    valid_assets = ["AE", "BTC", "ETH", "SOL"]
    valid_intervals = ["1m", "5m", "15m", "1h", "4h", "1d"]

    if asset not in valid_assets:
        raise HTTPException(status_code=400, detail=f"Invalid asset. Must be one of: {valid_assets}")

    if interval not in valid_intervals:
        raise HTTPException(status_code=400, detail=f"Invalid interval. Must be one of: {valid_intervals}")

    # Limit the number of data points
    limit = min(limit, 1000)

    # Check if we have any recorded history - if not, initialize
    if len(RECORDED_PRICE_HISTORY[asset]) == 0:
        print(f"[HISTORY ENDPOINT] No recorded data for {asset}, initializing...")
        initialize_price_history()

    # Use our recorded price history as the source of truth
    history = get_recorded_history(asset, limit)

    if history:
        print(f"[HISTORY ENDPOINT] ✓ Returning {len(history)} recorded points for {asset}")
    else:
        print(f"[HISTORY ENDPOINT] ⚠️  No recorded history for {asset} yet")

    return {
        "asset": asset,
        "interval": interval,
        "data": history,
    }

@app.get("/account/{user_address}", response_model=Account)
def get_account_state(user_address: str):
    """The main data endpoint for the frontend dashboard."""
    account = get_or_create_account(user_address)

    # Recalculate PnL for all open positions in real-time
    for position in account.positions:
        current_price = ae.get_oracle_price(position.asset)

        # Calculate unrealized PnL
        pnl_data = ae.calculate_position_pnl(
            position.size_usd,
            position.entry_price,
            current_price,
            position.side
        )

        # Update position with current data
        position.unrealized_pnl_usd = pnl_data["pnl_usd"]
        position.unrealized_pnl_ae = pnl_data["pnl_usd"] / current_price  # Convert to AE
        position.current_price = current_price

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

    # 2. Calculate PnL (different formula for LONG vs SHORT)
    pnl_data = ae.calculate_position_pnl(
        position_to_close.size_usd,
        position_to_close.entry_price,
        closing_price,
        position_to_close.side
    )
    pnl_usd = pnl_data["pnl_usd"]
    pnl_ae = pnl_usd / closing_price  # Convert PnL back to AE

    # 3. Settle the position
    account.available_collateral_ae += position_to_close.collateral_ae + pnl_ae
    account.positions = [p for p in account.positions if p.id != position_id]

    # Save updated account state to KV
    db.save_account(account)

    return {"message": "Position closed", "realized_pnl_ae": pnl_ae}

# Handler is already defined at the top using Mangum
