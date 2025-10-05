"""
Real price history tracking and storage.
Fetches initial historical data from CoinGecko, then continuously records real prices.
"""

import time
import json
import requests
from typing import List, Dict, Optional

# Import Vercel KV if available
try:
    from vercel_kv import kv
    USING_KV = True
except ImportError:
    print("Warning: vercel_kv not available, using in-memory storage for local dev")
    USING_KV = False
    PRICE_HISTORY_DB = {}

# CoinGecko API mapping
COINGECKO_IDS = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "SOL": "solana",
    "AE": "aeternity"
}

def get_history_key(asset: str, interval: str) -> str:
    """Generate KV key for price history storage."""
    return f"price_history:{asset}:{interval}"

def fetch_coingecko_historical(asset: str, days: int = 7) -> List[Dict]:
    """
    Fetch real historical price data from CoinGecko.

    Args:
        asset: Asset symbol (BTC, ETH, SOL, AE)
        days: Number of days of history to fetch (max 90 for free tier)

    Returns:
        List of price data points with timestamp and price
    """
    cg_id = COINGECKO_IDS.get(asset)
    if not cg_id:
        print(f"[HISTORY] Unknown asset for CoinGecko: {asset}")
        return []

    try:
        url = f"https://api.coingecko.com/api/v3/coins/{cg_id}/market_chart"
        params = {
            "vs_currency": "usd",
            "days": days,
            "interval": "daily" if days > 1 else "hourly"
        }

        print(f"[HISTORY] Fetching {days}d history for {asset} from CoinGecko...")
        response = requests.get(url, params=params, timeout=10)

        if response.status_code == 200:
            data = response.json()
            prices = data.get("prices", [])

            # Convert to our format
            history = []
            for timestamp_ms, price in prices:
                history.append({
                    "timestamp": timestamp_ms,  # Already in milliseconds
                    "price": price,
                })

            print(f"[HISTORY] ✓ Fetched {len(history)} data points for {asset}")
            return history
        else:
            print(f"[HISTORY] ✗ CoinGecko returned {response.status_code}")
            return []

    except Exception as e:
        print(f"[HISTORY] ✗ Failed to fetch CoinGecko data: {e}")
        return []

def get_stored_history(asset: str, interval: str) -> Optional[List[Dict]]:
    """Get stored price history from KV or memory."""
    key = get_history_key(asset, interval)

    if USING_KV:
        try:
            data = kv.get(key)
            if data:
                if isinstance(data, str):
                    return json.loads(data)
                return data
        except Exception as e:
            print(f"[HISTORY] Error reading from KV: {e}")
            return None
    else:
        return PRICE_HISTORY_DB.get(key)

    return None

def save_price_history(asset: str, interval: str, history: List[Dict]) -> bool:
    """Save price history to KV or memory."""
    key = get_history_key(asset, interval)

    if USING_KV:
        try:
            kv.set(key, json.dumps(history))
            print(f"[HISTORY] ✓ Saved {len(history)} points for {asset}:{interval} to KV")
            return True
        except Exception as e:
            print(f"[HISTORY] ✗ Error saving to KV: {e}")
            return False
    else:
        PRICE_HISTORY_DB[key] = history
        print(f"[HISTORY] ✓ Saved {len(history)} points for {asset}:{interval} to memory")
        return True

def append_price_point(asset: str, interval: str, price: float, timestamp: int = None) -> bool:
    """
    Append a new price point to existing history.
    This is called periodically to record real price changes.
    """
    if timestamp is None:
        timestamp = int(time.time() * 1000)  # Current time in ms

    # Get existing history
    history = get_stored_history(asset, interval) or []

    # Generate OHLC data (for single point, all values are the same)
    # In production, you'd aggregate multiple points for OHLC
    decimals = 6 if asset == "AE" else 2
    price_rounded = round(price, decimals)

    new_point = {
        "timestamp": timestamp,
        "open": price_rounded,
        "high": price_rounded,
        "low": price_rounded,
        "close": price_rounded,
    }

    # Append and keep only recent data (e.g., last 1000 points)
    history.append(new_point)
    history = history[-1000:]  # Keep last 1000 points

    # Save back
    return save_price_history(asset, interval, history)

def initialize_history_if_needed(asset: str, interval: str = "1m") -> bool:
    """
    Initialize price history from CoinGecko if not already present.
    This is called once on first request.
    """
    key = get_history_key(asset, interval)

    # Check if we already have data
    existing = get_stored_history(asset, interval)
    if existing and len(existing) > 0:
        print(f"[HISTORY] ✓ Already have {len(existing)} points for {asset}:{interval}")
        return True

    print(f"[HISTORY] No existing data for {asset}:{interval}, fetching from CoinGecko...")

    # Fetch historical data from CoinGecko
    cg_data = fetch_coingecko_historical(asset, days=7)
    if not cg_data:
        print(f"[HISTORY] ✗ Failed to fetch initial data for {asset}")
        return False

    # Convert to OHLC format (simplified - using same price for O/H/L/C)
    decimals = 6 if asset == "AE" else 2
    history = []

    for point in cg_data:
        price = round(point["price"], decimals)
        history.append({
            "timestamp": point["timestamp"],
            "open": price,
            "high": price,
            "low": price,
            "close": price,
        })

    # Save to storage
    success = save_price_history(asset, interval, history)

    if success:
        print(f"[HISTORY] ✓ Initialized {len(history)} points for {asset}:{interval}")
    else:
        print(f"[HISTORY] ✗ Failed to save initial data for {asset}")

    return success

def get_price_history(asset: str, interval: str = "1m", limit: int = 180) -> List[Dict]:
    """
    Get real price history for an asset.

    This is the main function that:
    1. Checks if history exists, if not initializes from CoinGecko
    2. Returns the requested number of recent points

    Args:
        asset: Asset symbol (BTC, ETH, SOL, AE)
        interval: Time interval (1m, 5m, 15m, 1h, 4h, 1d)
        limit: Number of data points to return

    Returns:
        List of OHLC price data points
    """
    # Initialize if needed (first time)
    initialize_history_if_needed(asset, interval)

    # Get stored history
    history = get_stored_history(asset, interval) or []

    if not history:
        print(f"[HISTORY] ✗ No history available for {asset}:{interval}")
        return []

    # Return most recent `limit` points
    recent_history = history[-limit:] if len(history) > limit else history

    print(f"[HISTORY] ✓ Returning {len(recent_history)} points for {asset}:{interval}")
    return recent_history
