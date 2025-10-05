import React, { useState, useEffect, createContext, useContext } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, HelpCircle, ChevronDown, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

// Shadcn UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"

// TYPES //
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
  side: 'long' | 'short';
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

// MOCK DATA & CONFIGURATION //
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
    data.push({ name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), uv: value });
  }
  return data;
};

// WEB3 CONTEXT & PROVIDER //
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
    const mockAddress = "ak_" + "2a1j2h" + Math.random().toString(36).substring(2, 10) + "..." + Math.random().toString(36).substring(2, 10);
    setAccount(mockAddress);
    setBalance(1000);
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

// MAIN LAYOUT COMPONENTS //
function Header() {
  const { account, isConnecting, connectWallet, disconnectWallet } = useWeb3();

  return (
    <header className="flex items-center justify-between p-4 border-b border-slate-800">
      <div className="flex items-center gap-2">
        <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 0L95.2641 25V75L50 100L4.73594 75V25L50 0Z" fill="#1C1C1E"/>
            <path d="M50 8.33331L12.5 29.1666V70.8333L50 91.6666L87.5 70.8333V29.1666L50 8.33331Z" stroke="url(#paint0_linear_header)" strokeWidth="5"/>
            <path d="M37.5 50L50 25L62.5 50L50 75L37.5 50Z" stroke="url(#paint1_linear_header)" strokeWidth="5"/>
            <defs>
                <linearGradient id="paint0_linear_header" x1="50" y1="8.33331" x2="50" y2="91.6666" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F03D81"/>
                    <stop offset="1" stopColor="#9C27B0"/>
                </linearGradient>
                <linearGradient id="paint1_linear_header" x1="50" y1="25" x2="50" y2="75" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F03D81"/>
                    <stop offset="1" stopColor="#9C27B0"/>
                </linearGradient>
            </defs>
        </svg>
        <h1 className="text-xl font-bold text-white">Claer</h1>
      </div>
      <Button onClick={account ? disconnectWallet : connectWallet} disabled={isConnecting}>
        <Wallet className="w-4 h-4 mr-2" />
        {isConnecting ? "Connecting..." : account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
      </Button>
    </header>
  );
}

// DASHBOARD COMPONENTS //
function AssetSelector({ selectedAsset, setSelectedAsset }: { selectedAsset: Asset; setSelectedAsset: (asset: Asset) => void }) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-[200px] justify-between bg-slate-900 border-slate-700 hover:bg-slate-800">
                    <div className="flex items-center gap-2">
                        <img src={selectedAsset.icon} alt={selectedAsset.name} className="w-6 h-6" />
                        {selectedAsset.name}
                    </div>
                    <ChevronDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder="Search asset..." />
                    <CommandEmpty>No asset found.</CommandEmpty>
                    <CommandGroup>
                        {ASSETS.map((asset) => (
                            <CommandItem
                                key={asset.id}
                                onSelect={() => {
                                    setSelectedAsset(asset);
                                    setOpen(false);
                                }}
                            >
                               <img src={asset.icon} alt={asset.name} className="w-5 h-5 mr-2" />
                                {asset.name}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function StatsBar({ asset }: { asset: Asset }) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-6">
            <div className="flex flex-col">
                <span className="text-xs text-slate-400">Oracle Price ({asset.id})</span>
                <span className="text-lg font-semibold text-white">${asset.price.toLocaleString()}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-xs text-slate-400">24h Change</span>
                <span className={`text-lg font-semibold ${asset.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {asset.change.toFixed(2)}%
                </span>
            </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
            <HelpCircle className="w-4 h-4" />
            <span>Powered by Aeternity Oracles</span>
        </div>
    </div>
  );
}

function ChartPanel({ asset }: { asset: Asset }) {
  const [chartData, setChartData] = useState(generateChartData());

  useEffect(() => {
    setChartData(generateChartData());
  }, [asset]);

  return (
    <Card className="h-[400px] bg-slate-900/50 border-slate-800 flex flex-col">
      <CardHeader>
          <StatsBar asset={asset} />
      </CardHeader>
      <CardContent className="flex-grow">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <defs>
                <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={asset.change >= 0 ? "#10B981" : "#F43F5E"} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={asset.change >= 0 ? "#10B981" : "#F43F5E"} stopOpacity={0}/>
                </linearGradient>
            </defs>
            <YAxis stroke="#64748b" tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`} />
            <XAxis dataKey="name" stroke="#64748b" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <Area type="monotone" dataKey="uv" stroke={asset.change >= 0 ? "#10B981" : "#F43F5E"} fillOpacity={1} fill="url(#colorUv)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function TradePanel({ asset, onNewPosition }: { asset: Asset; onNewPosition: (position: Position) => void }) {
    const { account, balance } = useWeb3();
    const { toast } = useToast();
    const [side, setSide] = useState<'long' | 'short'>('long');
    const [collateral, setCollateral] = useState(100);
    const [leverage, setLeverage] = useState([10]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const positionSize = collateral * leverage[0];
    const liqPrice = side === 'long'
        ? asset.price * (1 - (1 / leverage[0]) * 0.95)
        : asset.price * (1 + (1 / leverage[0]) * 0.95);

    const handleSubmit = async () => {
        if (!account) {
            toast({ variant: "destructive", title: "Wallet not connected", description: "Please connect your wallet to open a position."});
            return;
        }
        if (collateral > balance) {
            toast({ variant: "destructive", title: "Insufficient Balance", description: `You need at least ${collateral} AE.`});
            return;
        }

        setIsSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 2000));

        onNewPosition({
            id: Math.random(),
            asset,
            side,
            size: positionSize,
            collateral,
            entryPrice: asset.price,
            liqPrice,
            pnl: 0,
        });

        toast({
            title: "Position Opened Successfully",
            description: `${side.toUpperCase()} ${asset.id} position of ${positionSize.toLocaleString()} opened.`,
            action: <CheckCircle className="text-emerald-500" />,
        });
        setIsSubmitting(false);
    };

    return (
        <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
                <CardTitle>Trade {asset.id}</CardTitle>
                <CardDescription>Available Balance: {balance.toFixed(2)} AE</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Tabs defaultValue="long" onValueChange={(value) => setSide(value as 'long' | 'short')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                        <TabsTrigger value="long" className="data-[state=active]:bg-emerald-500/80 data-[state=active]:text-white">
                            <TrendingUp className="w-4 h-4 mr-2" /> Long
                        </TabsTrigger>
                        <TabsTrigger value="short" className="data-[state=active]:bg-rose-500/80 data-[state=active]:text-white">
                            <TrendingDown className="w-4 h-4 mr-2" /> Short
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="space-y-2">
                    <Label htmlFor="collateral">Collateral (AE)</Label>
                    <Input id="collateral" type="number" value={collateral} onChange={(e) => setCollateral(Number(e.target.value))} className="bg-slate-800 border-slate-700" />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="leverage">Leverage: {leverage[0]}x</Label>
                    <Slider id="leverage" min={1} max={100} step={1} value={leverage} onValueChange={setLeverage} />
                </div>

                <Separator className="bg-slate-700" />

                <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex justify-between"><span>Position Size</span><span>${positionSize.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Entry Price</span><span>${asset.price.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Est. Liquidation Price</span><span>${liqPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span>Fees</span><span>~$0.50</span></div>
                </div>

                <Button onClick={handleSubmit} disabled={!account || isSubmitting} className={`w-full ${side === 'long' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                    {isSubmitting ? "Processing..." : `Open ${side.charAt(0).toUpperCase() + side.slice(1)}`}
                </Button>
            </CardContent>
        </Card>
    );
}

function PositionsPanel({ positions, setPositions, currentPrices }: { positions: Position[]; setPositions: React.Dispatch<React.SetStateAction<Position[]>>; currentPrices: Record<string, number> }) {
    useEffect(() => {
        if (positions.length === 0) return;

        const interval = setInterval(() => {
            setPositions(prevPositions =>
                prevPositions.map(p => {
                    const currentPrice = currentPrices[p.asset.id];
                    const priceChange = currentPrice - p.entryPrice;
                    const pnl = p.side === 'long' ? priceChange * (p.size / p.entryPrice) : -priceChange * (p.size / p.entryPrice);
                    return { ...p, pnl };
                })
            );
        }, 2000);

        return () => clearInterval(interval);
    }, [positions, currentPrices, setPositions]);

    return (
        <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
                <CardTitle>Open Positions</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="border-slate-700">
                            <TableHead>Asset</TableHead>
                            <TableHead>Side</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Entry Price</TableHead>
                            <TableHead>Liq. Price</TableHead>
                            <TableHead className="text-right">Unrealized PnL</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {positions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-slate-500">No open positions.</TableCell>
                            </TableRow>
                        ) : (
                            positions.map(p => (
                                <TableRow key={p.id} className="border-slate-800">
                                    <TableCell className="font-medium">{p.asset.id}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 text-xs rounded-full ${p.side === 'long' ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300'}`}>
                                            {p.side.toUpperCase()}
                                        </span>
                                    </TableCell>
                                    <TableCell>${p.size.toLocaleString()}</TableCell>
                                    <TableCell>${p.entryPrice.toLocaleString()}</TableCell>
                                    <TableCell>${p.liqPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                    <TableCell className={`text-right font-mono ${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        ${p.pnl.toFixed(2)}
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

// MAIN APP COMPONENT //
export default function GeminiApp() {
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>(
    ASSETS.reduce((acc, asset) => ({ ...acc, [asset.id]: asset.price }), {})
  );

  useEffect(() => {
    const priceInterval = setInterval(() => {
        setCurrentPrices(prevPrices => {
            const newPrices = { ...prevPrices };
            for (const asset of ASSETS) {
                const volatility = 0.0001;
                newPrices[asset.id] *= 1 + (Math.random() - 0.5) * volatility;
            }
            return newPrices;
        });
    }, 1000);
    return () => clearInterval(priceInterval);
  }, []);

  const handleNewPosition = (position: Position) => {
    setPositions(prev => [...prev, position]);
  };

  return (
    <Web3Provider>
      <Toaster />
      <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
        <Header />
        <main className="container p-4 mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Perpetual Futures</h2>
            <AssetSelector selectedAsset={selectedAsset} setSelectedAsset={setSelectedAsset} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ChartPanel asset={selectedAsset} />
            </div>
            <div className="lg:col-span-1">
              <TradePanel asset={selectedAsset} onNewPosition={handleNewPosition} />
            </div>
          </div>

          <div className="mt-6">
            <PositionsPanel positions={positions} setPositions={setPositions} currentPrices={currentPrices} />
          </div>
        </main>
      </div>
    </Web3Provider>
  );
}
