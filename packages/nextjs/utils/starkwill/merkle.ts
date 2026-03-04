/**
 * StarkWill Merkle Tree Utility
 *
 * Mirrors the Noir circuit's hash2() function exactly:
 *   hash2(a, b) = blake3(a.to_be_bytes(32) || b.to_be_bytes(32))[0..31] as bigint
 *
 * Used for:
 * - Computing heir commitments: commitment = hash2(secret, weight_bps)
 * - Building the Merkle tree from commitments
 * - Generating proof paths for individual heirs
 * - Computing nullifiers: nullifier = hash2(secret, vaultAddress)
 */

import { blake3 } from "@noble/hashes/blake3.js";

const DEPTH = 8; // Matches circuit: global DEPTH: u32 = 8
const ZERO = 0n; // Empty leaf value

/**
 * Convert a bigint to a 32-byte big-endian Uint8Array.
 * Matches Noir's `field.to_be_bytes::<32>()`.
 */
function toBE32(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let v = value;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytes;
}

/**
 * hash2(a, b) — mirrors the Noir circuit exactly.
 * 1. Concatenate a (32 BE bytes) + b (32 BE bytes)
 * 2. Blake3 hash the 64 bytes
 * 3. Take first 31 bytes as big-endian integer (fits BN254 field)
 */
export function hash2(a: bigint, b: bigint): bigint {
  const input = new Uint8Array(64);
  input.set(toBE32(a), 0);
  input.set(toBE32(b), 32);

  const digest = blake3(input);

  let result = 0n;
  for (let i = 0; i < 31; i++) {
    result = result * 256n + BigInt(digest[i]);
  }
  return result;
}

/**
 * Compute an heir's identity commitment from their secret and weight.
 * commitment = hash2(secret, weight_bps)
 */
export function computeCommitment(secret: bigint, weightBps: bigint): bigint {
  return hash2(secret, weightBps);
}

/**
 * Compute a nullifier hash for double-claim prevention.
 * nullifier = hash2(secret, vaultAddress)
 */
export function computeNullifier(secret: bigint, vaultAddress: bigint): bigint {
  return hash2(secret, vaultAddress);
}

/**
 * Precompute zero-hashes for each level.
 * zeroHashes[0] = hash2(0, 0)
 * zeroHashes[i] = hash2(zeroHashes[i-1], zeroHashes[i-1])
 */
function buildZeroHashes(): bigint[] {
  const zh: bigint[] = new Array(DEPTH);
  zh[0] = hash2(ZERO, ZERO);
  for (let i = 1; i < DEPTH; i++) {
    zh[i] = hash2(zh[i - 1], zh[i - 1]);
  }
  return zh;
}

const ZERO_HASHES = buildZeroHashes();

export interface MerkleTree {
  root: bigint;
  leaves: bigint[];
  /** All tree layers. layers[0] = leaves (padded to 2^DEPTH), layers[DEPTH] = [root] */
  layers: bigint[][];
}

/**
 * Build a depth-8 Merkle tree from heir commitments.
 * Empty slots are filled with ZERO (0n).
 */
export function buildMerkleTree(commitments: bigint[]): MerkleTree {
  const leafCount = 1 << DEPTH; // 256
  if (commitments.length > leafCount) {
    throw new Error(`Too many commitments: ${commitments.length} > ${leafCount}`);
  }

  // Pad leaves to 2^DEPTH with zeros
  const leaves = new Array<bigint>(leafCount);
  for (let i = 0; i < leafCount; i++) {
    leaves[i] = i < commitments.length ? commitments[i] : ZERO;
  }

  // Build tree bottom-up
  const layers: bigint[][] = [leaves];
  let current = leaves;

  for (let level = 0; level < DEPTH; level++) {
    const next: bigint[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(hash2(current[i], current[i + 1]));
    }
    layers.push(next);
    current = next;
  }

  return {
    root: current[0],
    leaves,
    layers,
  };
}

export interface MerkleProof {
  /** 0 = leaf is left child, 1 = leaf is right child — per level */
  pathIndices: bigint[];
  /** Sibling hash at each level */
  pathSiblings: bigint[];
}

/**
 * Generate a Merkle proof for a leaf at the given index.
 * Returns pathIndices and pathSiblings matching the Noir circuit inputs.
 */
export function generateMerkleProof(tree: MerkleTree, leafIndex: number): MerkleProof {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) {
    throw new Error(`Leaf index out of range: ${leafIndex}`);
  }

  const pathIndices: bigint[] = [];
  const pathSiblings: bigint[] = [];
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

/**
 * Verify a Merkle proof locally (for testing).
 * Replicates the circuit's verification logic.
 */
export function verifyMerkleProof(
  commitment: bigint,
  root: bigint,
  proof: MerkleProof,
): boolean {
  let current = commitment;
  for (let i = 0; i < DEPTH; i++) {
    const left = proof.pathIndices[i] === 0n ? current : proof.pathSiblings[i];
    const right = proof.pathIndices[i] === 0n ? proof.pathSiblings[i] : current;
    current = hash2(left, right);
  }
  return current === root;
}

/**
 * Format a bigint as a hex string for Noir Prover.toml.
 * Prefixed with 0x.
 */
export function toHex(value: bigint): string {
  return "0x" + value.toString(16);
}

/**
 * Generate the full set of Noir circuit inputs for an heir claim.
 * Returns an object matching the circuit's main() parameters.
 */
export function generateClaimInputs(
  secret: bigint,
  weightBps: bigint,
  tree: MerkleTree,
  leafIndex: number,
  vaultAddress: bigint,
): {
  // Private inputs
  secret: string;
  weight_bps: string;
  path_indices: string[];
  path_siblings: string[];
  // Public inputs
  merkle_root: string;
  nullifier_hash: string;
  vault_address: string;
  weight_bps_pub: string;
} {
  const commitment = computeCommitment(secret, weightBps);
  const proof = generateMerkleProof(tree, leafIndex);
  const nullifier = computeNullifier(secret, vaultAddress);

  // Sanity check
  if (!verifyMerkleProof(commitment, tree.root, proof)) {
    throw new Error("Merkle proof verification failed locally");
  }

  return {
    secret: toHex(secret),
    weight_bps: toHex(weightBps),
    path_indices: proof.pathIndices.map(toHex),
    path_siblings: proof.pathSiblings.map(toHex),
    merkle_root: toHex(tree.root),
    nullifier_hash: toHex(nullifier),
    vault_address: toHex(vaultAddress),
    weight_bps_pub: toHex(weightBps),
  };
}

/**
 * Generate a Prover.toml string from claim inputs.
 * Can be written to disk for nargo execute.
 */
export function toProverToml(inputs: ReturnType<typeof generateClaimInputs>): string {
  const lines: string[] = [];
  lines.push(`secret = "${inputs.secret}"`);
  lines.push(`weight_bps = "${inputs.weight_bps}"`);
  lines.push(`merkle_root = "${inputs.merkle_root}"`);
  lines.push(`nullifier_hash = "${inputs.nullifier_hash}"`);
  lines.push(`vault_address = "${inputs.vault_address}"`);
  lines.push(`weight_bps_pub = "${inputs.weight_bps_pub}"`);
  lines.push("");
  lines.push(`path_indices = [${inputs.path_indices.map((v) => `"${v}"`).join(", ")}]`);
  lines.push(`path_siblings = [${inputs.path_siblings.map((v) => `"${v}"`).join(", ")}]`);
  return lines.join("\n") + "\n";
}
