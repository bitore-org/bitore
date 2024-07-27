import { createPublicClient, createWalletClient, http } from "viem";
import { liskSepolia, mainnet } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { encodeFunctionData } from "viem";

import dotenv from "dotenv";

dotenv.config();

import { abi } from "../artifacts/contracts/BitOre.sol/BitOrePow.json";
import { generateValidNonce } from "../test/utils/miner";

const contractAddress = process.env.BitOre_POW_Address as `0x${string}`;

const tokenAddress = process.env.BitOre_Token_Address as `0x${string}`;

const client = createPublicClient({
  chain: liskSepolia,
  transport: http("https://rpc.sepolia-api.lisk.com"),
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as any);

const walletClient = createWalletClient({
  account,
  chain: liskSepolia,
  transport: http("https://rpc.sepolia-api.lisk.com"),
});

const functionsToCall = [
  "MAX_DIFFICULTY",
  "MIN_DIFFICULTY",
  "adjustmentBlockHeight",
  "adjustmentBlockTime",
  "ADJUSTMENT_INTERVAL",
  "allTimeGasUsed",
  "_allowedMiners",
  "BASE_DIFFICULT_MULTIPLIER",
  "challengeNumber",
  "currentEpoch",
  "epochCount",
  "_epochLengthInBlocks",
  "epochLengthOptimal",
  "isEpochEnded",
  "MAX_DIFFICULT_MULTIPLIER",
  "minAllowedMiners",
  "miningTarget",
  "GAUSSIAN_THRESHOLD_PERCENT",
];

const mining = async () => {
  const canMine = await client.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "canMine",
    args: [account.address],
  });

  if (!canMine) {
    // Already minted
    return;
  }

  const difficultyMultiplier = await client.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "getDifficultyMultiplier",
    args: [account.address],
  });

  const challangeNumber = await client.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "challengeNumber",
  });

  const miningTarget = await client.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "miningTarget",
  });

  const adjustedMiningTarget =
    ((miningTarget as bigint) * (difficultyMultiplier as bigint)) / 10_000n;

  const nonce = generateValidNonce(
    challangeNumber,
    adjustedMiningTarget as bigint,
    account.address
  );

  const data = encodeFunctionData({
    abi: abi,
    functionName: "mine",
    args: [nonce, [tokenAddress, tokenAddress]],
  });

  const hash = await walletClient.sendTransaction({
    account,
    to: contractAddress,
    value: 0n,
    data: data,
    gasLimit: 1000_000n,
  });

  console.log("Success mined");

  console.log("DATA", data, hash);
};

const start = async () => {
  for (const functionName of functionsToCall) {
    const result = await client.readContract({
      address: contractAddress,
      abi: abi,
      functionName: functionName,
    });
    console.log(`${functionName}:`, result);
  }
};

setInterval(async () => {
  await start();
}, 10000);

setInterval(async () => {
  try {
    await mining();
  } catch (error: any) {
    //   console.log("Error", error.message);
  }
}, 1000);

start().catch(console.error);
