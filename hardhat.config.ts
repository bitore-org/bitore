import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import dotenv from "dotenv";

dotenv.config();

const endpointUrl = "https://rpc.sepolia-api.lisk.com";
const privateKey = process.env.PRIVATE_KEY as string;

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      url: endpointUrl,
      accounts: [privateKey],
    },

    hardhat: {
      gas: "auto",
      mining: {
        auto: true,
        interval: 1000,
        mempool: {
          order: "fifo",
        },
      },
      accounts: {
        count: 400,
      },
    },
  },
};

export default config;
