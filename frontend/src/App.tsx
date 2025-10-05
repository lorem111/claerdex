import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Grid,
  GridItem,
  Text,
  Button,
  Select,
  Input,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Tag,
  HStack,
  VStack,
  Divider,
  useToast,
  Spinner,
  Image,
} from '@chakra-ui/react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { FaWallet } from 'react-icons/fa';
import { BiTrendingUp, BiTrendingDown } from 'react-icons/bi';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// --- TYPE DEFINITIONS ---
type Asset = 'AE' | 'BTC' | 'ETH' | 'SOL';
type PositionSide = 'LONG' | 'SHORT';

interface Position {
  id: number;
  asset: Asset;
  side: PositionSide;
  size: number; // in USD
  entryPrice: number;
  pnl: number;
  liquidationPrice: number;
}

interface UserState {
  isConnected: boolean;
  address: string;
  balance: number; // Collateral balance in AE
  positions: Position[];
}

// --- MOCK DATA & API FUNCTIONS ---
// In a real app, these would make API calls to your Python backend.

const MOCK_ASSET_DATA = {
  AE: { name: 'Aeternity', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2911.png' },
  BTC: { name: 'Bitcoin', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png' },
  ETH: { name: 'Ethereum', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png' },
  SOL: { name: 'Solana', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png' },
};

const MOCK_PRICES = {
  AE: 0.035,
  BTC: 68000.51,
  ETH: 3500.23,
  SOL: 150.78,
};

const generateMockChartData = () => {
    const labels = Array.from({ length: 30 }, (_, i) => `T-${29 - i}`);
    const data = Array.from({ length: 30 }, () => 68000 + Math.random() * 1000 - 500);
    return { labels, datasets: [{ data }] };
};


// --- UI COMPONENTS ---

const Header: React.FC<{
  userState: UserState;
  onConnectWallet: () => void;
}> = ({ userState, onConnectWallet }) => (
  <Flex
    as="header"
    align="center"
    justify="space-between"
    p={4}
    bg="gray.800"
    borderBottom="1px solid"
    borderColor="gray.700"
  >
    <HStack spacing={4}>
      <Text fontSize="2xl" fontWeight="bold" color="cyan.400">
        Claer
      </Text>
      <Text fontSize="md" color="gray.400">Hybrid Perpetual DEX</Text>
    </HStack>
    {userState.isConnected ? (
      <HStack spacing={4} bg="gray.700" p={2} borderRadius="md">
        <Stat size="sm">
          <StatLabel>Collateral</StatLabel>
          <StatNumber>{userState.balance.toFixed(2)} AE</StatNumber>
        </Stat>
        <Tag colorScheme="green" size="lg">
          {`${userState.address.slice(0, 6)}...${userState.address.slice(-4)}`}
        </Tag>
      </HStack>
    ) : (
      <Button
        leftIcon={<FaWallet />}
        colorScheme="cyan"
        onClick={onConnectWallet}
      >
        Connect Wallet
      </Button>
    )}
  </Flex>
);

const PriceChart: React.FC<{
    selectedAsset: Asset;
    currentPrice: number;
}> = ({ selectedAsset, currentPrice }) => {
    const [chartData, setChartData] = useState(generateMockChartData());
  
    useEffect(() => {
        // In a real app, you would fetch new chart data when the asset changes.
        const newData = generateMockChartData();
        // Make the last point the current price
        newData.datasets[0].data[newData.datasets[0].data.length - 1] = currentPrice;
        setChartData(newData);
    }, [selectedAsset, currentPrice]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { display: false },
      y: {
        display: true,
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: 'gray.400' },
      },
    },
    elements: {
        point: { radius: 0 }
    }
  };

  const data = {
    labels: chartData.labels,
    datasets: [
      {
        label: `${selectedAsset} Price`,
        data: chartData.datasets[0].data,
        borderColor: 'rgb(45, 212, 191)',
        backgroundColor: (context: any) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
            gradient.addColorStop(0, 'rgba(45, 212, 191, 0.5)');
            gradient.addColorStop(1, 'rgba(45, 212, 191, 0)');
            return gradient;
        },
        tension: 0.4,
        fill: true,
      },
    ],
  };

  return (
    <Box h="100%" p={4} bg="gray.800" borderRadius="lg">
      <HStack justify="space-between" mb={4}>
        <HStack>
            <Image src={MOCK_ASSET_DATA[selectedAsset].icon} boxSize="32px" />
            <Text fontSize="2xl" fontWeight="bold">{selectedAsset}/USD</Text>
        </HStack>
        <Stat>
            <StatNumber fontSize="2xl">${currentPrice.toLocaleString()}</StatNumber>
            <StatHelpText color="green.400">
                +2.5% (24h)
            </StatHelpText>
        </Stat>
      </HStack>
      <Box h="300px">
        <Line options={options} data={data} />
      </Box>
    </Box>
  );
};

const TradePanel: React.FC<{
  selectedAsset: Asset;
  onAssetChange: (asset: Asset) => void;
  onOpenPosition: (side: PositionSide, size: number, leverage: number) => void;
  isConnected: boolean;
}> = ({ selectedAsset, onAssetChange, onOpenPosition, isConnected }) => {
  const [side, setSide] = useState<PositionSide>('LONG');
  const [size, setSize] = useState('1000'); // Position size in USD
  const [leverage, setLeverage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  const collateralNeeded = (parseFloat(size) || 0) / leverage;

  const handleOpenPosition = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
        onOpenPosition(side, parseFloat(size), leverage);
        setIsLoading(false);
    }, 1500);
  };


  return (
    <VStack spacing={4} p={4} bg="gray.800" borderRadius="lg" h="100%" align="stretch">
      <Select
        value={selectedAsset}
        onChange={(e) => onAssetChange(e.target.value as Asset)}
        size="lg"
      >
        {Object.keys(MOCK_ASSET_DATA).map(asset => (
            <option key={asset} value={asset}>{MOCK_ASSET_DATA[asset as Asset].name}</option>
        ))}
      </Select>
      <HStack>
        <Button
          w="50%"
          colorScheme={side === 'LONG' ? 'green' : 'gray'}
          onClick={() => setSide('LONG')}
          leftIcon={<BiTrendingUp size="1.5em" />}
        >
          Long
        </Button>
        <Button
          w="50%"
          colorScheme={side === 'SHORT' ? 'red' : 'gray'}
          onClick={() => setSide('SHORT')}
          leftIcon={<BiTrendingDown size="1.5em" />}
        >
          Short
        </Button>
      </HStack>
      <Box>
        <Text mb={1} fontSize="sm" color="gray.400">Position Size (USD)</Text>
        <Input
          placeholder="e.g., 1000"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          size="lg"
          textAlign="right"
        />
      </Box>
      <Box>
        <Text mb={1} fontSize="sm" color="gray.400">Leverage: {leverage}x</Text>
        <Slider
          aria-label="leverage-slider"
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
        <Flex justify="space-between">
            <Text>Collateral Needed:</Text>
            <Text fontWeight="bold">{collateralNeeded.toFixed(2)} USD</Text>
        </Flex>
        <Flex justify="space-between">
            <Text>Liquidation Price (Est.):</Text>
            <Text fontWeight="bold">${(MOCK_PRICES[selectedAsset] * (1 - 1/leverage)).toLocaleString()}</Text>
        </Flex>
         <Flex justify="space-between">
            <Text>Available Collateral:</Text>
            <Text fontWeight="bold">5,000.00 USD</Text>
        </Flex>
      </VStack>
      <Button
        colorScheme={side === 'LONG' ? 'green' : 'red'}
        size="lg"
        w="100%"
        isDisabled={!isConnected || isLoading}
        isLoading={isLoading}
        onClick={handleOpenPosition}
      >
        {isConnected ? `Open ${side} Position` : 'Connect Wallet to Trade'}
      </Button>
    </VStack>
  );
};

