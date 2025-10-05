# Claerdex Backend

Backend API for the Claerdex perpetual futures decentralized exchange.

## Architecture

- **Framework**: FastAPI
- **Database**: Vercel KV (Redis) for production, in-memory fallback for local dev
- **Blockchain**: Aeternity (for price oracles and trade auditing)
- **Model**: Hybrid - Python for logic, Aeternity for trust
- **Deployment**: Serverless functions on Vercel

## Project Structure

```
backend/
├── api/
│   └── index.py            # FastAPI app (serverless entry point)
├── aeternity_client.py     # Blockchain interaction layer
├── state.py                # Vercel KV storage adapter
├── models.py               # Pydantic data models
├── requirements.txt        # Python dependencies
├── vercel.json            # Vercel configuration
├── .vercelignore          # Deployment exclusions
├── main.py                # Legacy local dev file
├── DEPLOYMENT.md          # Deployment guide
└── README.md              # This file
```

## Quick Start

### Local Development

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
# Option 1: New structure (recommended)
uvicorn api.index:app --reload --host 0.0.0.0 --port 8000

# Option 2: Legacy file (if you prefer)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### Production Deployment

**Deploy to Vercel in 3 steps:**

1. Create a Vercel KV database in your dashboard (Storage → Create → KV)
2. Import your GitHub repo at [vercel.com/new](https://vercel.com/new)
3. Connect the KV database to your project

📖 **See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions**

## API Endpoints

**Note:** When deployed to Vercel, all endpoints are prefixed with `/api` (e.g., `/api/prices`)

### `GET /` (or `/api` on Vercel)
Health check endpoint

### `GET /prices` (or `/api/prices` on Vercel)
Get current prices for all supported assets with 24-hour statistics. Prices update every 5 seconds with realistic random movements.

**Response:**
```json
{
  "data": {
    "AE": {
      "price": 0.0302,
      "high_24h": 0.0315,
      "low_24h": 0.0289,
      "open_24h": 0.0298,
      "change_24h": 0.0004,
      "change_percent_24h": 2.15
    },
    "BTC": {
      "price": 68156.42,
      "high_24h": 69000.0,
      "low_24h": 67500.0,
      "open_24h": 67800.0,
      "change_24h": 356.42,
      "change_percent_24h": 0.53
    },
    "ETH": { "..." },
    "SOL": { "..." }
  },
  "timestamp": 1696531200,
  "update_interval": 5
}
```

**Note:** Prices currently use mock data with random movements. Real oracle integration coming soon.

### `GET /prices/history` (or `/api/prices/history` on Vercel)
Get historical price data for charting.

**Query Parameters:**
- `asset` - Asset symbol (AE, BTC, ETH, SOL). Default: "AE"
- `interval` - Time interval (1m, 5m, 15m, 1h, 4h, 1d). Default: "1m"
- `limit` - Number of data points (max 1000). Default: 60

**Example:** `/api/prices/history?asset=AE&interval=1h&limit=100`

**Response:**
```json
{
  "asset": "AE",
  "interval": "1h",
  "data": [
    {
      "timestamp": 1696527600000,
      "open": 0.0301,
      "high": 0.0305,
      "low": 0.0299,
      "close": 0.0302
    },
    { "..." }
  ]
}
```

### `GET /blockchain/status` (or `/api/blockchain/status` on Vercel)
Get current Aeternity blockchain status and latest block information.

**Response:**
```json
{
  "network": "mainnet",
  "latest_block": {
    "height": 1187935,
    "hash": "kh_2cu9Dmb6zTtLUeKXothCVh8iqS1fe2uQ6W1BoNtdPmwHa9TKGF",
    "time": 1759639965179,
    "transactions_count": 39,
    "micro_blocks_count": 40,
    "miner": "ak_jZdweEpAFwRdTQSXn4c91nEWTRgVvVxyMK15ZcsCxLLuy46at"
  },
  "explorer_url": "https://explorer.aeternity.io/keyblock/kh_2cu9..."
}
```

### `GET /account/{user_address}` (or `/api/account/{user_address}` on Vercel)
Get account state for a user including balance and open positions with real-time PnL

**Response:**
```json
{
  "address": "ak_...",
  "on_chain_balance_ae": 1000.0,
  "available_collateral_ae": 900.0,
  "positions": [
    {
      "id": "uuid-here",
      "asset": "AE",
      "side": "short",
      "size_usd": 34.99,
      "collateral_ae": 100.0,
      "leverage": 10.0,
      "entry_price": 0.034993,
      "liquidation_price": 0.03145,
      "current_price": 0.03494,
      "unrealized_pnl_usd": 0.01,
      "unrealized_pnl_ae": 0.000286
    }
  ]
}
```

**Note:** Unrealized PnL is calculated in real-time based on current market prices.

### `POST /positions/open` (or `/api/positions/open` on Vercel)
Open a new perpetual futures position

**Request Body:**
```json
{
  "user_address": "ak_...",
  "asset": "BTC",
  "side": "long",
  "collateral_to_use_ae": 10.0,
  "leverage": 5.0
}
```

**Response:**
```json
{
  "message": "Position opened successfully",
  "position": {...},
  "on_chain_tx": "th_..."
}
```

### `POST /positions/close/{position_id}?user_address=ak_...` (or `/api/positions/close/{position_id}` on Vercel)
Close an existing position

**Response:**
```json
{
  "message": "Position closed",
  "realized_pnl_ae": 1.5
}
```

## Development

- Interactive API docs: `http://localhost:8000/docs`
- Alternative docs: `http://localhost:8000/redoc`

## Next Steps

1. ✅ **Deploy to Vercel** - See [DEPLOYMENT.md](DEPLOYMENT.md)
2. Replace mock oracle prices with real Aeternity oracle integration
3. Implement actual smart contract interaction in `aeternity_client.py`
4. Implement liquidation engine
5. Add WebSocket support for real-time price updates
6. Set up monitoring and error tracking (Sentry, LogRocket, etc.)
# Trigger redeploy - Sun Oct  5 08:57:59 EEST 2025
