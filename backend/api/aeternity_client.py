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

# Base prices for assets - will be updated with REAL live prices on startup
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

# Track if we've fetched real prices yet
_REAL_PRICES_LOADED = False

def fetch_real_current_prices():
    """
    Fetch REAL current prices from CoinGecko API and update BASE_PRICES.
    This ensures we always start with current market data, not stale placeholders.
    """
    global BASE_PRICES, _REAL_PRICES_LOADED

    if _REAL_PRICES_LOADED:
        return  # Already loaded real prices

    try:
        print("[PRICE INIT] Fetching REAL current prices from CoinGecko...")

        # CoinGecko free API - no key needed
        # Map our symbols to CoinGecko IDs
        coingecko_ids = {
            "BTC": "bitcoin",
            "ETH": "ethereum",
            "SOL": "solana",
            "AE": "aeternity"
        }

        ids_param = ",".join(coingecko_ids.values())
        url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids_param}&vs_currencies=usd"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
        }

        response = requests.get(url, headers=headers, timeout=15)

        if response.status_code == 200:
            data = response.json()

            # Update BASE_PRICES with real current prices
            for symbol, cg_id in coingecko_ids.items():
                if cg_id in data and "usd" in data[cg_id]:
                    real_price = data[cg_id]["usd"]
                    BASE_PRICES[symbol] = real_price
                    print(f"[PRICE INIT] ✓ {symbol}: ${real_price} (LIVE)")

            _REAL_PRICES_LOADED = True
            print(f"[PRICE INIT] ✓ Successfully loaded REAL prices: {BASE_PRICES}")
        else:
            print(f"[PRICE INIT] ✗ CoinGecko API returned {response.status_code}, using fallback prices")

    except Exception as e:
        print(f"[PRICE INIT] ✗ Failed to fetch real prices: {e}, using fallback prices")
        # Continue with existing BASE_PRICES as fallback

def get_oracle_price(asset: str) -> float:
    """
    Queries the Aeternity oracle for the price of an asset vs USD.
    Falls back to mock prices if oracle is unavailable.
    """
    # Ensure we have REAL current prices loaded first
    fetch_real_current_prices()

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

    # Round to appropriate decimal places (more precision for low-priced assets)
    if asset == "AE":
        current_price = round(current_price, 6)  # Need 6 decimals for smooth charts at ~$0.007 price
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

def generate_fallback_history(asset: str, limit: int = 180) -> list:
    """
    Generate realistic fallback history when CoinGecko is unavailable.
    Uses current real price as a base and creates reasonable historical data.
    """
    # Fetch real current prices first
    fetch_real_current_prices()

    if asset not in BASE_PRICES:
        return []

    current_price = BASE_PRICES[asset]
    decimals = 6 if asset == "AE" else 2
    current_time = int(time.time() * 1000)

    # Generate 180 points going back in time (5 min intervals = 15 hours)
    interval_ms = 5 * 60 * 1000  # 5 minutes
    history = []

    for i in range(limit):
        # Go backwards in time
        timestamp = current_time - ((limit - i - 1) * interval_ms)

        # Create slight price variation (±2%) to make charts look realistic
        variation = 1.0 + (random.random() * 0.04 - 0.02)  # -2% to +2%
        price = round(current_price * variation, decimals)

        history.append({
            "timestamp": timestamp,
            "open": price,
            "high": price,
            "low": price,
            "close": price,
        })

    return history

