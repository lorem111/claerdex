// Aeternity Superhero Wallet integration utilities
// Based on reference implementation from dex-ui

import { walletDetector, BrowserWindowMessageConnection, Node, AeSdkAepp } from '@aeternity/aepp-sdk';

const MAINNET_NODE_URL = 'https://mainnet.aeternity.io';
const TESTNET_NODE_URL = 'https://testnet.aeternity.io';

export interface WalletInfo {
  address: string;
  balance: number;
  networkId: string;
}

interface DetectedWallet {
  info: {
    id: string;
    name: string;
    networkId: string;
  };
  getConnection: () => any;
}

// Global SDK instance to maintain connection
let aeSdkInstance: AeSdkAepp | null = null;

/**
 * Initialize AeSdkAepp for wallet connections
 */
const initSdk = (): AeSdkAepp => {
  if (!aeSdkInstance) {
    aeSdkInstance = new AeSdkAepp({
      name: 'Claerdex',
      nodes: [
        { name: 'mainnet', instance: new Node(MAINNET_NODE_URL) },
        { name: 'testnet', instance: new Node(TESTNET_NODE_URL) },
      ],
      onNetworkChange: ({ networkId }) => {
        console.log('Network changed to:', networkId);
      },
      onAddressChange: ({ current }) => {
        const [address] = Object.keys(current);
        console.log('Address changed to:', address);
      },
      onDisconnect: () => {
        console.log('Wallet disconnected');
      },
    });
  }
  return aeSdkInstance;
};

/**
 * Detect available wallets using the SDK's walletDetector
 * Returns a promise that resolves when a wallet is found or times out after 5 seconds
 */
export const detectWallets = (): Promise<DetectedWallet[]> => {
  return new Promise((resolve) => {
    const wallets: DetectedWallet[] = [];
    let stopScan: (() => void) | null = null;

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      stopScan?.();
      resolve(wallets);
    }, 5000);

    // Handle wallet detection
    const handleWallet = ({ wallets: detectedWallets }: { wallets: Record<string, DetectedWallet> }) => {
      wallets.push(...Object.values(detectedWallets));
      clearTimeout(timeout);
      stopScan?.();
      resolve(wallets);
    };

    // Start scanning for wallets
    const scannerConnection = new BrowserWindowMessageConnection();
    stopScan = walletDetector(scannerConnection, handleWallet);
  });
};

/**
 * Check if Superhero Wallet extension is installed
 */
export const isSuperheroWalletInstalled = async (): Promise<boolean> => {
  const wallets = await detectWallets();
  return wallets.some(w => w.info.name === 'Superhero');
};

/**
 * Connect to Superhero Wallet and get account info
 * Uses the CORRECT method from dex-ui reference implementation
 */
export const connectSuperheroWallet = async (): Promise<WalletInfo> => {
  try {
    console.log('Detecting wallets...');
    const wallets = await detectWallets();

    if (wallets.length === 0) {
      throw new Error('No wallets detected. Please install Superhero Wallet extension.');
    }

    console.log(`Found ${wallets.length} wallet(s):`, wallets.map(w => w.info.name));

    // Find Superhero Wallet
    const superhero = wallets.find(w => w.info.name === 'Superhero');
    if (!superhero) {
      throw new Error('Superhero Wallet not found. Please install it from https://superhero.com/wallet');
    }

    console.log('Connecting to Superhero Wallet...');

    // Initialize SDK
    const sdk = initSdk();

    // Connect to wallet using the CORRECT method
    const { networkId } = await sdk.connectToWallet(superhero.getConnection());

    // Get current address
    const addresses = sdk.addresses();
    const address = addresses[0];

    if (!address) {
      throw new Error('Could not get wallet address from Superhero Wallet');
    }

    console.log('Connected to wallet:', address, 'on network:', networkId);

    // Get balance
    const balanceResponse = await sdk.getBalance(address);
    const balanceInAE = Number(balanceResponse) / 1e18; // Convert from aettos to AE

    return {
      address,
      balance: balanceInAE,
      networkId,
    };
  } catch (error) {
    console.error('Wallet connection error:', error);
    throw error;
  }
};

/**
 * Disconnect from wallet
 */
export const disconnectWallet = async (): Promise<void> => {
  console.log('Wallet disconnected');
};
