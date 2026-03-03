/**
 * In-browser ZK proof generation for heir claims.
 * Uses Noir (witness), bb.js (proof), garaga (calldata).
 */

import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import { init as garagaInit, getZKHonkCallData } from "garaga";
import {
  computeCommitment,
  buildMerkleTree,
  generateMerkleProof,
  computeNullifier,
  verifyMerkleProof,
  toHex,
} from "./merkle";

interface CompiledCircuit {
  bytecode: string;
  abi: any;
  debug_symbols?: any;
  file_map?: any;
}

let circuitCache: CompiledCircuit | null = null;
let vkCache: Uint8Array | null = null;
let garagaReady = false;

async function loadCircuit(): Promise<CompiledCircuit> {
  if (circuitCache) return circuitCache;
  const res = await fetch("/circuits/circuit.json");
  const json = await res.json();
  circuitCache = {
    bytecode: json.bytecode,
    abi: json.abi,
    debug_symbols: json.debug_symbols || {},
    file_map: json.file_map || {},
  };
  return circuitCache;
}

async function loadVK(): Promise<Uint8Array> {
  if (vkCache) return vkCache;
  const res = await fetch("/circuits/vk.bin");
  const buf = await res.arrayBuffer();
  vkCache = new Uint8Array(buf);
  return vkCache;
}

async function ensureGaraga(): Promise<void> {
  if (garagaReady) return;
  await garagaInit();
  garagaReady = true;
}

function flattenFieldsAsArray(fields: string[]): Uint8Array {
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
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

export interface ProveResult {
  calldata: bigint[];
  nullifierHash: string;
  merkleRoot: string;
}

/**
 * Generate a ZK proof and Starknet calldata for an heir claim.
 *
 * @param secret - Heir's secret (bigint or hex string)
 * @param commitments - All heir commitments (for building the Merkle tree)
 * @param vaultAddress - Vault contract address as bigint
 * @param onStatus - Progress callback
 */
export async function generateClaimProof(
  secret: bigint,
  commitments: bigint[],
  vaultAddress: bigint,
  onStatus?: (status: string) => void,
): Promise<ProveResult> {
  onStatus?.("Loading circuit artifacts...");
  const [circuit, vk] = await Promise.all([loadCircuit(), loadVK(), ensureGaraga()]);

  onStatus?.("Building Merkle tree...");
  const commitment = computeCommitment(secret);
  const tree = buildMerkleTree(commitments);
  const leafIndex = commitments.findIndex((c) => c === commitment);
  if (leafIndex === -1) {
    throw new Error("Your commitment is not in the heir group");
  }

  const proof = generateMerkleProof(tree, leafIndex);
  if (!verifyMerkleProof(commitment, tree.root, proof)) {
    throw new Error("Local Merkle proof verification failed");
  }

  const nullifier = computeNullifier(secret, vaultAddress);

  const circuitInputs: Record<string, string | string[]> = {
    secret: toHex(secret),
    path_indices: proof.pathIndices.map(toHex),
    path_siblings: proof.pathSiblings.map(toHex),
    merkle_root: toHex(tree.root),
    nullifier_hash: toHex(nullifier),
    vault_address: toHex(vaultAddress),
  };

  onStatus?.("Executing circuit (computing witness)...");
  const noir = new Noir(circuit as any);
  const execResult = await noir.execute(circuitInputs);

  onStatus?.("Generating ZK proof (this may take a moment)...");
  const backend = new UltraHonkBackend(circuit.bytecode, { threads: navigator.hardwareConcurrency || 4 });
  const proofResult = await backend.generateProof(execResult.witness, { keccakZK: true });
  backend.destroy();

  onStatus?.("Converting to Starknet calldata...");
  const publicInputsFlat = flattenFieldsAsArray(proofResult.publicInputs);
  const rawCalldata = getZKHonkCallData(proofResult.proof, publicInputsFlat, vk);

  // Garaga calldata includes a Span length prefix as the first element.
  // Strip it — starknet.js ABI encoding adds its own length prefix for Span<felt252>.
  const calldataArray = Array.from(rawCalldata);
  const spanContent = calldataArray.slice(1);

  return {
    calldata: spanContent.map(BigInt),
    nullifierHash: toHex(nullifier),
    merkleRoot: toHex(tree.root),
  };
}