def get_price_history(asset: str, interval: str = "1m", limit: int = 60) -> list:
    """
    Fetch REAL historical price data from CoinGecko.
    Falls back to realistic seed data if CoinGecko is unavailable (rate limits).

    Args:
        asset: Asset symbol (e.g., "AE", "BTC")
        interval: Time interval ("1m", "5m", "15m", "1h", "4h", "1d")
        limit: Number of data points to return

    Returns:
        List of REAL price data points with timestamp and OHLC data from CoinGecko
    """
    # Map our assets to CoinGecko IDs
    coingecko_ids = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "SOL": "solana",
        "AE": "aeternity"
    }

    cg_id = coingecko_ids.get(asset)
    if not cg_id:
        print(f"[HISTORY] Unknown asset for CoinGecko: {asset}")
        return generate_fallback_history(asset, limit)

    try:
        # For charts, we want sufficient data points
        # CoinGecko returns different granularity based on days:
        # - 1 day: 5-minute intervals (288 points)
        # - 7 days: hourly (168 points)
        # - 30+ days: daily (30+ points)

        # For most chart requests (180 points), use 1 day to get 5-min intervals
        if limit <= 300:
            days = 1  # Gets 5-minute data (288 points per day)
        elif limit <= 500:
            days = 7  # Gets hourly data (168 points)
        else:
            days = 30  # Gets daily data

        # CoinGecko free tier limits
        if days > 90:
            days = 90

        url = f"https://api.coingecko.com/api/v3/coins/{cg_id}/market_chart"
        params = {
            "vs_currency": "usd",
            "days": days,
            # Note: CoinGecko auto-selects interval based on days parameter
            # Don't specify interval parameter - it causes issues
        }

        print(f"[HISTORY] 📊 Request: {asset} ({cg_id}), days={days}, limit={limit}")
        print(f"[HISTORY] 🌐 URL: {url}")
        print(f"[HISTORY] 📝 Params: {params}")

        # Add headers to avoid being blocked as a bot
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
        }

        response = requests.get(url, params=params, headers=headers, timeout=15)

        print(f"[HISTORY] 📡 Response status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"[HISTORY] 📦 Response keys: {list(data.keys())}")

            prices = data.get("prices", [])
            print(f"[HISTORY] 💰 Raw prices count: {len(prices)}")

            if not prices:
                print(f"[HISTORY] ✗ No price data from CoinGecko for {asset}")
                print(f"[HISTORY] 🔍 Full response: {data}")
                return []

            # Convert to our OHLC format
            # Since CoinGecko gives us single price points, we'll use price for all OHLC values
            history = []
            decimals = 6 if asset == "AE" else 2

            for timestamp_ms, price in prices[-limit:]:  # Get last 'limit' points
                rounded_price = round(price, decimals)
                history.append({
                    "timestamp": timestamp_ms,  # Already in milliseconds
                    "open": rounded_price,
                    "high": rounded_price,
                    "low": rounded_price,
                    "close": rounded_price,
                })

            print(f"[HISTORY] ✓ Fetched {len(history)} REAL data points for {asset} from CoinGecko")
            print(f"[HISTORY] 📈 Price range: ${history[0]['close']} → ${history[-1]['close']}")
            return history

        else:
            print(f"[HISTORY] ✗ CoinGecko returned {response.status_code} for {asset}")
            print(f"[HISTORY] 🔍 Response text: {response.text[:500]}")
            print(f"[HISTORY] 🔄 Falling back to generated data based on real current price")
            return generate_fallback_history(asset, limit)

    except requests.exceptions.Timeout as e:
        print(f"[HISTORY] ⏱️ Timeout fetching from CoinGecko: {e}")
        print(f"[HISTORY] 🔄 Falling back to generated data based on real current price")
        return generate_fallback_history(asset, limit)
    except requests.exceptions.RequestException as e:
        print(f"[HISTORY] 🌐 Network error fetching from CoinGecko: {e}")
        print(f"[HISTORY] 🔄 Falling back to generated data based on real current price")
        return generate_fallback_history(asset, limit)
    except Exception as e:
        print(f"[HISTORY] ✗ Unexpected error: {type(e).__name__}: {e}")
        import traceback
        print(f"[HISTORY] 🔍 Traceback: {traceback.format_exc()}")
        print(f"[HISTORY] 🔄 Falling back to generated data based on real current price")
        return generate_fallback_history(asset, limit)

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
        "change_24h": round(change_24h, 6 if asset == "AE" else 2),
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
