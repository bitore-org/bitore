import { keccak256, toBytes, hexToBytes, bytesToHex, encodePacked } from "viem";

export function generateValidNonce(
  challengeNumber: any,
  miningTarget: bigint,
  address: any
) {
  let counter = 0;

  while (true) {
    counter++;

    // Generate a random 32-byte nonce
    const nonce = crypto.getRandomValues(new Uint8Array(32));

    const input = encodePacked(
      ["bytes32", "address", "bytes32"],
      [challengeNumber, address, bytesToHex(nonce)]
    );

    // Calculate the digest
    const digest = keccak256(input);

    // Convert digest and miningTarget to BigInt for comparison
    const digestValue = BigInt(digest);
    const targetValue = BigInt(miningTarget);

    // console.log(digestValue, targetValue);

    // Check if the solution is valid
    if (digestValue < targetValue) {
      return bytesToHex(nonce);
    }
  }
}