const PositionsTable: React.FC<{ 
    positions: Position[];
    onClosePosition: (id: number) => void;
}> = ({ positions, onClosePosition }) => {
    if (positions.length === 0) {
        return (
            <Box p={6} bg="gray.800" borderRadius="lg" textAlign="center" color="gray.500">
                <Text>No Open Positions</Text>
                <Text fontSize="sm">Your open positions will appear here.</Text>
            </Box>
        )
    }
  
    return (
    <Box p={4} bg="gray.800" borderRadius="lg">
      <Text fontSize="xl" fontWeight="bold" mb={4}>Open Positions</Text>
      {positions.map((pos) => (
        <Flex key={pos.id} justify="space-between" align="center" p={3} _hover={{ bg: "gray.700"}} borderRadius="md">
          <HStack spacing={4}>
            <Image src={MOCK_ASSET_DATA[pos.asset].icon} boxSize="24px" />
            <VStack align="start" spacing={0}>
                <Text fontWeight="bold">{pos.asset}/USD</Text>
                <Tag size="sm" colorScheme={pos.side === 'LONG' ? 'green' : 'red'}>{pos.side}</Tag>
            </VStack>
          </HStack>
          <HStack spacing={8}>
            <Stat size="sm" textAlign="right">
                <StatLabel>Size</StatLabel>
                <StatNumber>${pos.size.toLocaleString()}</StatNumber>
            </Stat>
             <Stat size="sm" textAlign="right">
                <StatLabel>Entry Price</StatLabel>
                <StatNumber>${pos.entryPrice.toLocaleString()}</StatNumber>
            </Stat>
            <Stat size="sm" textAlign="right">
                <StatLabel>Unrealized PnL</StatLabel>
                <StatNumber color={pos.pnl >= 0 ? 'green.400' : 'red.400'}>
                    ${pos.pnl.toFixed(2)}
                </StatNumber>
            </Stat>
             <Stat size="sm" textAlign="right">
                <StatLabel>Liq. Price</StatLabel>
                <StatNumber>${pos.liquidationPrice.toLocaleString()}</StatNumber>
            </Stat>
          </HStack>
          <Button size="sm" variant="outline" colorScheme="red" onClick={() => onClosePosition(pos.id)}>Close</Button>
        </Flex>
      ))}
    </Box>
  );
};


