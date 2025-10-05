# This module isolates all blockchain communication.
# We'll assume the functions from our previous discussion are here.

# You would implement the actual SDK calls here.
# For pseudocode, we just define the function signatures.

import time
import random
import requests
import os
from typing import Optional
from models import Position

# Base prices for assets (starting point)
BASE_PRICES = {
    "AE": 0.03,
    "BTC": 68000.0,
    "ETH": 3500.0,
    "SOL": 150.0,
}

# Price volatility (max percentage change per 5-second interval)
VOLATILITY = {
    "AE": 0.002,    # 0.2% max change
    "BTC": 0.003,   # 0.3% max change
    "ETH": 0.0025,  # 0.25% max change
    "SOL": 0.004,   # 0.4% max change (SOL is more volatile)
}

def get_oracle_price(asset: str) -> float:
    """
    Queries the Aeternity oracle for the price of an asset vs USD.
    Falls back to mock prices if oracle is unavailable.
    """
    print(f"Fetching oracle price for {asset}...")

    # Try to fetch from oracle API first
    oracle_url = os.environ.get("ORACLE_API_URL")
    if oracle_url:
        try:
            response = requests.get(f"{oracle_url}/prices", timeout=5)
            if response.status_code == 200:
                data = response.json()
                prices = data.get("data", {})

                # Map asset names
                if asset in prices and prices[asset] is not None:
                    oracle_price = float(prices[asset])
                    print(f"Got oracle price for {asset}: {oracle_price}")
                    return oracle_price
        except Exception as e:
            print(f"Oracle API error: {e}, falling back to mock prices")

    # Fallback to mock prices
    if asset not in BASE_PRICES:
        return 0.0

    # Get current time rounded to 5-second intervals
    # This ensures all requests within the same 5-second window get the same price
    current_time = int(time.time())
    interval = current_time // 5  # 5-second intervals

    # Use the interval as a seed for deterministic randomness
    # This way the price is consistent within each 5-second window
    random.seed(interval * hash(asset))

    base_price = BASE_PRICES[asset]
    volatility = VOLATILITY.get(asset, 0.002)

    # Generate a random price movement between -volatility and +volatility
    change_percent = random.uniform(-volatility, volatility)

    # Apply multiple intervals worth of changes to simulate realistic price movement
    # We use the interval number to create cumulative price changes
    cumulative_change = 0
    temp_seed = interval
    for _ in range(min(interval % 100, 20)):  # Limit iterations for performance
        random.seed(temp_seed * hash(asset))
        cumulative_change += random.uniform(-volatility, volatility)
        temp_seed -= 1

    # Calculate final price with cumulative changes
    current_price = base_price * (1 + cumulative_change)

    # Ensure price doesn't deviate too far from base (keep within ±10%)
    min_price = base_price * 0.9
    max_price = base_price * 1.1
    current_price = max(min_price, min(max_price, current_price))

    # Round to appropriate decimal places
    if asset == "AE":
        current_price = round(current_price, 4)
    elif asset in ["BTC", "ETH"]:
        current_price = round(current_price, 2)
    elif asset == "SOL":
        current_price = round(current_price, 2)

    return current_price

def get_on_chain_balance(user_address: str) -> float:
    """Queries our ClaerVault.sophia smart contract to get a user's deposited balance."""
    print(f"Fetching on-chain balance for {user_address}...")
    # ... actual aeternity-sdk-python code to call the contract's `get_balance` function ...
    return 1000.0  # Return a mock value for now

def record_trade_on_chain(position: Position) -> str:
    """Hashes the trade details and posts the hash to our smart contract for auditing."""
    trade_details = f"{position.id},{position.asset},{position.side},{position.size_usd}"
    trade_hash = hash(trade_details)  # Simplified hashing
    print(f"Recording trade hash {trade_hash} on-chain...")
    # ... actual aeternity-sdk-python code to call the `record_trade` function ...
    # Return the transaction hash for the demo "wow" moment
    return "th_...example_tx_hash"

def get_latest_block() -> dict:
    """
    Fetches the latest keyblock from the Aeternity blockchain.

    Returns block information including height, hash, and timing.
    """
    try:
        # Fetch latest keyblock from Aeternity middleware
        url = "https://mainnet.aeternity.io/mdw/v3/key-blocks?limit=1"
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        data = response.json()

        if data.get("data") and len(data["data"]) > 0:
            latest_block = data["data"][0]

            return {
                "height": latest_block.get("height"),
                "hash": latest_block.get("hash"),
                "time": latest_block.get("time"),
                "transactions_count": latest_block.get("transactions_count"),
                "micro_blocks_count": latest_block.get("micro_blocks_count"),
                "miner": latest_block.get("miner"),
            }
        else:
            return {
                "height": 0,
                "hash": "unknown",
                "time": 0,
                "transactions_count": 0,
                "micro_blocks_count": 0,
                "miner": "unknown",
            }

    except requests.exceptions.RequestException as e:
        print(f"Error fetching latest block: {e}")
        # Return fallback data if API is unavailable
        return {
            "height": 0,
            "hash": "unavailable",
            "time": int(time.time() * 1000),
            "transactions_count": 0,
            "micro_blocks_count": 0,
            "miner": "unavailable",
            "error": str(e)
        }

