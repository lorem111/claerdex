const express = require("express");
const cors = require("cors");
const { Node, MemoryAccount, AeSdk } = require("@aeternity/aepp-sdk");
const BigNumber = require("bignumber.js");

const app = express();
app.use(cors());
app.use(express.json());

const ORACLE_ID = "ok_2Nn41cS6fjnAQFqm8nvpDfrKBzJ7Wzntdb5ZsTs4bQ7UCJ3Bew";
const MAINNET_URL = "https://mainnet.aeternity.io/";

// Cache for prices
let priceCache = {
  btc: null,
  eth: null,
  sol: null,
  ae: null,
  lastUpdate: 0,
};

const CACHE_DURATION = 60000; // 1 minute cache

class OracleQuerier {
  async init() {
    if (!this.client) {
      // Use a temporary account just for querying (read-only operations need an account)
      const { Node, MemoryAccount, AeSdk, generateKeyPair } = require("@aeternity/aepp-sdk");
      const tempKeypair = generateKeyPair();

      this.client = new AeSdk({
        nodes: [
          {
            name: "node",
            instance: new Node(process.env.NODE_URL || MAINNET_URL),
          },
        ],
        accounts: [new MemoryAccount(tempKeypair.secretKey)],
      });
    }

    if (!this.oracle) {
      this.oracle = await this.client.getOracleObject(ORACLE_ID);
      console.log("API initialized oracle:", this.oracle.id);
    }
  }

  async queryPrice(currency) {
    try {
      const query = await this.oracle.postQuery(currency, {
        queryFee: this.oracle.queryFee,
      });

      console.log(`Queried for '${currency}' with query id: ${query.id}`);

      // Poll for response with timeout
      const response = await query.pollForResponse({ attempts: 20, interval: 2000 });
      const price = new BigNumber(response).div(10 ** 18).toNumber();

      console.log(`Got response for ${currency}:`, price);
      return price;
    } catch (error) {
      console.error(`Error querying ${currency}:`, error.message);
      return null;
    }
  }
}

const querier = new OracleQuerier();

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
    if (now - priceCache.lastUpdate < CACHE_DURATION && priceCache.btc !== null) {
      return res.json({
        data: {
          BTC: priceCache.btc,
          ETH: priceCache.eth,
          SOL: priceCache.sol,
          AE: priceCache.ae,
        },
        cached: true,
        timestamp: Math.floor(priceCache.lastUpdate / 1000),
      });
    }

    // Initialize if needed
    if (!querier.oracle) {
      await querier.init();
    }

    // Query all prices in parallel
    const [btc, eth, sol, ae] = await Promise.all([
      querier.queryPrice("btc"),
      querier.queryPrice("eth"),
      querier.queryPrice("sol"),
      querier.queryPrice("usd").then(usd => usd ? 1 / usd : null), // AE price is inverse of USD price
    ]);

    // Update cache
    priceCache = {
      btc,
      eth,
      sol,
      ae,
      lastUpdate: now,
    };

    res.json({
      data: {
        BTC: btc,
        ETH: eth,
        SOL: sol,
        AE: ae,
      },
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
    const asset = req.params.asset.toLowerCase();
    const validAssets = ["btc", "eth", "sol", "ae"];

    if (!validAssets.includes(asset)) {
      return res.status(400).json({ error: "Invalid asset" });
    }

    // Initialize if needed
    if (!querier.oracle) {
      await querier.init();
    }

    let price;
    if (asset === "ae") {
      const usd = await querier.queryPrice("usd");
      price = usd ? 1 / usd : null;
    } else {
      price = await querier.queryPrice(asset);
    }

    res.json({
      asset: asset.toUpperCase(),
      price,
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
  app.listen(PORT, () => {
    console.log(`Oracle API server running on port ${PORT}`);
  });
}

module.exports = { startServer };
