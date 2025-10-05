# Claerdex 📈

> A Hybrid Perpetual DEX on Aeternity - Combining on-chain security with off-chain performance

Claerdex is a next-generation decentralized exchange for perpetual futures trading, built on the Aeternity blockchain. It leverages a hybrid architecture that records trades on-chain for transparency while executing them off-chain (or on state channels) for speed.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Aeternity](https://img.shields.io/badge/blockchain-Aeternity-pink.svg)
![Python](https://img.shields.io/badge/backend-FastAPI-green.svg)
![React](https://img.shields.io/badge/frontend-React-blue.svg)

## ✨ Features

### Trading
- **Perpetual Futures** - Long/Short positions with up to 50x leverage
- **Spot Trading** - Direct buy/sell of crypto assets
- **Stocks Trading** - Perpetual futures on traditional stocks (AAPL, TSLA, etc.)
- **Live Oracle Prices** - Real-time price feeds with Aeternity chain
- **USD-Based Trading** - Enter positions in USD amounts, auto-calculated to AE

### User Experience
- **Real Superhero Wallet Integration** - Connect with Aeternity's Superhero Wallet
- **Live Price Charts** - TradingView-style charts with position markers
- **Position Management** - View open positions, PnL tracking, liquidation prices
- **Portfolio View** - Comprehensive overview of all positions and performance

### Technical
- **Aeternity Oracles** - Native blockchain oracles for trustless, decentralized price feeds
- **Aeternity State Channels** - Layer 2 solution for instant, zero-fee trading at scale
- **Hybrid Model** - Fast off-chain execution + on-chain audit trail
- **Vercel KV Storage** - Redis-based persistent state management
- **Price History Persistence** - Chart data survives deployments
- **Responsive Design** - Beautiful dark UI with Tailwind CSS

## 🏗️ Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│  Frontend   │─────▶│   Backend    │─────▶│   Aeternity     │
│  (React)    │      │   (FastAPI)  │      │   Blockchain    │
│             │      │              │      │                 │
│ - Charts    │      │ - Positions  │      │ - Trade Records │
│ - Wallet    │      │ - Oracle     │      │ - Balances      │
│ - UI/UX     │      │ - State Mgmt │      │ - Smart Contract│
└─────────────┘      └──────────────┘      └─────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Vercel KV   │
                     │  (Redis)     │
                     │              │
                     │ - Accounts   │
                     │ - Positions  │
                     │ - Price Data │
                     └──────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Aeternity Superhero Wallet browser extension
- Vercel account (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/lorem111/claerdex.git
   cd claerdex
   ```

2. **Backend Setup**
   ```bash
   cd backend
   pip install -r requirements.txt

   # Set environment variables (optional for local dev)
   export REDIS_URL="your_redis_url"  # Uses in-memory storage if not set

   # Run backend
   uvicorn api.index:app --reload
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm start
   ```

4. **Oracle Service** (Optional - for accurate updates)
   ```bash
   cd oracle
   npm install
   npm run dev
   ```

### Environment Variables

**Backend** (`backend/.env`):
```bash
REDIS_URL=your_vercel_kv_redis_url
```

**Frontend** (`frontend/.env`):
```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_BLOCKCHAIN_STATUS_URL=https://mainnet.aeternity.io/v3/status
```

## 📦 Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Chakra UI** - Component library
- **Lightweight Charts** - Trading charts
- **Superhero Wallet SDK** - Aeternity wallet integration

### Backend
- **FastAPI** - Python web framework
- **Pydantic** - Data validation
- **Vercel KV (Redis)** - State persistence
- **Aeternity SDK** - Blockchain interaction

### Blockchain
- **Aeternity** - Layer 1 blockchain
- **Sophia** - Smart contract language
- **Oracle System** - Price feeds

## 📁 Project Structure

```
claerdex/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── utils/        # Helper functions, formatters
│   │   ├── RefinedApp.tsx # Main application component
│   │   └── index.tsx     # Entry point
│   └── public/
│
├── backend/              # FastAPI backend
│   └── api/
│       ├── index.py      # Main API endpoints
│       ├── models.py     # Pydantic data models
│       ├── state.py      # Vercel KV state management
│       └── aeternity_client.py # Blockchain integration
│
├── oracle/               # Price oracle service
│   └── src/
│       ├── oracle.js     # Price fetching logic
│       └── deploy/       # Contract deployment
│
└── README.md
```

## 🔑 Key Files

### Backend API (`backend/api/index.py`)
- `/prices` - Live price feed for all assets
- `/prices/history/{asset}` - Historical price data for charts
- `/account/{address}` - Get account state with positions
- `/positions/open` - Open new perpetual position
- `/positions/close/{id}` - Close existing position

### Frontend Components
- `RefinedApp.tsx` - Main app with Web3 context provider
- `TradingChart.tsx` - Interactive price charts with position lines
- `TradePanel.tsx` - Position opening interface
- `PositionsPanel.tsx` - Open positions table with live PnL

### State Management (`backend/api/state.py`)
- `get_account()` - Retrieve account from KV
- `save_account()` - Persist account to KV
- Automatic fallback to in-memory storage for local dev

## 🌐 Deployment

### Vercel (Recommended)

1. **Setup Vercel KV**
   - Create a KV store in Vercel dashboard
   - Copy `REDIS_URL` to environment variables

2. **Deploy Backend**
   - Configure `vercel.json` in `/backend`
   - Push to main branch for auto-deployment

3. **Deploy Frontend**
   - Configure `vercel.json` in `/frontend`
   - Set `REACT_APP_API_URL` to backend URL
   - Push to main branch

### Manual Deployment

```bash
# Build frontend
cd frontend
npm run build

# Deploy backend (example with gunicorn)
cd backend
gunicorn api.index:app -w 4 -k uvicorn.workers.UvicornWorker
```

## 📊 Trading Features Explained

### Perpetual Futures
- Open LONG (bet price goes up) or SHORT (bet price goes down)
- Enter amount in USD, system calculates required AE collateral
- Leverage up to 50x multiplies your position size
- Liquidation occurs if price moves against you beyond threshold

### Position Display
- **Entry Price** - Price when position was opened
- **Current PnL** - Unrealized profit/loss in real-time
- **Liquidation Price** - Price level that triggers liquidation
- **Chart Markers** - Visual lines showing entry and liquidation levels

### Price Precision
- **AE**: 4 decimal places (e.g., $0.0512)
- **BTC/ETH/SOL**: 2 decimal places (e.g., $50,123.45)

## 🔐 Security

- **Non-Custodial** - Users maintain control of funds via Superhero Wallet
- **On-Chain Audit Trail** - Every trade recorded on Aeternity blockchain
- **Price Oracle Security** - Multiple price source validation
- **Input Validation** - Pydantic models ensure data integrity

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **Aeternity Foundation** - Blockchain infrastructure
- **CoinGecko** - Price data API
- **Superhero Wallet** - Wallet integration
- **TradingView** - Chart inspiration

## 📞 Support

- **GitHub Issues**: [Report bugs](https://github.com/lorem111/claerdex/issues)
- **Documentation**: Check code comments and this README
- **Community**: Join Aeternity Discord

---

**Built with ❤️ on Aeternity Blockchain**
