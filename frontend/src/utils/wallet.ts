// Aeternity Superhero Wallet integration utilities
// Based on reference implementation from dex-ui

import { walletDetector, BrowserWindowMessageConnection, Node, AeSdk } from '@aeternity/aepp-sdk';

const MAINNET_NODE_URL = 'https://mainnet.aeternity.io';

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

    // Get wallet connection
    const walletConnection = await superhero.getConnection();

    // Create AeSdk instance with wallet connection
    const aeSdk = new AeSdk({
      nodes: [{ name: 'mainnet', instance: new Node(MAINNET_NODE_URL) }],
      onAccount: walletConnection,
    });

    console.log('Connected to wallet SDK');

    // Get current address from the SDK
    const address = await aeSdk.address();

    if (!address) {
      throw new Error('Could not get wallet address from Superhero Wallet');
    }

    console.log('Wallet address:', address);

    // Get balance
    const balanceResponse = await aeSdk.getBalance(address);
    const balanceInAE = Number(balanceResponse) / 1e18; // Convert from aettos to AE

    console.log('Wallet balance:', balanceInAE, 'AE');

    return {
      address,
      balance: balanceInAE,
      networkId: superhero.info.networkId,
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
