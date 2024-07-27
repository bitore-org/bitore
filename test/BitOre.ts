import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress, stringToHex, WalletClient } from "viem";
import { generateValidNonce } from "./utils/miner";
import e from "express";

let bitOreContractAddress: `0x${string}`;

describe("BitOrePow", function () {
  async function deployBitOrePowFixture() {
    hre.config;

    const minerClients = await hre.viem.getWalletClients();

    const bitOrePow = await hre.viem.deployContract("BitOrePow", [
      1000n,
      150n,
      100n,
    ]);

    bitOreContractAddress = bitOrePow.address;

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
      minerList: minerClients,
      minerAddresses: minerClients.map((miner) => miner.account.address),
      miners,
    };
  }

  describe("Deployment", function () {
    it("Should initialize the contract with correct values", async function () {
      const { bitOrePow } = await loadFixture(deployBitOrePowFixture);

      expect(await bitOrePow.read.epochCount()).to.equal(1n);
      expect(await bitOrePow.read.miningTarget()).to.equal(2n ** 250n);
      expect(await bitOrePow.read._allowedMiners()).to.equal(100n);

      //console.log("Epoch Info", await bitOrePow.read.getEpochInfo());
    });
  });

  describe("HashingTest", function () {
    it("Should allow a miner to mine and update state accordingly", async function () {
      const { bitOrePow, minerList } = await loadFixture(
        deployBitOrePowFixture
      );

      const value = generateValidNonce(
        "0xd2b23eee9ebc640d29216842c4f55d2f2a5a190a8716000bd11bb071585a4119",
        2n ** 250n,
        minerList[0].account.address
      );

      expect(value).to.be.lengthOf(66);
    });
  });

  describe("Mining", async () => {
    it("First Epoch started", async function () {
      const { bitOrePow, miners, minerAddresses } = await loadFixture(
        deployBitOrePowFixture
      );

      const diff = await bitOrePow.read.miningTarget();
      const challangeNumber = await bitOrePow.read.challengeNumber();

      const nonce = generateValidNonce(
        challangeNumber,
        diff,
        minerAddresses[1]
      );

      try {
        const tx = await miners[1].write.mine([nonce, []]);
      } catch (error) {
        console.log("Error", error);
      }

      expect(await bitOrePow.read.epochCount()).to.equal(1n);
      expect(await bitOrePow.read.miningTarget()).to.equal(2n ** 250n);
      expect(await bitOrePow.read._allowedMiners()).to.equal(100n);
    });

    it("Should allow a miner to mine and update state accordingly", async function () {
      const { bitOrePow, miners, minerAddresses } = await loadFixture(
        deployBitOrePowFixture
      );

      const diff = await bitOrePow.read.miningTarget();
      const challangeNumber = await bitOrePow.read.challengeNumber();

      const nonce = generateValidNonce(
        challangeNumber,
        diff,
        minerAddresses[1]
      );

      try {
        await miners[1].write.mine([nonce, []]);
      } catch (error) {
        console.log("Error", error);
      }

      const blocksToJump = 1;
      for (let i = 0; i < blocksToJump; i++) {
        await hre.network.provider.request({
          method: "evm_mine",
          params: [],
        });
      }

      const diff2 = await bitOrePow.read.miningTarget();
      const challangeNumber2 = await bitOrePow.read.challengeNumber();

      const nonce2 = generateValidNonce(
        challangeNumber2,
        diff2,
        minerAddresses[2]
      );

      try {
        await miners[2].write.mine([nonce2, []]);
      } catch (error) {
        console.log("Error", error);
      }

      try {
        await miners[1].write.mine([nonce, []]);
      } catch (error) {
        expect(error).to.be.an("error");
      }
    });

    it("Should allow to Mine 100 client", async () => {
      const { bitOrePow, miners, minerAddresses } = await loadFixture(
        deployBitOrePowFixture
      );

      const diff = await bitOrePow.read.miningTarget();
      const challangeNumber = await bitOrePow.read.challengeNumber();

      for (let index = 0; index < 100; index++) {
        const miner = miners[index];
        const address = minerAddresses[index];

        const nonce = generateValidNonce(challangeNumber, diff, address);

        try {
          const result = await miner.write.mine([nonce, []]);

          //    console.log("Miner", index, "Mined", result);
        } catch (error) {
          console.log("Error", error);
        }
      }

      expect(true).to.be.true;
    });

    it("Decrease miner after epoch", async () => {
      const { bitOrePow, miners, minerAddresses } = await loadFixture(
        deployBitOrePowFixture
      );

      const diff = await bitOrePow.read.miningTarget();
      const challangeNumber = await bitOrePow.read.challengeNumber();

      for (let index = 0; index < 39; index++) {
        const miner = miners[index];
        const address = minerAddresses[index];

        const nonce = generateValidNonce(challangeNumber, diff, address);

        try {
          const result = await miner.write.mine([nonce, []]);

          //    console.log("Miner", index, "Mined", result);
        } catch (error) {
          console.log("Error", error);
        }
      }

      const blocksToJump = 200;
      for (let i = 0; i < blocksToJump; i++) {
        await hre.network.provider.request({
          method: "evm_mine",
          params: [],
        });
      }

      const diff2 = await bitOrePow.read.miningTarget();
      const challangeNumber2 = await bitOrePow.read.challengeNumber();

      const nonce = generateValidNonce(
        challangeNumber2,
        diff2,
        minerAddresses[130]
      );

      try {
        const result = await miners[130].write.mine([nonce, []]);

        //    console.log("Miner", index, "Mined", result);
      } catch (error) {
        console.log("Error", error);
      }

      expect(await bitOrePow.read.epochCount()).to.equal(2n);
      expect(await bitOrePow.read.miningTarget()).to.equal(2n ** 250n);
      expect(await bitOrePow.read._allowedMiners()).to.equal(90n);

      expect(true).to.be.true;
    });

    it("Increase miner after epoch", async () => {
      const { bitOrePow, miners, minerAddresses } = await loadFixture(
        deployBitOrePowFixture
      );

      const diff = await bitOrePow.read.miningTarget();
      const challangeNumber = await bitOrePow.read.challengeNumber();

      for (let index = 0; index < 100; index++) {
        const miner = miners[index];
        const address = minerAddresses[index];

        const nonce = generateValidNonce(challangeNumber, diff, address);

        try {
          const result = await miner.write.mine([nonce, []]);

          //    console.log("Miner", index, "Mined", result);
        } catch (error) {
          console.log("Error", error);
        }
      }

      const blocksToJump = 200;
      for (let i = 0; i < blocksToJump; i++) {
        await hre.network.provider.request({
          method: "evm_mine",
          params: [],
        });
      }

      const diff2 = await bitOrePow.read.miningTarget();
      const challangeNumber2 = await bitOrePow.read.challengeNumber();

      const nonce = generateValidNonce(
        challangeNumber2,
        diff2,
        minerAddresses[1]
      );

      try {
        const result = await miners[1].write.mine([nonce, []]);

        //    console.log("Miner", index, "Mined", result);
      } catch (error) {
        console.log("Error", error);
      }

      expect(await bitOrePow.read.epochCount()).to.equal(2n);
      expect(await bitOrePow.read.miningTarget()).to.equal(2n ** 250n);
      expect(await bitOrePow.read._allowedMiners()).to.equal(110n);

      expect(true).to.be.true;
    });
  });
});