def get_price_history(asset: str, interval: str = "1m", limit: int = 60) -> list:
    """
    Generate historical price data for charting.
    Works backwards from current real price to generate plausible historical data.

    Args:
        asset: Asset symbol (e.g., "AE", "BTC")
        interval: Time interval ("1m", "5m", "15m", "1h", "4h", "1d")
        limit: Number of data points to return

    Returns:
        List of price data points with timestamp and OHLC data
    """
    if asset not in BASE_PRICES:
        return []

    # Map intervals to seconds
    interval_seconds = {
        "1m": 60,
        "5m": 300,
        "15m": 900,
        "1h": 3600,
        "4h": 14400,
        "1d": 86400,
    }

    seconds = interval_seconds.get(interval, 60)
    current_time = int(time.time())

    # Get current REAL price from oracle
    current_price = get_oracle_price(asset)
    print(f"[Historical Data] Oracle returned ${current_price} for {asset}")

    # Set volatility based on asset
    volatility = VOLATILITY.get(asset, 0.002)

    # Generate historical data working BACKWARDS from current price
    history = []
    price = current_price

    # Work backwards through time
    for i in range(limit):
        # Calculate timestamp (going backwards from current time)
        timestamp = current_time - (i * seconds)

        # Use deterministic randomness based on timestamp for consistency
        random.seed(timestamp * hash(asset))

        # Generate realistic price movement (slightly random walk backwards)
        price_change = random.uniform(-volatility, volatility)

        # For the first iteration (most recent), use current price as-is
        # For older points, walk the price backwards
        if i > 0:
            price = price * (1 - price_change)  # Walk backwards

        # Add to history (we'll reverse it later)
        # Round appropriately
        if asset == "AE":
            rounded_price = round(price, 4)
        else:
            rounded_price = round(price, 2)

        # Generate OHLC data with slight variations
        random.seed(timestamp * hash(asset) + 1)
        variation = rounded_price * 0.001  # 0.1% variation for OHLC

        history.append({
            "timestamp": timestamp * 1000,  # Convert to milliseconds
            "open": round(rounded_price - random.uniform(-variation, variation), 4 if asset == "AE" else 2),
            "high": round(rounded_price + random.uniform(0, variation), 4 if asset == "AE" else 2),
            "low": round(rounded_price - random.uniform(0, variation), 4 if asset == "AE" else 2),
            "close": rounded_price,
        })

    # Reverse to get chronological order (oldest to newest)
    history.reverse()

    return history

def get_24h_stats(asset: str) -> dict:
    """
    Calculate 24-hour price statistics based on real current price.
    Uses price history to get realistic 24h data.

    Returns:
        Dictionary with 24h high, low, open, and change percentage
    """
    if asset not in BASE_PRICES:
        return {
            "high_24h": 0,
            "low_24h": 0,
            "open_24h": 0,
            "change_24h": 0,
            "change_percent_24h": 0,
        }

    # Get current real price
    current_price = get_oracle_price(asset)

    # Get 24h of historical data (using 1h intervals = 24 points)
    history_24h = get_price_history(asset, interval="1h", limit=24)

    if not history_24h:
        return {
            "high_24h": current_price,
            "low_24h": current_price,
            "open_24h": current_price,
            "change_24h": 0,
            "change_percent_24h": 0,
        }

    # Extract highs and lows from history
    highs = [point["high"] for point in history_24h]
    lows = [point["low"] for point in history_24h]
    price_24h_ago = history_24h[0]["open"]  # Opening price 24h ago

    high_24h = max(highs + [current_price])
    low_24h = min(lows + [current_price])

    # Calculate change
    change_24h = current_price - price_24h_ago
    change_percent_24h = (change_24h / price_24h_ago * 100) if price_24h_ago != 0 else 0

    return {
        "high_24h": high_24h,
        "low_24h": low_24h,
        "open_24h": price_24h_ago,
        "change_24h": round(change_24h, 4 if asset == "AE" else 2),
        "change_percent_24h": round(change_percent_24h, 2),
    }

def calculate_position_pnl(position_size_usd: float, entry_price: float, current_price: float, side: str) -> dict:
    """
    Calculate unrealized PnL for a position.

    Args:
        position_size_usd: Size of position in USD
        entry_price: Entry price
        current_price: Current market price
        side: "long" or "short"

    Returns:
        Dictionary with PnL in USD and percentage
    """
    if side == "long":
        # Long: profit when price goes up
        pnl_usd = (current_price - entry_price) * (position_size_usd / entry_price)
    else:
        # Short: profit when price goes down
        pnl_usd = (entry_price - current_price) * (position_size_usd / entry_price)

    # Calculate PnL percentage
    pnl_percent = (pnl_usd / position_size_usd * 100) if position_size_usd != 0 else 0

    return {
        "pnl_usd": round(pnl_usd, 2),
        "pnl_percent": round(pnl_percent, 2),
    }
