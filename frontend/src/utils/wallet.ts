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
        console.log('[WALLET] Network changed to:', networkId);
      },
      onAddressChange: ({ current }) => {
        const addresses = Object.keys(current);
        console.log('[WALLET] Address changed, available addresses:', addresses);
      },
      onDisconnect: () => {
        console.log('[WALLET] Wallet disconnected');
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

    // Connect to wallet - this establishes the connection
    const connectionInfo = await sdk.connectToWallet(superhero.getConnection());
    console.log('[WALLET] ✓ Connected to wallet:', connectionInfo);

    // Ask wallet to subscribe/select address - this should trigger the address to be available
    // The wallet will prompt user to select an account if needed
    console.log('[WALLET] Requesting address subscription...');

    // Create a promise that resolves when onAddressChange fires
    const addressPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for wallet address'));
      }, 10000); // 10 second timeout

      // Temporarily override the onAddressChange to capture the address
      const originalCallback = (sdk as any)._options?.onAddressChange;
      (sdk as any)._options.onAddressChange = ({ current }: any) => {
        clearTimeout(timeout);
        const addresses = Object.keys(current);
        console.log('[WALLET] ✓ Address received via callback:', addresses);
        if (addresses.length > 0) {
          // Restore original callback
          if (originalCallback) {
            originalCallback({ current });
          }
          resolve(addresses[0]);
        } else {
          reject(new Error('No addresses in callback'));
        }
      };
    });

    // Try to get address - SDK might already have it
    let addresses = sdk.addresses();
    let address: string;

    if (addresses && addresses.length > 0) {
      address = addresses[0];
      console.log('[WALLET] ✓ Got address immediately:', address);
    } else {
      console.log('[WALLET] Waiting for address from callback...');
      // Wait for the onAddressChange callback
      address = await addressPromise;
    }

    const networkId = connectionInfo.networkId || 'ae_mainnet';

    console.log('Connected to wallet:', address, 'on network:', networkId);

    // Get balance - cast address to the expected type
    const balanceResponse = await sdk.getBalance(address as `ak_${string}`);
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
