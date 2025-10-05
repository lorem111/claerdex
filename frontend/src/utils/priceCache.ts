// Price caching utility for instant load times
// Uses localStorage for persistent cache with stale-while-revalidate pattern

const PRICE_CACHE_KEY = 'claerdex_prices_cache';
const PRICE_CACHE_TIMESTAMP_KEY = 'claerdex_prices_timestamp';
const CHART_CACHE_PREFIX = 'claerdex_chart_';
const CACHE_MAX_AGE = 60000; // 60 seconds - show stale data if older

export interface CachedPriceData {
  data: Record<string, {
    price: number;
    high_24h: number;
    low_24h: number;
    open_24h: number;
    change_24h: number;
    change_percent_24h: number;
  }>;
  timestamp: number;
  update_interval: number;
}

export interface CachedChartData {
  asset: string;
  interval: string;
  data: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
  cachedAt: number;
}

/**
 * Get cached prices from localStorage - INSTANT, no network delay
 */
export function getCachedPrices(): CachedPriceData | null {
  try {
    const cached = localStorage.getItem(PRICE_CACHE_KEY);
    const timestamp = localStorage.getItem(PRICE_CACHE_TIMESTAMP_KEY);

    if (cached && timestamp) {
      return {
        ...JSON.parse(cached),
        timestamp: parseInt(timestamp)
      };
    }
  } catch (error) {
    console.error('Error reading price cache:', error);
  }
  return null;
}

/**
 * Save prices to cache for next instant load
 */
export function cachePrices(priceData: CachedPriceData): void {
  try {
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(priceData));
    localStorage.setItem(PRICE_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error saving price cache:', error);
  }
}

/**
 * Check if cached data is fresh enough to display
 */
export function isCacheFresh(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_MAX_AGE;
}

/**
 * Get cached chart data for instant display
 */
export function getCachedChart(asset: string, interval: string): CachedChartData | null {
  try {
    const key = `${CHART_CACHE_PREFIX}${asset}_${interval}`;
    const cached = localStorage.getItem(key);

    if (cached) {
      const data = JSON.parse(cached);
      // Only use if less than 5 minutes old
      if (Date.now() - data.cachedAt < 300000) {
        return data;
      }
    }
  } catch (error) {
    console.error('Error reading chart cache:', error);
  }
  return null;
}

/**
 * Cache chart data for instant load next time
 */
export function cacheChart(asset: string, interval: string, data: any[]): void {
  try {
    const key = `${CHART_CACHE_PREFIX}${asset}_${interval}`;
    const cacheData: CachedChartData = {
      asset,
      interval,
      data,
      cachedAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error saving chart cache:', error);
  }
}

/**
 * Prefetch prices in the background - start ASAP, before React even mounts
 * This can be called from index.tsx or even index.html
 */
export function prefetchPrices(): Promise<CachedPriceData> {
  return fetch('https://claerdex-backend.vercel.app/prices')
    .then(res => res.json())
    .then(data => {
      const priceData = {
        data: data.data || data,
        timestamp: data.timestamp || Date.now(),
        update_interval: data.update_interval || 5
      };
      cachePrices(priceData);
      return priceData;
    })
    .catch(error => {
      console.error('Prefetch failed:', error);
      // Return cached data as fallback
      return getCachedPrices() || {
        data: {},
        timestamp: 0,
        update_interval: 5
      };
    });
}
