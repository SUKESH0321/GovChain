// GovChain - Stage 2.1
// Hardhat configuration for the local EVM development environment.
//
// This project is JavaScript only (no TypeScript) and runs on the Hardhat
// development node, which provides development accounts automatically.

import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  // ethers.js integration (adds the `ethers` object to every network connection).
  plugins: [hardhatEthers],

  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // Local Hardhat development node started with `npm run node`.
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },
  },
});
