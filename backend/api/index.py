from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid

# Import from same directory (api/) using relative imports
from . import aeternity_client as ae
from . import state as db
from .models import Account, Position, OpenPositionRequest

app = FastAPI()

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
    return {"status": "ok", "service": "Claerdex Backend", "deployment": "vercel", "version": "2.1", "oracle_configured": oracle_url_set}

@app.get("/prices")
def get_all_prices():
    """Endpoint for the frontend to get all relevant asset prices at once."""
    import time
    from fastapi.responses import JSONResponse

    # Try to import price_history, but don't crash if it fails
    try:
        from price_history import append_price_point
        price_history_available = True
    except Exception as e:
        print(f"[PRICE HISTORY] Module not available: {e}")
        price_history_available = False

    assets = ["AE", "BTC", "ETH", "SOL"]

    # Get current prices
    prices = {}
    stats_24h = {}

    for asset in assets:
        current_price = ae.get_oracle_price(asset)
        prices[asset] = current_price
        stats_24h[asset] = ae.get_24h_stats(asset)

        # RECORD PRICE TO HISTORY: Append current price to historical data
        # This builds real price history over time
        if price_history_available:
            try:
                append_price_point(asset, "1m", current_price)
            except Exception as e:
                print(f"[PRICE RECORD] Failed to append {asset} price: {e}")

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

    # ALWAYS use aeternity_client for now (skip price_history module due to KV issues)
    print(f"[HISTORY ENDPOINT] Fetching {asset} history using aeternity_client")
    history = ae.get_price_history(asset, interval, limit)
    print(f"[HISTORY ENDPOINT] Got {len(history)} points for {asset}")

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
