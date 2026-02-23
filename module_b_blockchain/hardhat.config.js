require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.24",
        settings: {
            viaIR: true,
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        localhost: {
            url: process.env.ETH_RPC_URL || "http://127.0.0.1:8545",
            chainId: 1337,
        },
        hardhat: {
            chainId: 1337,
            mining: {
                auto: true,
                interval: 1000,
            },
        },
        // Testnets (uncomment when ready)
        // sepolia: {
        //   url: process.env.SEPOLIA_RPC_URL,
        //   accounts: [process.env.ETH_PRIVATE_KEY],
        //   chainId: 11155111,
        // },
    },
    gasReporter: {
        enabled: true,
        currency: "USD",
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
};
