import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Wallet, BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import TradingChart from '@/components/TradingChart';
import SpotTrading from '@/components/SpotTrading';
import StocksTrading from '@/components/StocksTrading';

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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Utilities
import { formatUSD, formatPrice, formatPnL, formatPercentage, formatAE } from '@/utils/formatters';
import { connectSuperheroWallet } from '@/utils/wallet';
import { fetchAccountState, openPosition as openPositionAPI, closePosition as closePositionAPI, BackendAccount, BackendPosition } from '@/utils/api';
import { getCachedPrices, cachePrices, CachedPriceData } from '@/utils/priceCache';

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
  availableCollateral: number;
  backendPositions: BackendPosition[];
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshAccountState: () => Promise<void>;
};

// API Configuration
const PRICE_API_URL = 'https://claerdex-backend.vercel.app/prices';
const BLOCKCHAIN_STATUS_URL = 'https://claerdex-backend.vercel.app/blockchain/status';

// ASSETS (price will be fetched from API - these are just placeholders for initial load)
const ASSETS: Asset[] = [
  { id: 'AE', name: 'Aeternity', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1700.png', price: 0.0075, change: 0 },
  { id: 'BTC', name: 'Bitcoin', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png', price: 123000, change: 0 },
  { id: 'ETH', name: 'Ethereum', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png', price: 4500, change: 0 },
  { id: 'SOL', name: 'Solana', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png', price: 230, change: 0 },
];

// Chart data generation moved to TradingChart component

// WEB3 CONTEXT
const Web3Context = createContext<Web3ContextType>({
  account: null,
  balance: 0,
  availableCollateral: 0,
  backendPositions: [],
  isConnecting: false,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  refreshAccountState: async () => {},
});

const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [availableCollateral, setAvailableCollateral] = useState(0);
  const [backendPositions, setBackendPositions] = useState<BackendPosition[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const toast = useToast();

  // Fetch account state from backend - memoized to prevent infinite re-renders
  const refreshAccountState = useCallback(async () => {
    if (!account) return;

    try {
      console.log('[ACCOUNT REFRESH] Fetching account state from backend for:', account);
      const accountState = await fetchAccountState(account);

      setBalance(accountState.on_chain_balance_ae);
      setAvailableCollateral(accountState.available_collateral_ae);
      setBackendPositions(accountState.positions);

      console.log('[ACCOUNT REFRESH] ✓ Account state loaded:', {
        balance: accountState.on_chain_balance_ae,
        availableCollateral: accountState.available_collateral_ae,
        positionsCount: accountState.positions.length,
        positions: accountState.positions
      });
    } catch (error) {
      console.error('[ACCOUNT REFRESH] ✗ Failed to fetch account state:', error);
      // Don't show error toast on periodic refresh failures
    }
  }, [account]);

  const connectWallet = async () => {
    setIsConnecting(true);

    try {
      // Try to connect to real Superhero Wallet
      const walletInfo = await connectSuperheroWallet();
      setAccount(walletInfo.address);
      setBalance(walletInfo.balance);

      toast({
        title: 'Wallet Connected!',
        description: `Connected to ${walletInfo.address.slice(0, 10)}...`,
        status: 'success',
        duration: 3000,
      });

      // Fetch account state from backend after connecting
      setIsConnecting(false);

      // Small delay to let the state update
      setTimeout(async () => {
        try {
          const accountState = await fetchAccountState(walletInfo.address);
          setBalance(accountState.on_chain_balance_ae);
          setAvailableCollateral(accountState.available_collateral_ae);
          setBackendPositions(accountState.positions);
          console.log('Backend account state loaded:', accountState);
        } catch (error) {
          console.error('Failed to load account from backend:', error);
          // Set fallback values
          setAvailableCollateral(walletInfo.balance);
        }
      }, 100);

    } catch (error) {
      console.error('Wallet connection error:', error);

      // Show error message
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect wallet. Using demo mode.',
        status: 'warning',
        duration: 5000,
      });

      // Fall back to mock wallet
      await new Promise(resolve => setTimeout(resolve, 500));
      const mockAddress = "ak_demo" + Math.random().toString(36).substring(2, 10);
      setAccount(mockAddress);
      setBalance(1500.75);
      setAvailableCollateral(1500.75);

      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setBalance(0);
    setAvailableCollateral(0);
    setBackendPositions([]);

    toast({
      title: 'Wallet Disconnected',
      status: 'info',
      duration: 2000,
    });
  };

  return (
    <Web3Context.Provider value={{
      account,
      balance,
      availableCollateral,
      backendPositions,
      isConnecting,
      connectWallet,
      disconnectWallet,
      refreshAccountState
    }}>
      {children}
    </Web3Context.Provider>
  );
};

const useWeb3 = () => useContext(Web3Context);

// HEADER COMPONENT
function Header() {
  const { account, balance, isConnecting, connectWallet, disconnectWallet } = useWeb3();
  const [currentBlock, setCurrentBlock] = useState(0);
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('mainnet');

  // Fetch block number from API
  useEffect(() => {
    const fetchBlockNumber = async () => {
      try {
        const response = await fetch(BLOCKCHAIN_STATUS_URL);
        const data = await response.json();
        if (data.latest_block?.height) {
          setCurrentBlock(data.latest_block.height);
        }
      } catch (error) {
        console.error('Failed to fetch block number:', error);
      }
    };

    fetchBlockNumber(); // Initial fetch
    const interval = setInterval(fetchBlockNumber, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg blur-sm opacity-50"></div>
                <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Claer</h1>
                <p className="text-xs text-slate-400">Hybrid Perpetual DEX</p>
              </div>
            </div>

            {/* Block Number */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-md border border-slate-800">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-slate-400">Block</span>
              <span className="text-sm font-semibold text-white">{currentBlock.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Network Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">Network:</span>
              <button
                onClick={() => setNetwork(network === 'mainnet' ? 'testnet' : 'mainnet')}
                className="relative inline-flex items-center gap-2 px-3 py-1 rounded-md transition-all duration-200 hover:bg-slate-800"
              >
                <div className={`w-2 h-2 rounded-full ${network === 'mainnet' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className={`text-sm font-semibold ${network === 'mainnet' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                </span>
              </button>
            </div>

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
  const { account, availableCollateral, refreshAccountState } = useWeb3();
  const toast = useToast();
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [collateral, setCollateral] = useState('100'); // User inputs collateral in AE
  const [leverage, setLeverage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate position size: collateral (AE) * oracle price (USD/AE) * leverage
  const collateralAE = parseFloat(collateral) || 0;
  const positionSize = collateralAE * currentPrice * leverage;
  const collateralUSD = collateralAE * currentPrice;

  const handleOpenPosition = async () => {
    if (!account) {
      toast({ title: "Connect wallet first", status: "warning", duration: 3000 });
      return;
    }

    if (collateralAE > availableCollateral) {
      toast({
        title: "Insufficient Collateral",
        description: `You need ${formatAE(collateralAE)} but only have ${formatAE(availableCollateral)} available`,
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

    try {
      // Call backend API to open position
      console.log('[TRADE] Opening position:', { asset: asset.id, side, collateral: collateralAE, leverage });
      const response = await openPositionAPI({
        user_address: account,
        asset: asset.id,
        side: side.toLowerCase() as 'long' | 'short',
        collateral_to_use_ae: collateralAE,
        leverage: leverage,
      });
      console.log('[TRADE] ✓ Position opened on backend:', response);

      // Refresh account state to get updated positions and balance
      console.log('[TRADE] Refreshing account state to get new position...');
      await refreshAccountState();
      console.log('[TRADE] ✓ Account state refreshed');

      // Call the parent handler for UI updates
      onOpenPosition(side, positionSize, collateralAE, leverage);

      toast({
        title: 'Position Opened!',
        description: `${side} ${asset.id} position of ${formatUSD(positionSize)} opened at ${formatPrice(currentPrice)}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      console.log('[TRADE] Position opened on-chain:', response.on_chain_tx);
    } catch (error) {
      console.error('Failed to open position:', error);
      toast({
        title: 'Failed to Open Position',
        description: error instanceof Error ? error.message : 'An error occurred',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
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
          <Text>Available Collateral:</Text>
          <Text fontWeight="bold" color={account ? "white" : "gray.500"}>
            {account ? formatAE(availableCollateral) : "0.00 AE"}
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

// PORTFOLIO VIEW
function PortfolioView({ positions, balance }: { positions: Position[]; balance: number }) {
  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalCollateral = positions.reduce((sum, p) => sum + p.collateral, 0);
  const totalPositionValue = positions.reduce((sum, p) => sum + p.size, 0);

  return (
    <div className="space-y-6">
      {/* Account Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Account Balance</p>
                <p className="text-2xl font-bold text-white mt-1">{formatAE(balance)}</p>
              </div>
              <Wallet className="w-8 h-8 text-slate-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Unrealized PnL</p>
                <p className={`text-2xl font-bold mt-1 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatPnL(totalPnL)}
                </p>
              </div>
              {totalPnL >= 0 ? (
                <TrendingUp className="w-8 h-8 text-emerald-600" />
              ) : (
                <TrendingDown className="w-8 h-8 text-rose-600" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Open Positions</p>
                <p className="text-2xl font-bold text-white mt-1">{positions.length}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {formatUSD(totalPositionValue)} total value
                </p>
              </div>
              <Activity className="w-8 h-8 text-slate-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Positions Breakdown */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Position Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-lg mb-2">No open positions</p>
              <p className="text-sm">Open a position to start trading</p>
            </div>
          ) : (
            <div className="space-y-3">
              {positions.map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <img src={p.asset.icon} alt={p.asset.id} className="w-10 h-10 rounded-full" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{p.asset.id}/USD</span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          p.side === 'LONG'
                            ? 'bg-emerald-900/50 text-emerald-300'
                            : 'bg-rose-900/50 text-rose-300'
                        }`}>
                          {p.side}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        Size: {formatUSD(p.size)} • Collateral: {formatAE(p.collateral)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatPnL(p.pnl)}
                    </p>
                    <p className="text-sm text-slate-500">Entry: {formatPrice(p.entryPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// POSITIONS TABLE
function PositionsPanel({
  positions,
  currentPrices,
  onClosePosition
}: {
  positions: Position[];
  currentPrices: Record<string, number>;
  onClosePosition: (id: number) => void;
}) {
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
              <TableHead className="text-right text-slate-400">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {livePositions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-8">
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
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onClosePosition(p.id)}
                      className="text-rose-400 border-rose-800 hover:bg-rose-900/20 hover:text-rose-300"
                    >
                      Close
                    </Button>
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
  const toast = useToast();
  const { balance, backendPositions, account, refreshAccountState } = useWeb3();
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>(
    ASSETS.reduce((acc, asset) => ({ ...acc, [asset.id]: asset.price }), {})
  );
  const [priceChanges, setPriceChanges] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState('perpetuals');

  // Fetch real prices from API with instant cache-first loading
  const fetchPrices = async (skipCache = false) => {
    try {
      // INSTANT LOAD: Check cache first (no network delay!)
      if (!skipCache) {
        const cached = getCachedPrices();
        if (cached && cached.data) {
          // Extract prices from cached data
          const cachedPrices: Record<string, number> = {};
          const cachedChanges: Record<string, number> = {};

          Object.keys(cached.data).forEach(assetId => {
            cachedPrices[assetId] = cached.data[assetId].price;
            cachedChanges[assetId] = cached.data[assetId].change_percent_24h || 0;
          });

          // Display cached prices IMMEDIATELY
          setCurrentPrices(cachedPrices);
          setPriceChanges(cachedChanges);
        }
      }

      // BACKGROUND REFRESH: Fetch fresh data (this happens in background)
      // Add cache-busting timestamp to force fresh data
      const response = await fetch(`${PRICE_API_URL}?t=${Date.now()}`);
      const responseData = await response.json();

      // Cache the fresh data for next instant load
      cachePrices(responseData);

      // Handle new API format with 24h stats
      const data = responseData.data || responseData;

      // Extract prices and 24h changes
      const newPrices: Record<string, number> = {};
      const newChanges: Record<string, number> = {};

      Object.keys(data).forEach(assetId => {
        if (typeof data[assetId] === 'object') {
          // New format: {data: {AE: {price: 0.03, change_percent_24h: 2.15, ...}}}
          let price = data[assetId].price;

          // Force tiny price change if price is exactly the same
          const oldPrice = currentPrices[assetId];
          if (oldPrice && price === oldPrice) {
            // Add 0.00001% variation to show movement
            const variation = price * 0.0000001 * (Math.random() > 0.5 ? 1 : -1);
            price = price + variation;
          }

          newPrices[assetId] = price;
          newChanges[assetId] = data[assetId].change_percent_24h || 0;
        } else {
          // Old format: {AE: 0.03, BTC: 68000, ...}
          let price = data[assetId];

          // Force tiny price change if price is exactly the same
          const oldPrice = currentPrices[assetId];
          if (oldPrice && price === oldPrice) {
            const variation = price * 0.0000001 * (Math.random() > 0.5 ? 1 : -1);
            price = price + variation;
          }

          newPrices[assetId] = price;
          // Calculate change based on difference from previous price
          const percentChange = ((price - (oldPrice || price)) / (oldPrice || price)) * 100;
          newChanges[assetId] = priceChanges[assetId] ? (priceChanges[assetId] * 0.9 + percentChange * 0.1) : 0;
        }
      });

      setCurrentPrices(newPrices);
      setPriceChanges(newChanges);
    } catch (error) {
      console.error('[PRICES] ✗ Failed to fetch prices:', error);
    }
  };

  // Fetch prices on mount and every 3 seconds
  useEffect(() => {
    fetchPrices(); // Initial fetch
    const priceInterval = setInterval(fetchPrices, 3000); // Update every 3 seconds
    return () => clearInterval(priceInterval);
  }, []);

  // Refresh account state periodically for real-time PnL updates
  useEffect(() => {
    if (!account) return;

    // Refresh every 10 seconds when connected
    const accountInterval = setInterval(() => {
      refreshAccountState();
    }, 10000);

    return () => clearInterval(accountInterval);
  }, [account, refreshAccountState]);

  // Sync backend positions to local positions for display
  useEffect(() => {
    // Convert backend positions to frontend Position type
    // Handle both empty and non-empty arrays
    const convertedPositions: Position[] = backendPositions.map((bp, index) => {
      const asset = ASSETS.find(a => a.id === bp.asset) || ASSETS[0];

      // Generate a stable numeric ID from UUID using hash
      // This ensures the ID is always the same for a given UUID
      const numericId = bp.id.split('').reduce((acc, char) => {
        return acc + char.charCodeAt(0);
      }, 0);

      return {
        id: numericId,
        asset: {
          ...asset,
          price: bp.current_price || currentPrices[bp.asset] || asset.price,
        },
        side: bp.side.toUpperCase() as 'LONG' | 'SHORT',
        size: bp.size_usd,
        collateral: bp.collateral_ae,
        entryPrice: bp.entry_price,
        liqPrice: bp.liquidation_price,
        pnl: bp.unrealized_pnl_usd || 0,
      };
    });

    setPositions(convertedPositions);
  }, [backendPositions, currentPrices]);

  const handleAssetChange = (assetId: string) => {
    const asset = ASSETS.find(a => a.id === assetId);
    if (asset) {
      // Update asset with current price
      setSelectedAsset({
        ...asset,
        price: currentPrices[assetId] || asset.price,
        change: priceChanges[assetId] || 0,
      });
    }
  };

  const handleOpenPosition = (side: 'LONG' | 'SHORT', size: number, collateral: number, leverage: number) => {
    // Position is already created on backend and will be synced via backendPositions
    // This is just a callback for any additional UI updates if needed
    console.log('Position opened via backend:', { side, size, collateral, leverage });
  };

  const handleClosePosition = async (id: number) => {
    if (!account) {
      toast({ title: "Please connect wallet", status: "warning", duration: 3000 });
      return;
    }

    const position = positions.find(p => p.id === id);
    if (!position) return;

    try {
      console.log('[CLOSE] Closing position:', { id, position });

      // Find the backend position by matching the hashed numeric ID
      const backendPosition = backendPositions.find(bp => {
        const numericId = bp.id.split('').reduce((acc, char) => {
          return acc + char.charCodeAt(0);
        }, 0);
        return numericId === id;
      });

      if (!backendPosition) {
        throw new Error('Position not found in backend');
      }

      // Call backend API to close position
      console.log('[CLOSE] Closing position on backend:', backendPosition.id);
      const response = await closePositionAPI(account, backendPosition.id);
      console.log('[CLOSE] ✓ Position closed on backend:', response);

      // Refresh account state to get updated positions and balance
      console.log('[CLOSE] Refreshing account state...');
      await refreshAccountState();
      console.log('[CLOSE] ✓ Account state refreshed');

      toast({
        title: 'Position Closed',
        description: `${position.side} ${position.asset.id} position closed. PnL: ${formatPnL(response.realized_pnl_ae)} AE`,
        status: response.realized_pnl_ae >= 0 ? 'success' : 'warning',
        duration: 4000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Failed to close position:', error);
      toast({
        title: 'Failed to Close Position',
        description: error instanceof Error ? error.message : 'An error occurred',
        status: 'error',
        duration: 5000,
      });
    }
  };

  return (
    <Web3Provider>
      <Toaster />
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Header />

        {/* Navigation Tabs */}
        <div className="border-b border-slate-800 bg-slate-950/95">
          <div className="container mx-auto px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-transparent border-0 h-12 gap-6">
                <TabsTrigger
                  value="spot"
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent rounded-none px-4 text-slate-400 data-[state=active]:text-white font-medium"
                >
                  Spot
                </TabsTrigger>
                <TabsTrigger
                  value="stocks"
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent rounded-none px-4 text-slate-400 data-[state=active]:text-white font-medium"
                >
                  Stocks
                </TabsTrigger>
                <TabsTrigger
                  value="perpetuals"
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent rounded-none px-4 text-slate-400 data-[state=active]:text-white font-medium"
                >
                  Perpetuals
                </TabsTrigger>
                <TabsTrigger
                  value="portfolio"
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent rounded-none px-4 text-slate-400 data-[state=active]:text-white font-medium"
                >
                  Portfolio
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <main className="container mx-auto px-6 py-6">
          {activeTab === 'portfolio' ? (
            <PortfolioView positions={positions} balance={balance} />
          ) : activeTab === 'spot' ? (
            <SpotTrading
              assets={ASSETS}
              currentPrices={currentPrices}
              balance={balance}
              onTrade={(side, asset, amount, totalCost) => {
                console.log(`[SPOT] ${side} ${amount} ${asset} for ${totalCost} USD`);
                toast({
                  title: `${side} Order Placed`,
                  description: `${side === 'BUY' ? 'Bought' : 'Sold'} ${amount} ${asset} for $${totalCost.toFixed(2)}`,
                });
              }}
            />
          ) : activeTab === 'stocks' ? (
            <StocksTrading
              balance={balance}
              onOpenPosition={(position) => {
                console.log('[STOCKS] Opening position:', position);
                toast({
                  title: 'Position Opened',
                  description: `${position.side} ${position.stock.symbol} with ${position.leverage}x leverage`,
                });
              }}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Chart Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <img src={selectedAsset.icon} alt={selectedAsset.name} className="w-12 h-12 rounded-full" />
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedAsset.id}/USD</h2>
                      <p className="text-sm text-slate-400">{selectedAsset.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">{formatPrice(currentPrices[selectedAsset.id] || selectedAsset.price)}</div>
                    <div className={`text-sm font-semibold flex items-center justify-end gap-1 ${(priceChanges[selectedAsset.id] || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {(priceChanges[selectedAsset.id] || 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {formatPercentage(priceChanges[selectedAsset.id] || 0)} (live)
                    </div>
                  </div>
                </div>

                {/* Oracle Badge */}
                <div className="flex items-center gap-2 text-xs text-slate-500 -mt-3">
                  <Activity className="w-3 h-3" />
                  <span>Live Oracle Price • Powered by Aeternity</span>
                </div>

                {/* Chart */}
                <Card className="bg-slate-900/50 border-slate-800 shadow-xl overflow-hidden">
                  <TradingChart
                    asset={selectedAsset}
                    currentPrice={currentPrices[selectedAsset.id]}
                    positions={positions}
                  />
                </Card>
                <PositionsPanel positions={positions} currentPrices={currentPrices} onClosePosition={handleClosePosition} />
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
          )}
        </main>
      </div>
    </Web3Provider>
  );
}
