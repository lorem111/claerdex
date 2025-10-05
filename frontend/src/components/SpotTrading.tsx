import React, { useState } from 'react';
import { ArrowDownUp, TrendingUp, TrendingDown } from 'lucide-react';
import { formatPrice } from '@/utils/formatters';

interface Asset {
  id: string;
  name: string;
  icon: string;
  price: number;
  change: number;
}

interface SpotTradingProps {
  assets: Asset[];
  currentPrices: Record<string, number>;
  balance: number;
  onTrade: (side: 'BUY' | 'SELL', asset: string, amount: number, totalCost: number) => void;
}

const SpotTrading: React.FC<SpotTradingProps> = ({ assets, currentPrices, balance, onTrade }) => {
  const [selectedAsset, setSelectedAsset] = useState<Asset>(assets[0]);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState<string>('');
  const [holdings, setHoldings] = useState<Record<string, number>>({
    AE: 1500,
    BTC: 0.025,
    ETH: 0.5,
    SOL: 10,
  });

  const currentPrice = currentPrices[selectedAsset.id] || selectedAsset.price;
  const totalCost = parseFloat(amount || '0') * currentPrice;
  const availableBalance = side === 'BUY' ? balance : (holdings[selectedAsset.id] || 0);

  const handleTrade = () => {
    if (!amount || parseFloat(amount) <= 0) return;

    const amountNum = parseFloat(amount);

    if (side === 'BUY' && totalCost > balance) {
      alert('Insufficient balance');
      return;
    }

    if (side === 'SELL' && amountNum > (holdings[selectedAsset.id] || 0)) {
      alert('Insufficient holdings');
      return;
    }

    // Update holdings (mock)
    if (side === 'BUY') {
      setHoldings(prev => ({ ...prev, [selectedAsset.id]: (prev[selectedAsset.id] || 0) + amountNum }));
    } else {
      setHoldings(prev => ({ ...prev, [selectedAsset.id]: (prev[selectedAsset.id] || 0) - amountNum }));
    }

    onTrade(side, selectedAsset.id, amountNum, totalCost);
    setAmount('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Asset Selection */}
      <div className="lg:col-span-1">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 text-slate-200">Select Asset</h3>
          <div className="space-y-2">
            {assets.map((asset) => {
              const price = currentPrices[asset.id] || asset.price;
              const holding = holdings[asset.id] || 0;

              return (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className={`w-full p-3 rounded-lg border transition-all ${
                    selectedAsset.id === asset.id
                      ? 'bg-blue-500/20 border-blue-500'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={asset.icon} alt={asset.name} className="w-8 h-8 rounded-full" />
                      <div className="text-left">
                        <div className="font-semibold text-slate-200">{asset.id}</div>
                        <div className="text-xs text-slate-400">{asset.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-200">{formatPrice(price)}</div>
                      <div className="text-xs text-slate-400">{holding.toFixed(4)}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Trading Panel */}
      <div className="lg:col-span-2">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-slate-200">Spot Trading</h3>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
              <img src={selectedAsset.icon} alt={selectedAsset.name} className="w-6 h-6 rounded-full" />
              <span className="font-semibold text-slate-200">{selectedAsset.id}</span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-400">USD</span>
            </div>
          </div>

          {/* Buy/Sell Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setSide('BUY')}
              className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                side === 'BUY'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setSide('SELL')}
              className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                side === 'SELL'
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Sell
            </button>
          </div>

          {/* Price Display */}
          <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400">Current Price</span>
              <span className="text-2xl font-bold text-slate-200">{formatPrice(currentPrice)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">24h Change</span>
              <div className={`flex items-center gap-1 ${selectedAsset.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {selectedAsset.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="font-semibold">{selectedAsset.change.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Amount ({selectedAsset.id})
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400">Total Cost</span>
                <span className="text-xl font-bold text-slate-200">{formatPrice(totalCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Available</span>
                <span className="text-sm text-slate-400">
                  {side === 'BUY'
                    ? `${availableBalance.toFixed(2)} USD`
                    : `${availableBalance.toFixed(4)} ${selectedAsset.id}`
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[25, 50, 75, 100].map((percent) => (
              <button
                key={percent}
                onClick={() => {
                  if (side === 'BUY') {
                    const amt = (balance * percent / 100) / currentPrice;
                    setAmount(amt.toFixed(8));
                  } else {
                    const amt = (holdings[selectedAsset.id] || 0) * percent / 100;
                    setAmount(amt.toFixed(8));
                  }
                }}
                className="py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm font-medium transition-all"
              >
                {percent}%
              </button>
            ))}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
              side === 'BUY'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-rose-500 hover:bg-rose-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {side === 'BUY' ? 'Buy' : 'Sell'} {selectedAsset.id}
          </button>

          {/* Holdings Summary */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <h4 className="text-sm font-semibold text-slate-400 mb-3">Your Holdings</h4>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(holdings).map(([assetId, amount]) => (
                <div key={assetId} className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">{assetId}</div>
                  <div className="font-semibold text-slate-200">{amount.toFixed(4)}</div>
                  <div className="text-xs text-slate-400">
                    ≈ {formatPrice(amount * (currentPrices[assetId] || 0))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpotTrading;
