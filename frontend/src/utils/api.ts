// API client for Claerdex backend
// Backend API endpoints: https://claerdex-backend.vercel.app

const API_BASE_URL = 'https://claerdex-backend.vercel.app';

// Type definitions matching backend models
export interface BackendPosition {
  id: string;
  asset: string;
  side: 'long' | 'short';
  size_usd: number;
  collateral_ae: number;
  leverage: number;
  entry_price: number;
  liquidation_price: number;
  unrealized_pnl_usd?: number;
  unrealized_pnl_ae?: number;
  current_price?: number;
}

export interface BackendAccount {
  address: string;
  on_chain_balance_ae: number;
  available_collateral_ae: number;
  positions: BackendPosition[];
}

export interface OpenPositionRequest {
  user_address: string;
  asset: string;
  side: 'long' | 'short';
  collateral_to_use_ae: number;
  leverage: number;
}

export interface OpenPositionResponse {
  message: string;
  position: BackendPosition;
  on_chain_tx: string;
}

export interface ClosePositionResponse {
  message: string;
  realized_pnl_ae: number;
}

/**
 * Fetch account state including positions and balances
 */
export async function fetchAccountState(userAddress: string): Promise<BackendAccount> {
  const response = await fetch(`${API_BASE_URL}/account/${userAddress}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch account state: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Open a new position
 */
export async function openPosition(request: OpenPositionRequest): Promise<OpenPositionResponse> {
  const response = await fetch(`${API_BASE_URL}/positions/open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || `Failed to open position: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Close an existing position
 */
export async function closePosition(userAddress: string, positionId: string): Promise<ClosePositionResponse> {
  const response = await fetch(`${API_BASE_URL}/positions/close/${positionId}?user_address=${userAddress}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || `Failed to close position: ${response.statusText}`);
  }

  return response.json();
}
