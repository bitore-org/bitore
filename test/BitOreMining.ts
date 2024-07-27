import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  stringToHex,
  WalletClient,
} from "viem";
import { generateValidNonce } from "./utils/miner";
import { abi } from "../artifacts/contracts/BitOre.sol/BitOrePow.json";

let bitOreContractAddress: `0x${string}`;
let bitOreTokenAddress: `0x${string}`;

describe("BitOrePow", function () {
  async function deployBitOrePowFixture() {
    hre.config;

    const minerClients = await hre.viem.getWalletClients();

    const bitOrePow = await hre.viem.deployContract("BitOrePow", [
      1000n, // epoch adjustment interval
      150n, // epoch lengts
      100n, // allowed miners
    ]);

    const bitOreToken = await hre.viem.deployContract("BitOreToken", [
      "BitOre",
      "ORE",
      bitOrePow.address,
    ]);

    bitOreContractAddress = bitOrePow.address;
    bitOreTokenAddress = bitOreToken.address;

    const miners = [];

    for (let index = 0; index < minerClients.length; index++) {
      const minerClient = await hre.viem.getContractAt(
        "BitOrePow",
        bitOreContractAddress,
        { client: { wallet: minerClients[index] } }
      );

      miners.push(minerClient);
    }

    return {
      bitOrePow,
      bitOreToken,
      minerList: minerClients,
      minerAddresses: minerClients.map((miner) => miner.account.address),
      miners,
    };
  }

  describe("Mining tests", function () {
    it("Reach minimum miner after 100 Epoch", async () => {
      const { bitOrePow, bitOreToken, miners, minerAddresses } =
        await loadFixture(deployBitOrePowFixture);

      for (let index = 0; index < 100; index++) {
        await hre.network.provider.request({
          method: "hardhat_mine",
          params: ["0xC8"],
        });

        for (let index = 0; index < 3; index++) {
          const diff = await bitOrePow.read.miningTarget();
          const challangeNumber = await bitOrePow.read.challengeNumber();

          const miner = miners[index];
          const address = minerAddresses[index];

          const nonce = generateValidNonce(challangeNumber, diff, address);

          try {
            const result = await miner.write.mine([
              nonce,
              [bitOreTokenAddress, bitOreTokenAddress, bitOreTokenAddress],
            ]);
          } catch (error) {
            console.log("Error", error);
          }
        }

        await hre.network.provider.request({
          method: "hardhat_mine",
          params: ["0xC8"],
        });
      }

      expect(await bitOrePow.read.epochCount()).to.equal(101n);
      expect(await bitOrePow.read.miningTarget()).to.equal(2n ** 250n);
      expect(await bitOrePow.read._allowedMiners()).to.equal(10n);
      expect(await bitOreToken.read.balanceOf([minerAddresses[0]])).to.equal(
        17041292933522490038n
      );
      expect(await bitOreToken.read.balanceOf([minerAddresses[1]])).to.equal(
        8520646466761245019n
      );
      expect(await bitOreToken.read.balanceOf([minerAddresses[2]])).to.equal(
        8520646466761245019n
      );

      expect(true).to.be.true;
    });
  });
});
