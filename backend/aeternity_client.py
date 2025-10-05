# This module isolates all blockchain communication.
# We'll assume the functions from our previous discussion are here.

# You would implement the actual SDK calls here.
# For pseudocode, we just define the function signatures.

import time
import random
import requests
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
    Queries the public Aeternity oracle for the price of an asset vs USD.

    Currently returns mock prices that update every 5 seconds with random movements.
    This will be replaced with real oracle data later.
    """
    print(f"Fetching oracle price for {asset}...")

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
