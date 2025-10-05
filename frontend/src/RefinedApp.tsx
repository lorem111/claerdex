import React, { useState, useEffect, createContext, useContext } from 'react';
import { Wallet, BarChart3 } from 'lucide-react';
import TradingChart from '@/components/TradingChart';

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
  HStack,
  Divider,
  useToast,
  Spinner,
  Badge,
} from '@chakra-ui/react';
import { BiTrendingUp, BiTrendingDown } from 'react-icons/bi';

// shadcn/ui Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Toaster } from "@/components/ui/toaster";

// Utilities
import { formatUSD, formatPrice, formatPnL, formatAE } from '@/utils/formatters';

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

// Chart data generation moved to TradingChart component

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
  const { account, balance, isConnecting, connectWallet, disconnectWallet } = useWeb3();

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

          <div className="flex items-center gap-4">
            {account && (
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/50 rounded-lg border border-slate-800">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Balance</p>
                  <p className="text-sm font-semibold text-white">{formatAE(balance)}</p>
                </div>
                <div className="h-8 w-px bg-slate-700" />
                <Badge colorScheme="green" className="px-3 py-1">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </Badge>
              </div>
            )}
            <Button
              onClick={account ? disconnectWallet : connectWallet}
              disabled={isConnecting}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
            >
              <Wallet className="w-4 h-4 mr-2" />
              {isConnecting ? "Connecting..." : account ? "Disconnect" : "Connect Wallet"}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Chart component moved to TradingChart.tsx

// CHAKRA TRADE PANEL (Refactored with collateral input)
function TradePanel({
  asset,
  onAssetChange,
  onOpenPosition,
  currentPrice
}: {
  asset: Asset;
  onAssetChange: (assetId: string) => void;
  onOpenPosition: (side: 'LONG' | 'SHORT', size: number, collateral: number, leverage: number) => void;
  currentPrice: number
}) {
  const { account, balance } = useWeb3();
  const toast = useToast();
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [collateral, setCollateral] = useState('100'); // User inputs collateral in AE
  const [leverage, setLeverage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate position size: collateral (AE) * oracle price (USD/AE) * leverage
  const collateralAE = parseFloat(collateral) || 0;
  const positionSize = collateralAE * currentPrice * leverage;
  const collateralUSD = collateralAE * currentPrice;

  const handleOpenPosition = () => {
    if (!account) {
      toast({ title: "Connect wallet first", status: "warning", duration: 3000 });
      return;
    }

    if (collateralAE > balance) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${formatAE(collateralAE)} but only have ${formatAE(balance)}`,
        status: "error",
        duration: 3000
      });
      return;
    }

    if (collateralAE === 0) {
      toast({ title: "Invalid collateral", status: "warning", duration: 3000 });
      return;
    }

    setIsLoading(true);
    // Simulate blockchain transaction
    setTimeout(() => {
      onOpenPosition(side, positionSize, collateralAE, leverage);
      setIsLoading(false);
      toast({
        title: 'Position Opened Successfully!',
        description: `${side} ${asset.id} position of ${formatUSD(positionSize)} opened at ${formatPrice(currentPrice)}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    }, 1500);
  };

  return (
    <VStack spacing={4} p={4} bg="gray.800" borderRadius="lg" h="100%" align="stretch">
      <Text fontSize="xl" fontWeight="bold">Trade {asset.id}</Text>

      <Select
        value={asset.id}
        onChange={(e) => onAssetChange(e.target.value)}
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
        <Text mb={1} fontSize="sm" color="gray.400">Collateral (AE)</Text>
        <Input
          placeholder="e.g., 100"
          value={collateral}
          onChange={(e) => setCollateral(e.target.value)}
          size="lg"
          textAlign="right"
          bg="gray.700"
          type="number"
        />
      </Box>

      <Box>
        <Text mb={1} fontSize="sm" color="gray.400">Leverage: {leverage}x</Text>
        <Slider
          value={leverage}
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
          <Text>Position Size:</Text>
          <Text fontWeight="bold">{formatUSD(positionSize)}</Text>
        </HStack>
        <HStack justify="space-between">
          <Text>Collateral (USD):</Text>
          <Text fontWeight="bold">{formatUSD(collateralUSD)}</Text>
        </HStack>
        <HStack justify="space-between">
          <Text>Liquidation Price (Est.):</Text>
          <Text fontWeight="bold">{formatPrice(currentPrice * (1 - 1/leverage))}</Text>
        </HStack>
        <HStack justify="space-between">
          <Text>Available Balance:</Text>
          <Text fontWeight="bold" color={account ? "white" : "gray.500"}>
            {account ? formatAE(balance) : "0.00 AE"}
          </Text>
        </HStack>
      </VStack>

      <ChakraButton
        colorScheme={side === 'LONG' ? 'green' : 'red'}
        size="lg"
        w="100%"
        isDisabled={!account || isLoading}
        onClick={handleOpenPosition}
        leftIcon={isLoading ? <Spinner size="sm" /> : undefined}
      >
        {!account ? 'Connect Wallet to Trade' : `Open ${side} Position`}
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
                  <TableCell className="text-white">{formatUSD(p.size)}</TableCell>
                  <TableCell className="text-white">{formatPrice(p.entryPrice)}</TableCell>
                  <TableCell className="text-white">{formatPrice(p.liqPrice)}</TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatPnL(p.pnl)}
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

  // Live price feed simulation
  useEffect(() => {
    const priceInterval = setInterval(() => {
      setCurrentPrices(prev => {
        const newPrices = { ...prev };
        for (const asset of ASSETS) {
          const volatility = 0.0005; // 0.05% volatility per tick
          newPrices[asset.id] *= 1 + (Math.random() - 0.5) * volatility;
        }
        return newPrices;
      });
    }, 2000); // Update every 2 seconds
    return () => clearInterval(priceInterval);
  }, []);

  const handleAssetChange = (assetId: string) => {
    const asset = ASSETS.find(a => a.id === assetId);
    if (asset) {
      setSelectedAsset(asset);
    }
  };

  const handleOpenPosition = (side: 'LONG' | 'SHORT', size: number, collateral: number, leverage: number) => {
    const currentPrice = currentPrices[selectedAsset.id];
    const liqPrice = side === 'LONG'
      ? currentPrice * (1 - (1 / leverage) * 0.9) // 90% of margin
      : currentPrice * (1 + (1 / leverage) * 0.9);

    const newPosition: Position = {
      id: Date.now(),
      asset: selectedAsset,
      side,
      size,
      collateral,
      entryPrice: currentPrice,
      liqPrice,
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
              <Card className="bg-slate-900/50 border-slate-800 shadow-xl overflow-hidden">
                <TradingChart
                  asset={selectedAsset}
                  currentPrice={currentPrices[selectedAsset.id]}
                  positions={positions}
                />
              </Card>
              <PositionsPanel positions={positions} currentPrices={currentPrices} />
            </div>
            <div className="lg:col-span-1">
              <TradePanel
                asset={selectedAsset}
                onAssetChange={handleAssetChange}
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
