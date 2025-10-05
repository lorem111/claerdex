const PriceFeedOracle = require("./priceFeedOracle");
const { startServer } = require("../api/server");

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const main = async () => {
  // Start API server
  startServer();

  // Start oracle operator
  const priceFeedOracle = new PriceFeedOracle();
  await priceFeedOracle.init();
  await priceFeedOracle.register();
  await priceFeedOracle.startPolling();
};

void main();