// --- MAIN APP COMPONENT ---

function App() {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset>('BTC');
  const [currentPrice, setCurrentPrice] = useState(MOCK_PRICES.BTC);

  const [userState, setUserState] = useState<UserState>({
    isConnected: false,
    address: '',
    balance: 0,
    positions: [],
  });
  
  // Simulate initial loading and price updates
  useEffect(() => {
    setTimeout(() => setIsLoading(false), 1500);

    const priceInterval = setInterval(() => {
        // Jitter the price for a dynamic feel
        setCurrentPrice(prev => prev + (Math.random() * 20 - 10));
        
        // Update PnL on existing positions
        setUserState(prev => ({
            ...prev,
            positions: prev.positions.map(p => ({
                ...p,
                pnl: (MOCK_PRICES[p.asset] - p.entryPrice) * (p.size / p.entryPrice) * (p.side === 'LONG' ? 1 : -1)
            }))
        }))
    }, 2000);

    return () => clearInterval(priceInterval);
  }, []);
  
  const handleConnectWallet = () => {
    // This would be an async call to the Superhero Wallet API
    setIsLoading(true);
    setTimeout(() => {
      setUserState({
        isConnected: true,
        address: 'ak_2d...xG9b',
        balance: 1500.75,
        positions: [ // Add a mock position for demo purposes
            { id: 1, asset: 'ETH', side: 'LONG', size: 5000, entryPrice: 3450.00, pnl: 120.50, liquidationPrice: 3105.00 }
        ],
      });
      setIsLoading(false);
      toast({
        title: 'Wallet Connected',
        description: "You're ready to trade.",
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    }, 1000);
  };

  const handleAssetChange = (asset: Asset) => {
    setSelectedAsset(asset);
    setCurrentPrice(MOCK_PRICES[asset]); // Update price on asset change
  }

  const handleOpenPosition = (side: PositionSide, size: number, leverage: number) => {
    const newPosition: Position = {
        id: Date.now(),
        asset: selectedAsset,
        side,
        size,
        entryPrice: currentPrice,
        pnl: 0,
        liquidationPrice: currentPrice * (1 - 1/leverage) // Simplified calc
    }

    setUserState(prev => ({
        ...prev,
        positions: [...prev.positions, newPosition]
    }));
    
    toast({
        title: `Position Opened!`,
        description: `${side} ${selectedAsset} position of $${size} opened at $${currentPrice.toLocaleString()}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
  };

  const handleClosePosition = (id: number) => {
    const posToClose = userState.positions.find(p => p.id === id);
    setUserState(prev => ({
        ...prev,
        positions: prev.positions.filter(p => p.id !== id)
    }));
    toast({
        title: 'Position Closed',
        description: `Your ${posToClose?.asset} position was closed.`,
        status: 'info',
        duration: 3000,
        isClosable: true,
    })
  }

  if (isLoading && !userState.isConnected) {
    return (
        <Flex h="100vh" align="center" justify="center" direction="column">
            <Spinner size="xl" color="cyan.400" />
            <Text mt={4} fontSize="lg">Loading Claer DEX...</Text>
        </Flex>
    )
  }

  return (
    <Box bg="gray.900" minH="100vh">
      <Header userState={userState} onConnectWallet={handleConnectWallet} />
      <Box p={4}>
        <Grid
          templateColumns="repeat(3, 1fr)"
          templateRows="auto 1fr"
          gap={4}
        >
          <GridItem colSpan={2} rowSpan={1}>
            <PriceChart selectedAsset={selectedAsset} currentPrice={currentPrice} />
          </GridItem>
          <GridItem colSpan={1} rowSpan={1}>
            <TradePanel
              selectedAsset={selectedAsset}
              onAssetChange={handleAssetChange}
              onOpenPosition={handleOpenPosition}
              isConnected={userState.isConnected}
            />
          </GridItem>
          <GridItem colSpan={3}>
            <PositionsTable positions={userState.positions} onClosePosition={handleClosePosition} />
          </GridItem>
        </Grid>
      </Box>
    </Box>
  );
}

export default App;