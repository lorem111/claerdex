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
Get current prices for all supported assets (AE, BTC, ETH, SOL). Prices update every 5 seconds with realistic random movements.

**Response:**
```json
{
  "prices": {
    "AE": 0.0302,
    "BTC": 68156.42,
    "ETH": 3487.91,
    "SOL": 151.34
  },
  "timestamp": 1696531200,
  "update_interval": 5
}
```

**Note:** Prices currently use mock data with random movements. Real oracle integration coming soon.

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
Get account state for a user including balance and open positions

**Response:**
```json
{
  "address": "ak_...",
  "on_chain_balance_ae": 1000.0,
  "available_collateral_ae": 900.0,
  "positions": [...]
}
```

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
