/**
 * E2E test: Generate ZK proof and submit claim_with_proof on Starknet Sepolia.
 *
 * Usage: node scripts/e2e-claim-test.mjs
 *
 * Prerequisites:
 * - Vault deployed at VAULT_ADDRESS with short timers (already claimable)
 * - Verifier deployed and set on vault
 * - Merkle root set with 3 heirs (secrets: 42, 123, 456)
 * - STRK whitelisted and deposited (10 STRK)
 */

import { readFileSync } from "fs";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import { init as garagaInit, getZKHonkCallData } from "garaga";
import { blake3 } from "@noble/hashes/blake3.js";
import { RpcProvider, Account, Contract, CallData, Signer } from "starknet";

// ── Config (set these in your .env or export before running) ──
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "0x055fbb6facff75ee0f8146f32c9da8a67b0ece9c1d99fa0257b830375c9fef37";
const STRK_ADDRESS = process.env.STRK_ADDRESS || "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const PRIVATE_KEY = process.env.PRIVATE_KEY_SEPOLIA;
const ACCOUNT_ADDRESS = process.env.ACCOUNT_ADDRESS_SEPOLIA;
const RPC_URL = process.env.RPC_URL_SEPOLIA || "https://free-rpc.nethermind.io/sepolia-juno/v0_7";

if (!PRIVATE_KEY || !ACCOUNT_ADDRESS) {
  console.error("Missing PRIVATE_KEY_SEPOLIA or ACCOUNT_ADDRESS_SEPOLIA env vars.");
  process.exit(1);
}

const HEIR_SECRET = 42n;
const ALL_SECRETS = [42n, 123n, 456n];

// ── Merkle utils (mirrors merkle.ts) ──
const DEPTH = 8;
const ZERO = 0n;

function toBE32(value) {
  const bytes = new Uint8Array(32);
  let v = value;
  for (let i = 31; i >= 0; i--) { bytes[i] = Number(v & 0xffn); v >>= 8n; }
  return bytes;
}

function hash2(a, b) {
  const input = new Uint8Array(64);
  input.set(toBE32(a), 0);
  input.set(toBE32(b), 32);
  const digest = blake3(input);
  let result = 0n;
  for (let i = 0; i < 31; i++) { result = result * 256n + BigInt(digest[i]); }
  return result;
}

function computeCommitment(secret) { return hash2(secret, ZERO); }
function computeNullifier(secret, vaultAddr) { return hash2(secret, vaultAddr); }

function buildMerkleTree(commitments) {
  const leafCount = 1 << DEPTH;
  const leaves = new Array(leafCount);
  for (let i = 0; i < leafCount; i++) {
    leaves[i] = i < commitments.length ? commitments[i] : ZERO;
  }
  const layers = [leaves];
  let current = leaves;
  for (let level = 0; level < DEPTH; level++) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) { next.push(hash2(current[i], current[i + 1])); }
    layers.push(next);
    current = next;
  }
  return { root: current[0], leaves, layers };
}

function generateMerkleProof(tree, leafIndex) {
  const pathIndices = [];
  const pathSiblings = [];
  let idx = leafIndex;
  for (let level = 0; level < DEPTH; level++) {
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    pathIndices.push(isRight ? 1n : 0n);
    pathSiblings.push(tree.layers[level][siblingIdx]);
    idx = Math.floor(idx / 2);
  }
  return { pathIndices, pathSiblings };
}

function toHex(value) { return "0x" + value.toString(16); }

