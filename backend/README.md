# Claerdex Backend

Backend API for the Claerdex perpetual futures decentralized exchange.

## Architecture

- **Framework**: FastAPI
- **Database**: In-memory Python dictionary (hackathon-ready, no DB setup needed)
- **Blockchain**: Aeternity (for price oracles and trade auditing)
- **Model**: Hybrid - Python for logic, Aeternity for trust

## Project Structure

```
claerdex-backend/
├── main.py                 # FastAPI application and API endpoints
├── aeternity_client.py     # Blockchain interaction layer
├── state.py                # In-memory state management
├── models.py               # Pydantic data models
└── requirements.txt        # Python dependencies
```

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

### `GET /`
Health check endpoint

### `GET /prices`
Get current prices for all supported assets (AE, BTC, ETH)

**Response:**
```json
{
  "AE": 0.03,
  "BTC": 68000.0,
  "ETH": 3500.0
}
```

### `GET /account/{user_address}`
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

### `POST /positions/open`
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

### `POST /positions/close/{position_id}?user_address=ak_...`
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

1. Replace mock oracle prices with real Aeternity oracle integration
2. Implement actual smart contract interaction in `aeternity_client.py`
3. Add persistent database (PostgreSQL, MongoDB, etc.)
4. Implement liquidation engine
5. Add WebSocket support for real-time price updates
