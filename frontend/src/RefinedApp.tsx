import React, { useState, useEffect, createContext, useContext } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';

// Chakra UI for Trade Panel
import {
  Box,
  VStack,
  Text,
  Button as ChakraButton,
  Select,
  Input,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Tag,
  HStack,
  Divider,
  useToast,
} from '@chakra-ui/react';
import { BiTrendingUp, BiTrendingDown } from 'react-icons/bi';

// shadcn/ui Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useToast as useShadcnToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

// TYPES
type Asset = {
  id: string;
  name: string;
  icon: string;
  price: number;
  change: number;
};

type Position = {
  id: number;
  asset: Asset;
  side: 'LONG' | 'SHORT';
  size: number;
  collateral: number;
  entryPrice: number;
  liqPrice: number;
  pnl: number;
};

type Web3ContextType = {
  account: string | null;
  balance: number;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
};

// MOCK DATA
const ASSETS: Asset[] = [
  { id: 'AE', name: 'Aeternity', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1700.png', price: 0.035, change: 2.15 },
  { id: 'BTC', name: 'Bitcoin', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png', price: 68420.50, change: -1.23 },
  { id: 'ETH', name: 'Ethereum', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png', price: 3560.78, change: 0.45 },
  { id: 'SOL', name: 'Solana', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png', price: 165.21, change: 3.89 },
];

const generateChartData = () => {
  let data = [];
  let value = 1000;
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (30 - i));
    value += (Math.random() - 0.5) * 50;
    data.push({
      name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: value
    });
  }
  return data;
};

// WEB3 CONTEXT
const Web3Context = createContext<Web3ContextType>({
  account: null,
  balance: 0,
  isConnecting: false,
  connectWallet: async () => {},
  disconnectWallet: () => {},
});

const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async () => {
    setIsConnecting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const mockAddress = "ak_2a1j2h" + Math.random().toString(36).substring(2, 10);
    setAccount(mockAddress);
    setBalance(1500.75);
    setIsConnecting(false);
  };

  const disconnectWallet = () => {
    setAccount(null);
    setBalance(0);
  };

  return (
    <Web3Context.Provider value={{ account, balance, isConnecting, connectWallet, disconnectWallet }}>
      {children}
    </Web3Context.Provider>
  );
};

const useWeb3 = () => useContext(Web3Context);

// HEADER COMPONENT
function Header() {
  const { account, isConnecting, connectWallet, disconnectWallet } = useWeb3();

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Claer</h1>
              <p className="text-xs text-slate-400">Hybrid Perpetual DEX</p>
            </div>
          </div>

          <Button
            onClick={account ? disconnectWallet : connectWallet}
            disabled={isConnecting}
            className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
          >
            <Wallet className="w-4 h-4 mr-2" />
            {isConnecting ? "Connecting..." : account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
          </Button>
        </div>
      </div>
    </header>
  );
}

// CHART & STATS COMPONENT
function ChartPanel({ asset, currentPrice }: { asset: Asset; currentPrice: number }) {
  const [chartData, setChartData] = useState(generateChartData());

  useEffect(() => {
    const newData = generateChartData();
    newData[newData.length - 1].value = currentPrice * 28000; // Scale for visualization
    setChartData(newData);
  }, [asset, currentPrice]);

  return (
    <Card className="bg-slate-900/50 border-slate-800 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={asset.icon} alt={asset.name} className="w-10 h-10 rounded-full" />
            <div>
              <CardTitle className="text-2xl font-bold text-white">{asset.id}/USD</CardTitle>
              <p className="text-sm text-slate-400">{asset.name}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className={`text-sm font-semibold flex items-center justify-end gap-1 ${asset.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {asset.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {asset.change >= 0 ? '+' : ''}{asset.change.toFixed(2)}% (24h)
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Activity className="w-3 h-3" />
          <span>Live Oracle Price • Powered by Aeternity</span>
        </div>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={asset.change >= 0 ? "#10B981" : "#F43F5E"} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={asset.change >= 0 ? "#10B981" : "#F43F5E"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <YAxis
                stroke="#64748b"
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                style={{ fontSize: '12px' }}
              />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                labelStyle={{ color: '#cbd5e1' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={asset.change >= 0 ? "#10B981" : "#F43F5E"}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// CHAKRA TRADE PANEL (from original)
function TradePanel({ asset, onOpenPosition, currentPrice }: { asset: Asset; onOpenPosition: (side: 'LONG' | 'SHORT', size: number, leverage: number) => void; currentPrice: number }) {
  const { account, balance } = useWeb3();
  const toast = useToast();
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [size, setSize] = useState('1000');
  const [leverage, setLeverage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  const collateralNeeded = (parseFloat(size) || 0) / leverage;

  const handleOpenPosition = () => {
    if (!account) {
      toast({ title: "Connect wallet first", status: "warning", duration: 3000 });
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      onOpenPosition(side, parseFloat(size), leverage);
      setIsLoading(false);
      toast({
        title: 'Position Opened!',
        description: `${side} ${asset.id} position of $${size} opened at $${currentPrice.toLocaleString()}`,
        status: 'success',
        duration: 5000,
      });
    }, 1500);
  };

  return (
    <VStack spacing={4} p={4} bg="gray.800" borderRadius="lg" h="100%" align="stretch">
      <Text fontSize="xl" fontWeight="bold">Trade {asset.id}</Text>

      <Select
        value={asset.id}
        size="lg"
        bg="gray.700"
      >
        {ASSETS.map(a => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </Select>

      <HStack>
        <ChakraButton
          w="50%"
          colorScheme={side === 'LONG' ? 'green' : 'gray'}
          onClick={() => setSide('LONG')}
          leftIcon={<BiTrendingUp size="1.5em" />}
        >
          Long
        </ChakraButton>
        <ChakraButton
          w="50%"
          colorScheme={side === 'SHORT' ? 'red' : 'gray'}
          onClick={() => setSide('SHORT')}
          leftIcon={<BiTrendingDown size="1.5em" />}
        >
          Short
        </ChakraButton>
      </HStack>

      <Box>
        <Text mb={1} fontSize="sm" color="gray.400">Position Size (USD)</Text>
        <Input
          placeholder="e.g., 1000"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          size="lg"
          textAlign="right"
          bg="gray.700"
        />
      </Box>

      <Box>
        <Text mb={1} fontSize="sm" color="gray.400">Leverage: {leverage}x</Text>
        <Slider
          defaultValue={10}
          min={1}
          max={50}
          step={1}
          onChange={(val) => setLeverage(val)}
        >
          <SliderTrack>
            <SliderFilledTrack bg="cyan.400" />
          </SliderTrack>
          <SliderThumb />
        </Slider>
      </Box>

      <Divider />

      <VStack spacing={1} align="stretch" fontSize="sm" color="gray.300">
        <HStack justify="space-between">
          <Text>Collateral Needed:</Text>
          <Text fontWeight="bold">{collateralNeeded.toFixed(2)} USD</Text>
        </HStack>
        <HStack justify="space-between">
          <Text>Liquidation Price (Est.):</Text>
          <Text fontWeight="bold">${(currentPrice * (1 - 1/leverage)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
        </HStack>
        <HStack justify="space-between">
          <Text>Available Balance:</Text>
          <Text fontWeight="bold">{balance.toFixed(2)} AE</Text>
        </HStack>
      </VStack>

      <ChakraButton
        colorScheme={side === 'LONG' ? 'green' : 'red'}
        size="lg"
        w="100%"
        isDisabled={!account || isLoading}
        isLoading={isLoading}
        onClick={handleOpenPosition}
      >
        {account ? `Open ${side} Position` : 'Connect Wallet to Trade'}
      </ChakraButton>
    </VStack>
  );
}

// POSITIONS TABLE
function PositionsPanel({ positions, currentPrices }: { positions: Position[]; currentPrices: Record<string, number> }) {
  const [livePositions, setLivePositions] = useState(positions);

  useEffect(() => {
    setLivePositions(positions);
  }, [positions]);

  useEffect(() => {
    if (livePositions.length === 0) return;

    const interval = setInterval(() => {
      setLivePositions(prev =>
        prev.map(p => {
          const currentPrice = currentPrices[p.asset.id];
          const priceChange = currentPrice - p.entryPrice;
          const pnl = p.side === 'LONG' ? priceChange * (p.size / p.entryPrice) : -priceChange * (p.size / p.entryPrice);
          return { ...p, pnl };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [livePositions.length, currentPrices]);

  return (
    <Card className="bg-slate-900/50 border-slate-800 shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-white">Open Positions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-slate-800/50">
              <TableHead className="text-slate-400">Asset</TableHead>
              <TableHead className="text-slate-400">Side</TableHead>
              <TableHead className="text-slate-400">Size</TableHead>
              <TableHead className="text-slate-400">Entry Price</TableHead>
              <TableHead className="text-slate-400">Liq. Price</TableHead>
              <TableHead className="text-right text-slate-400">Unrealized PnL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {livePositions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                  No open positions. Open a position to get started.
                </TableCell>
              </TableRow>
            ) : (
              livePositions.map(p => (
                <TableRow key={p.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <TableCell className="font-medium text-white">
                    <div className="flex items-center gap-2">
                      <img src={p.asset.icon} alt={p.asset.id} className="w-6 h-6 rounded-full" />
                      {p.asset.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      p.side === 'LONG'
                        ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                        : 'bg-rose-900/50 text-rose-300 border border-rose-700'
                    }`}>
                      {p.side}
                    </span>
                  </TableCell>
                  <TableCell className="text-white">${p.size.toLocaleString()}</TableCell>
                  <TableCell className="text-white">${p.entryPrice.toLocaleString()}</TableCell>
                  <TableCell className="text-white">${p.liqPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// MAIN APP
export default function RefinedApp() {
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>(
    ASSETS.reduce((acc, asset) => ({ ...acc, [asset.id]: asset.price }), {})
  );

  useEffect(() => {
    const priceInterval = setInterval(() => {
      setCurrentPrices(prev => {
        const newPrices = { ...prev };
        for (const asset of ASSETS) {
          const volatility = 0.0001;
          newPrices[asset.id] *= 1 + (Math.random() - 0.5) * volatility;
        }
        return newPrices;
      });
    }, 1000);
    return () => clearInterval(priceInterval);
  }, []);

  const handleOpenPosition = (side: 'LONG' | 'SHORT', size: number, leverage: number) => {
    const currentPrice = currentPrices[selectedAsset.id];
    const newPosition: Position = {
      id: Date.now(),
      asset: selectedAsset,
      side,
      size,
      collateral: size / leverage,
      entryPrice: currentPrice,
      liqPrice: currentPrice * (1 - 1/leverage),
      pnl: 0,
    };
    setPositions(prev => [...prev, newPosition]);
  };

  return (
    <Web3Provider>
      <Toaster />
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Header />
        <main className="container mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ChartPanel asset={selectedAsset} currentPrice={currentPrices[selectedAsset.id]} />
              <PositionsPanel positions={positions} currentPrices={currentPrices} />
            </div>
            <div className="lg:col-span-1">
              <TradePanel
                asset={selectedAsset}
                onOpenPosition={handleOpenPosition}
                currentPrice={currentPrices[selectedAsset.id]}
              />
            </div>
          </div>
        </main>
      </div>
    </Web3Provider>
  );
}
