import React, { useState } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, BarChart3 } from 'lucide-react';
import { formatPrice } from '@/utils/formatters';

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
  marketCap: string;
}

interface Position {
  id: string;
  stock: Stock;
  side: 'LONG' | 'SHORT';
  size: number;
  collateral: number;
  leverage: number;
  entryPrice: number;
  liqPrice: number;
  pnl: number;
}

interface StocksTradingProps {
  balance: number;
  onOpenPosition: (position: Omit<Position, 'id' | 'pnl' | 'liqPrice'>) => void;
}

const MOCK_STOCKS: Stock[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 178.45, change: 1.23, volume: '52.3M', marketCap: '2.78T' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 242.84, change: -2.15, volume: '112.5M', marketCap: '771.2B' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 495.22, change: 3.45, volume: '45.8M', marketCap: '1.22T' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 378.91, change: 0.87, volume: '23.4M', marketCap: '2.82T' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 140.23, change: 1.56, volume: '28.9M', marketCap: '1.75T' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 155.67, change: -0.45, volume: '35.2M', marketCap: '1.61T' },
];

const StocksTrading: React.FC<StocksTradingProps> = ({ balance, onOpenPosition }) => {
  const [selectedStock, setSelectedStock] = useState<Stock>(MOCK_STOCKS[0]);
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [collateral, setCollateral] = useState<string>('');
  const [leverage, setLeverage] = useState<number>(5);
  const [positions, setPositions] = useState<Position[]>([]);

  const positionSize = parseFloat(collateral || '0') * leverage;

  const calculateLiquidationPrice = () => {
    const entryPrice = selectedStock.price;
    if (side === 'LONG') {
      return entryPrice * (1 - 1 / leverage);
    } else {
      return entryPrice * (1 + 1 / leverage);
    }
  };

  const handleOpenPosition = () => {
    if (!collateral || parseFloat(collateral) <= 0) return;

    const collateralNum = parseFloat(collateral);
    if (collateralNum > balance) {
      alert('Insufficient balance');
      return;
    }

    const newPosition = {
      stock: selectedStock,
      side,
      size: positionSize,
      collateral: collateralNum,
      leverage,
      entryPrice: selectedStock.price,
    };

    onOpenPosition(newPosition);

    // Add to local positions (mock)
    setPositions([...positions, {
      id: `pos-${Date.now()}`,
      ...newPosition,
      liqPrice: calculateLiquidationPrice(),
      pnl: 0,
    }]);

    setCollateral('');
  };

  return (
    <div className="space-y-6">
      {/* Stock Selection Grid */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4 text-slate-200">Stocks Perpetual Futures</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MOCK_STOCKS.map((stock) => (
            <button
              key={stock.symbol}
              onClick={() => setSelectedStock(stock)}
              className={`p-4 rounded-lg border transition-all ${
                selectedStock.symbol === stock.symbol
                  ? 'bg-blue-500/20 border-blue-500'
                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold text-lg text-slate-200">{stock.symbol}</div>
                  <div className="text-xs text-slate-400">{stock.name}</div>
                </div>
                <div className={`flex items-center gap-1 ${stock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {stock.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-sm font-semibold">{stock.change.toFixed(2)}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-slate-200">${stock.price.toFixed(2)}</span>
                <span className="text-xs text-slate-400">{stock.volume}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trading Panel */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-200">Open Position</h3>
            <div className="text-sm text-slate-400">
              Available: <span className="text-slate-200 font-semibold">{balance.toFixed(2)} USD</span>
            </div>
          </div>

          {/* Selected Stock */}
          <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-bold text-slate-200">{selectedStock.symbol}</div>
                <div className="text-xs text-slate-400">{selectedStock.name}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-slate-200">${selectedStock.price.toFixed(2)}</div>
                <div className={`text-sm ${selectedStock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedStock.change >= 0 ? '+' : ''}{selectedStock.change.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* Long/Short Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setSide('LONG')}
              className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                side === 'LONG'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Long
            </button>
            <button
              onClick={() => setSide('SHORT')}
              className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                side === 'SHORT'
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Short
            </button>
          </div>

          {/* Collateral Input */}
          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-2">Collateral (USD)</label>
            <input
              type="number"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Leverage Slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-400">Leverage</label>
              <span className="text-lg font-bold text-slate-200">{leverage}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>1x</span>
              <span>5x</span>
              <span>10x</span>
              <span>20x</span>
            </div>
          </div>

          {/* Position Details */}
          <div className="bg-slate-800/50 rounded-lg p-4 space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Position Size</span>
              <span className="text-slate-200 font-semibold">${positionSize.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Entry Price</span>
              <span className="text-slate-200 font-semibold">${selectedStock.price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Liquidation Price</span>
              <span className="text-rose-400 font-semibold">${calculateLiquidationPrice().toFixed(2)}</span>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200">
                Stocks perpetuals are high-risk. {leverage}x leverage means {leverage}x gains but also {leverage}x losses.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleOpenPosition}
            disabled={!collateral || parseFloat(collateral) <= 0}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
              side === 'LONG'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-rose-500 hover:bg-rose-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Open {side} Position
          </button>
        </div>

        {/* Positions Panel */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-200">Active Positions</h3>
          {positions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No active positions</p>
              <p className="text-sm mt-1">Open a position to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {positions.map((position) => (
                <div key={position.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{position.stock.symbol}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        position.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {position.side}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold">
                        {position.leverage}x
                      </span>
                    </div>
                    <div className={`text-lg font-bold ${position.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)}%
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-slate-400 text-xs">Size</div>
                      <div className="text-slate-200 font-semibold">${position.size.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Entry</div>
                      <div className="text-slate-200 font-semibold">${position.entryPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Collateral</div>
                      <div className="text-slate-200 font-semibold">${position.collateral.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Liq. Price</div>
                      <div className="text-rose-400 font-semibold">${position.liqPrice.toFixed(2)}</div>
                    </div>
                  </div>

                  <button className="w-full mt-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm font-medium transition-all">
                    Close Position
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StocksTrading;
