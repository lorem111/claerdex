const { Node, MemoryAccount, AeSdk, CompilerHttp, Contract } = require("@aeternity/aepp-sdk");
const fs = require("fs").promises;
const path = require("path");

const url = "https://testnet.aeternity.io/";

class ContractDeployer {
  initClient = async () => {
    if (!process.env.SECRET_KEY) {
      throw Error("SECRET_KEY environment variable not defined");
    }

    if (!this.client) {
      this.client = new AeSdk({
        nodes: [
          {
            name: "node",
            instance: new Node(process.env.NODE_URL || url),
          },
        ],
        accounts: [new MemoryAccount(process.env.SECRET_KEY)],
        onCompiler: new CompilerHttp("https://v8.compiler.aepps.com"),
      });
    }

    console.log("Client initialized");
    console.log("Account address:", this.client.address);
    const balance = await this.client.getBalance(this.client.address);
    console.log("Account balance:", balance, "aettos");
  };

  deployContract = async (oracleId) => {
    if (!this.client) throw Error("Client not initialized");

    // Read contract source
    const contractPath = path.resolve(
      __dirname,
      "../../PriceFeedQuery.aes",
    );
    const sourceCode = await fs.readFile(contractPath, "utf-8");

    console.log("\nDeploying PriceFeedQuery contract...");
    console.log("Oracle ID:", oracleId);

    // Initialize contract and deploy
    const contract = await Contract.initialize({
      ...this.client.getContext(),
      sourceCode,
    });

    await contract.$deploy([oracleId]);

    console.log("\n✅ Contract deployed successfully!");
    console.log("Contract address:", contract.$options.address);

    // Save contract address to file
    const outputPath = path.resolve(__dirname, "../../.data/contract.json");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          address: contract.$options.address,
          oracleId: oracleId,
          deployedAt: new Date().toISOString(),
          network: process.env.NODE_URL || url,
        },
        null,
        2,
      ),
    );

    console.log("Contract info saved to:", outputPath);

    return contract;
  };
}

const runDeploy = async () => {
  if (!process.env.ORACLE_ID) {
    console.error("\n❌ Error: ORACLE_ID environment variable not defined");
    console.log("\nUsage:");
    console.log(
      "NODE_URL=https://testnet.aeternity.io/ SECRET_KEY=your_key ORACLE_ID=ok_xxx node src/deploy/deployContract.js",
    );
    process.exit(1);
  }

  const deployer = new ContractDeployer();
  await deployer.initClient();
  await deployer.deployContract(process.env.ORACLE_ID);
};

void runDeploy();