function flattenFieldsAsArray(fields) {
  const arrays = fields.map((hex) => {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    const padded = clean.padStart(64, "0");
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  });
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

// ── Main ──
async function main() {
  console.log("=== StarkWill E2E ZK Claim Test ===\n");

  // Step 1: Load circuit + VK
  console.log("1. Loading circuit and VK...");
  const circuitJson = JSON.parse(readFileSync("public/circuits/circuit.json", "utf8"));
  const circuit = {
    bytecode: circuitJson.bytecode,
    abi: circuitJson.abi,
    debug_symbols: circuitJson.debug_symbols || {},
    file_map: circuitJson.file_map || {},
  };
  const vk = new Uint8Array(readFileSync("public/circuits/vk.bin"));
  console.log(`   Circuit loaded. VK size: ${vk.length} bytes`);

  // Step 2: Init garaga
  console.log("2. Initializing Garaga WASM...");
  await garagaInit();
  console.log("   Garaga ready.");

  // Step 3: Build Merkle tree + proof
  console.log("3. Building Merkle tree and proof...");
  const vaultAddr = BigInt(VAULT_ADDRESS);
  const commitments = ALL_SECRETS.map(computeCommitment);
  const tree = buildMerkleTree(commitments);
  const commitment = computeCommitment(HEIR_SECRET);
  const leafIndex = commitments.findIndex((c) => c === commitment);
  const merkleProof = generateMerkleProof(tree, leafIndex);
  const nullifier = computeNullifier(HEIR_SECRET, vaultAddr);

  console.log(`   Merkle root: ${toHex(tree.root)}`);
  console.log(`   Nullifier: ${toHex(nullifier)}`);
  console.log(`   Leaf index: ${leafIndex}`);

  // Step 4: Execute circuit (compute witness)
  console.log("4. Executing Noir circuit (witness)...");
  const circuitInputs = {
    secret: toHex(HEIR_SECRET),
    path_indices: merkleProof.pathIndices.map(toHex),
    path_siblings: merkleProof.pathSiblings.map(toHex),
    merkle_root: toHex(tree.root),
    nullifier_hash: toHex(nullifier),
    vault_address: toHex(vaultAddr),
  };
  const noir = new Noir(circuit);
  const execResult = await noir.execute(circuitInputs);
  console.log(`   Witness computed. Size: ${execResult.witness.length} bytes`);

  // Step 5: Generate ZK proof
  console.log("5. Generating ZK proof (bb.js WASM, keccakZK)...");
  const startTime = Date.now();
  const backend = new UltraHonkBackend(circuit.bytecode, { threads: 4 });
  const proofResult = await backend.generateProof(execResult.witness, { keccakZK: true });
  backend.destroy();
  const proofTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   Proof generated in ${proofTime}s. Size: ${proofResult.proof.length} bytes`);
  console.log(`   Public inputs: ${proofResult.publicInputs.length}`);

  // Step 6: Convert to Starknet calldata
  console.log("6. Converting to Starknet calldata (Garaga)...");
  const publicInputsFlat = flattenFieldsAsArray(proofResult.publicInputs);
  const calldata = getZKHonkCallData(proofResult.proof, publicInputsFlat, vk);
  console.log(`   Calldata: ${calldata.length} felts`);

  // Step 7: Submit on-chain
  console.log("7. Submitting claim_with_proof on-chain...");
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const signer = new Signer(PRIVATE_KEY);
  const account = new Account({ provider, address: ACCOUNT_ADDRESS, signer });

  // Try passing Garaga calldata as-is (it may include its own span length)
  // Then append token address
  const calldataHex = Array.from(calldata).map(v => "0x" + v.toString(16));
  console.log(`   Garaga calldata[0] (possible span len): ${calldataHex[0]} = ${calldata[0]}`);
  console.log(`   Garaga calldata[1]: ${calldataHex[1]} = ${calldata[1]}`);

  // Approach: Garaga calldata IS the full_proof_with_hints Span content
  // ABI encoding for Span<felt252> is [length, ...elements]
  // BUT maybe Garaga already wrapped it? First element 0xba3=2979 + 1 = 2980 = total length
  // So Garaga calldata = [span_len=2979, ...span_data(2979 elements)]
  // That means Garaga calldata IS already the serialized Span
  const rawCalldata = [
    ...calldataHex,  // Already-serialized Span (includes length prefix)
    STRK_ADDRESS,    // token: ContractAddress
  ];
  console.log(`   Raw calldata: ${rawCalldata.length} felts`);

  const tx = await account.execute({
    contractAddress: VAULT_ADDRESS,
    entrypoint: "claim_with_proof",
    calldata: rawCalldata,
  });

  console.log(`   Transaction hash: ${tx.transaction_hash}`);
  console.log(`   Waiting for confirmation...`);

  const receipt = await provider.waitForTransaction(tx.transaction_hash, {
    retryInterval: 5000,
  });

  console.log(`   Status: ${receipt.statusReceipt || receipt.execution_status}`);
  console.log(`\n=== E2E TEST COMPLETE ===`);
  console.log(`   Vault: ${VAULT_ADDRESS}`);
  console.log(`   Tx: https://sepolia.starkscan.co/tx/${tx.transaction_hash}`);
}

main().catch((err) => {
  console.error("\nE2E TEST FAILED:");
  // Extract the actual error, not the huge calldata dump
  if (err.baseError) {
    console.error("Base error:", JSON.stringify(err.baseError, null, 2));
  }
  if (err.message) {
    // Try to find the actual error after the params dump
    const errIdx = err.message.indexOf('"error"');
    if (errIdx !== -1) {
      console.error("RPC error:", err.message.substring(errIdx, errIdx + 500));
    } else {
      // Just show last 500 chars
      const msg = err.message;
      console.error(msg.length > 500 ? "..." + msg.substring(msg.length - 500) : msg);
    }
  } else {
    console.error(err);
  }
  process.exit(1);
});
