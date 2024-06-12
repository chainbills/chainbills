import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-foundry";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config";

if (!process.env.PRIVATE_KEY) throw "Set PRIVATE_KEY in .env";
export default {
  solidity: {
    version: "0.8.26",
    settings: {
      viaIR: true,
    },
  },
  networks: {
    sepolia: {
      url: "https://sepolia.drpc.org",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  defaultNetwork: "sepolia",
};
