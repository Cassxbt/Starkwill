import { describe, it, expect } from "vitest";
import {
  hash2,
  computeCommitment,
  computeNullifier,
  buildMerkleTree,
  generateMerkleProof,
  verifyMerkleProof,
  generateClaimInputs,
  toProverToml,
} from "./merkle";

const DEFAULT_WEIGHT = 10000n; // 100% for single-heir tests

describe("hash2", () => {
  it("should produce deterministic output", () => {
    const a = hash2(42n, 0n);
    const b = hash2(42n, 0n);
    expect(a).toBe(b);
  });

  it("should produce different output for different inputs", () => {
    const a = hash2(1n, 0n);
    const b = hash2(2n, 0n);
    expect(a).not.toBe(b);
  });

  it("should fit within BN254 field (< 2^248)", () => {
    const result = hash2(123456n, 789n);
    // 31 bytes = 248 bits max
    expect(result).toBeLessThan(2n ** 248n);
  });
});

describe("computeCommitment", () => {
  it("should equal hash2(secret, weight_bps)", () => {
    const secret = 12345n;
    const weight = 5000n;
    expect(computeCommitment(secret, weight)).toBe(hash2(secret, weight));
  });

  it("should produce different commitments for different weights", () => {
    const secret = 42n;
    const c1 = computeCommitment(secret, 5000n);
    const c2 = computeCommitment(secret, 3000n);
    expect(c1).not.toBe(c2);
  });
});

describe("computeNullifier", () => {
  it("should equal hash2(secret, vaultAddress)", () => {
    const secret = 42n;
    const vault = 100n;
    expect(computeNullifier(secret, vault)).toBe(hash2(secret, vault));
  });

  it("should be different for different vaults (scoped nullifier)", () => {
    const secret = 42n;
    const n1 = computeNullifier(secret, 100n);
    const n2 = computeNullifier(secret, 200n);
    expect(n1).not.toBe(n2);
  });
});

describe("MerkleTree", () => {
  it("should build a tree with correct root for single leaf", () => {
    const commitment = computeCommitment(42n, DEFAULT_WEIGHT);
    const tree = buildMerkleTree([commitment]);
    expect(tree.root).toBeDefined();
    expect(tree.leaves[0]).toBe(commitment);
    expect(tree.leaves[1]).toBe(0n); // padded with zeros
  });

  it("should build a tree with 256 leaves", () => {
    const commitments = Array.from({ length: 256 }, (_, i) =>
      computeCommitment(BigInt(i + 1), DEFAULT_WEIGHT),
    );
    const tree = buildMerkleTree(commitments);
    expect(tree.layers.length).toBe(9); // 8 levels + leaves
    expect(tree.layers[8].length).toBe(1); // root
  });

  it("should throw for > 256 leaves", () => {
    const commitments = Array.from({ length: 257 }, (_, i) =>
      computeCommitment(BigInt(i), DEFAULT_WEIGHT),
    );
    expect(() => buildMerkleTree(commitments)).toThrow();
  });

  it("should produce same root for same inputs", () => {
    const c = [computeCommitment(1n, 5000n), computeCommitment(2n, 5000n)];
    const t1 = buildMerkleTree(c);
    const t2 = buildMerkleTree(c);
    expect(t1.root).toBe(t2.root);
  });
});

describe("MerkleProof", () => {
  const secrets = [10n, 20n, 30n];
  const weights = [3333n, 3334n, 3333n];
  const commitments = secrets.map((s, i) => computeCommitment(s, weights[i]));
  const tree = buildMerkleTree(commitments);

  it("should verify for each leaf", () => {
    for (let i = 0; i < commitments.length; i++) {
      const proof = generateMerkleProof(tree, i);
      expect(verifyMerkleProof(commitments[i], tree.root, proof)).toBe(true);
    }
  });

  it("should fail for wrong commitment", () => {
    const proof = generateMerkleProof(tree, 0);
    const wrongCommitment = computeCommitment(999n, DEFAULT_WEIGHT);
    expect(verifyMerkleProof(wrongCommitment, tree.root, proof)).toBe(false);
  });

  it("should fail for wrong root", () => {
    const proof = generateMerkleProof(tree, 0);
    expect(verifyMerkleProof(commitments[0], 999n, proof)).toBe(false);
  });

  it("should have correct depth (8 levels)", () => {
    const proof = generateMerkleProof(tree, 0);
    expect(proof.pathIndices.length).toBe(8);
    expect(proof.pathSiblings.length).toBe(8);
  });
});

describe("generateClaimInputs", () => {
  it("should produce valid Noir circuit inputs", () => {
    const secrets = [10n, 20n, 30n];
    const weight = 3334n;
    const commitments = secrets.map((s) => computeCommitment(s, weight));
    const tree = buildMerkleTree(commitments);
    const vaultAddress = 0x04a3n;

    const inputs = generateClaimInputs(secrets[1], weight, tree, 1, vaultAddress);

    expect(inputs.secret).toBe("0x14"); // 20 in hex
    expect(inputs.weight_bps).toBe("0xd06"); // 3334 in hex
    expect(inputs.weight_bps_pub).toBe("0xd06");
    expect(inputs.merkle_root).toMatch(/^0x/);
    expect(inputs.nullifier_hash).toMatch(/^0x/);
    expect(inputs.vault_address).toBe("0x4a3");
    expect(inputs.path_indices.length).toBe(8);
    expect(inputs.path_siblings.length).toBe(8);
  });

  it("should throw if commitment not in tree", () => {
    const tree = buildMerkleTree([computeCommitment(1n, DEFAULT_WEIGHT)]);
    expect(() => generateClaimInputs(999n, DEFAULT_WEIGHT, tree, 0, 0n)).toThrow();
  });
});

describe("toProverToml", () => {
  it("should produce valid TOML format", () => {
    const secrets = [10n];
    const weight = DEFAULT_WEIGHT;
    const commitments = secrets.map((s) => computeCommitment(s, weight));
    const tree = buildMerkleTree(commitments);

    const inputs = generateClaimInputs(secrets[0], weight, tree, 0, 0x100n);
    const toml = toProverToml(inputs);

    expect(toml).toContain('secret = "0xa"');
    expect(toml).toContain("weight_bps = ");
    expect(toml).toContain("weight_bps_pub = ");
    expect(toml).toContain("path_indices = [");
    expect(toml).toContain("path_siblings = [");
    expect(toml).toContain("merkle_root = ");
    expect(toml).toContain("nullifier_hash = ");
    expect(toml).toContain('vault_address = "0x100"');
  });
});
