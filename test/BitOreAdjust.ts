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

describe("BitOrePow", function () {
  async function deployBitOrePowFixture() {
    hre.config;

    const minerClients = await hre.viem.getWalletClients();

    const bitOrePow = await hre.viem.deployContract("BitOrePow", [
      1000n, // epoch adjustment interval
      150n, // epoch lengts
      100n, // allowed miners
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

  describe("Scale tests", function () {
    it("Reach minimum miner after 100 Epoch", async () => {
      const { bitOrePow, miners, minerAddresses } = await loadFixture(
        deployBitOrePowFixture
      );

      for (let index = 0; index < 100; index++) {
        const diff = await bitOrePow.read.miningTarget();
        const challangeNumber = await bitOrePow.read.challengeNumber();

        const miner = miners[1];
        const address = minerAddresses[1];

        const nonce = generateValidNonce(challangeNumber, diff, address);

        try {
          const result = await miner.write.mine([nonce, []]);
        } catch (error) {
          console.log("Error", error);
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

        const nonce2 = generateValidNonce(
          challangeNumber2,
          diff2,
          minerAddresses[130]
        );

        try {
          const result = await miners[130].write.mine([nonce2, []]);

          //    console.log("Miner", index, "Mined", result);
        } catch (error) {
          console.log("Error", error);
        }
      }

      expect(await bitOrePow.read.epochCount()).to.equal(101n);
      expect(await bitOrePow.read.miningTarget()).to.equal(2n ** 250n);
      expect(await bitOrePow.read._allowedMiners()).to.equal(10n);

      expect(true).to.be.true;
    });

    it("Increase miner after 100 epoch", async () => {
      const { bitOrePow, miners, minerAddresses } = await loadFixture(
        deployBitOrePowFixture
      );

      for (let index = 0; index < 10; index++) {
        const diff = await bitOrePow.read.miningTarget();
        const challangeNumber = await bitOrePow.read.challengeNumber();

        for (let index = 0; index < 145; index++) {
          const miner = miners[index];
          const address = minerAddresses[index];

          const nonce = generateValidNonce(challangeNumber, diff, address);

          try {
            const result = await miner.write.mine([nonce, []]);

            //    console.log("Miner", index, "Mined", result);
          } catch (error) {
            // console.log("Error", error);
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
          // console.log("Error", error);
        }
      }

      expect(await bitOrePow.read.epochCount()).to.equal(11n);
      expect(await bitOrePow.read.miningTarget()).to.equal(2n ** 250n);
      expect(await bitOrePow.read._allowedMiners()).to.equal(146n);

      expect(true).to.be.true;
    });

    it("Increase difficulty", async () => {
      const { bitOrePow, miners, minerAddresses } = await loadFixture(
        deployBitOrePowFixture
      );

      const publicClient = await hre.viem.getPublicClient();

      let difficulty = 2n ** 250n;
      let allowedMiners = 100n;

      for (let index = 0; index < 5; index++) {
        const diff = await bitOrePow.read.miningTarget();
        const challangeNumber = await bitOrePow.read.challengeNumber();

        const _allowedMiners = await bitOrePow.read._allowedMiners();
        const simpleGaussian =
          await bitOrePow.read.GAUSSIAN_THRESHOLD_PERCENT();

        await hre.network.provider.request({
          method: "evm_setAutomine",
          params: [false],
        });

        const gaussianMinerlimit = (_allowedMiners * simpleGaussian) / 100_000n;

        for (let index = 0; index < Number(gaussianMinerlimit); index++) {
          const miner = miners[index];
          const address = minerAddresses[index];

          const nonce = generateValidNonce(challangeNumber, diff, address);

          try {
            await miner.write.mine([nonce, []]);
          } catch (error) {}
        }

        await hre.network.provider.request({
          method: "evm_setAutomine",
          params: [true],
        });

        const thisEpoch = await bitOrePow.read.currentEpoch();

        await hre.network.provider.request({
          method: "hardhat_mine",
          params: ["0xC8"],
        });

        const diff2 = await bitOrePow.read.miningTarget();
        const challangeNumber2 = await bitOrePow.read.challengeNumber();

        const nonce = generateValidNonce(
          challangeNumber2,
          diff2,
          minerAddresses[1]
        );

        try {
          await miners[1].write.mine([nonce, []]);
        } catch (error) {}

        expect(await bitOrePow.read.epochCount()).to.equal(
          1n + BigInt(index) + 1n
        );

        difficulty = difficulty - (difficulty * 10n) / 100n;

        expect(await bitOrePow.read.miningTarget()).to.equal(difficulty);

        expect(await bitOrePow.read._allowedMiners()).to.equal(100n);
      }
    });

    it("Smoke Test", async () => {
      const { bitOrePow, miners, minerAddresses } = await loadFixture(
        deployBitOrePowFixture
      );

      const publicClient = await hre.viem.getPublicClient();

      let difficulty = 2n ** 250n;
      let allowedMiners = 100n;

      for (let index = 0; index < 5; index++) {
        const diff = await bitOrePow.read.miningTarget();
        const challangeNumber = await bitOrePow.read.challengeNumber();

        const _allowedMiners = await bitOrePow.read._allowedMiners();

        await hre.network.provider.request({
          method: "evm_setAutomine",
          params: [false],
        });

        const startTime = Date.now();

        for (let index = 0; index < Number(_allowedMiners); index++) {
          const miner = miners[index];
          const address = minerAddresses[index];

          const nonce = generateValidNonce(challangeNumber, diff, address);

          try {
            await miner.write.mine([nonce, []]);
          } catch (error) {}
        }

        console.log("Mining take: ", Date.now() - startTime, "ms");

        await hre.network.provider.request({
          method: "evm_setAutomine",
          params: [true],
        });

        const thisEpoch = await bitOrePow.read.currentEpoch();

        await hre.network.provider.request({
          method: "hardhat_mine",
          params: ["0xC8"],
        });

        const diff2 = await bitOrePow.read.miningTarget();
        const challangeNumber2 = await bitOrePow.read.challengeNumber();

        const nonce = generateValidNonce(
          challangeNumber2,
          diff2,
          minerAddresses[1]
        );

        try {
          await miners[1].write.mine([nonce, []]);
        } catch (error) {}

        expect(await bitOrePow.read.epochCount()).to.equal(
          1n + BigInt(index) + 1n
        );

        difficulty = difficulty - (difficulty * 10n) / 100n;

        expect(await bitOrePow.read.miningTarget()).to.equal(difficulty);

        allowedMiners = allowedMiners + (allowedMiners * 1000n) / 10000n;

        expect(await bitOrePow.read._allowedMiners()).to.equal(allowedMiners);
      }

      for (let index = 5; index < 10; index++) {
        const diff = await bitOrePow.read.miningTarget();
        const challangeNumber = await bitOrePow.read.challengeNumber();

        const _allowedMiners = await bitOrePow.read._allowedMiners();

        await hre.network.provider.request({
          method: "evm_setAutomine",
          params: [false],
        });

        for (let index = 0; index < Number(_allowedMiners / 3n); index++) {
          const miner = miners[index];
          const address = minerAddresses[index];

          const nonce = generateValidNonce(challangeNumber, diff, address);

          try {
            await miner.write.mine([nonce, []]);
          } catch (error) {}
        }

        await hre.network.provider.request({
          method: "evm_setAutomine",
          params: [true],
        });

        const thisEpoch = await bitOrePow.read.currentEpoch();

        await hre.network.provider.request({
          method: "hardhat_mine",
          params: ["0xC8"],
        });

        const diff2 = await bitOrePow.read.miningTarget();
        const challangeNumber2 = await bitOrePow.read.challengeNumber();

        const nonce = generateValidNonce(
          challangeNumber2,
          diff2,
          minerAddresses[1]
        );

        try {
          await miners[1].write.mine([nonce, []]);
        } catch (error) {}

        expect(await bitOrePow.read.epochCount()).to.equal(
          1n + BigInt(index) + 1n
        );

        difficulty = difficulty + (difficulty * 10n) / 100n;

        expect(await bitOrePow.read.miningTarget()).to.equal(difficulty);

        allowedMiners = allowedMiners - (allowedMiners * 1000n) / 10000n;

        expect(await bitOrePow.read._allowedMiners()).to.equal(allowedMiners);
      }
    });
  });
});
