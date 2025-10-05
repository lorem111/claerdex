const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const ORACLE_ID = "ok_2Nn41cS6fjnAQFqm8nvpDfrKBzJ7Wzntdb5ZsTs4bQ7UCJ3Bew";

// Cache for prices
let priceCache = {
  btc: null,
  eth: null,
  sol: null,
  ae: null,
  lastUpdate: 0,
};

const CACHE_DURATION = 30000; // 30 second cache

async function fetchCoinGeckoPrice(currency) {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=aeternity,bitcoin,ethereum,solana&vs_currencies=${currency}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching from CoinGecko:`, error.message);
    return null;
  }
}

async function fetchAllPrices() {
  const data = await fetchCoinGeckoPrice("usd");
  if (!data) return null;

  return {
    BTC: data.bitcoin?.usd || null,
    ETH: data.ethereum?.usd || null,
    SOL: data.solana?.usd || null,
    AE: data.aeternity?.usd || null,
  };
}

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Claerdex Oracle API",
    oracle_id: ORACLE_ID,
  });
});

// Get all prices
app.get("/prices", async (req, res) => {
  try {
    const now = Date.now();

    // Return cached prices if fresh
    if (now - priceCache.lastUpdate < CACHE_DURATION && priceCache.BTC !== null) {
      return res.json({
        data: priceCache,
        cached: true,
        timestamp: Math.floor(priceCache.lastUpdate / 1000),
      });
    }

    // Fetch fresh prices
    const prices = await fetchAllPrices();

    if (!prices) {
      return res.status(500).json({
        error: "Failed to fetch prices from CoinGecko",
      });
    }

    // Update cache
    priceCache = {
      ...prices,
      lastUpdate: now,
    };

    res.json({
      data: prices,
      cached: false,
      timestamp: Math.floor(now / 1000),
    });
  } catch (error) {
    console.error("Error fetching prices:", error);
    res.status(500).json({
      error: "Failed to fetch prices",
      message: error.message,
    });
  }
});

// Get single price
app.get("/price/:asset", async (req, res) => {
  try {
    const asset = req.params.asset.toUpperCase();
    const validAssets = ["BTC", "ETH", "SOL", "AE"];

    if (!validAssets.includes(asset)) {
      return res.status(400).json({ error: "Invalid asset" });
    }

    // Get prices (from cache or fresh)
    const now = Date.now();
    let prices;

    if (now - priceCache.lastUpdate < CACHE_DURATION && priceCache.BTC !== null) {
      prices = priceCache;
    } else {
      prices = await fetchAllPrices();
      if (prices) {
        priceCache = { ...prices, lastUpdate: now };
      }
    }

    res.json({
      asset,
      price: prices ? prices[asset] : null,
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    console.error("Error fetching price:", error);
    res.status(500).json({
      error: "Failed to fetch price",
      message: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;

function startServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Oracle API server running on port ${PORT}`);
  });
}

module.exports = { startServer };
