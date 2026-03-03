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
  it("should equal hash2(secret, 0)", () => {
    const secret = 12345n;
    expect(computeCommitment(secret)).toBe(hash2(secret, 0n));
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
    const commitment = computeCommitment(42n);
    const tree = buildMerkleTree([commitment]);
    expect(tree.root).toBeDefined();
    expect(tree.leaves[0]).toBe(commitment);
    expect(tree.leaves[1]).toBe(0n); // padded with zeros
  });

  it("should build a tree with 256 leaves", () => {
    const commitments = Array.from({ length: 256 }, (_, i) =>
      computeCommitment(BigInt(i + 1)),
    );
    const tree = buildMerkleTree(commitments);
    expect(tree.layers.length).toBe(9); // 8 levels + leaves
    expect(tree.layers[8].length).toBe(1); // root
  });

  it("should throw for > 256 leaves", () => {
    const commitments = Array.from({ length: 257 }, (_, i) =>
      computeCommitment(BigInt(i)),
    );
    expect(() => buildMerkleTree(commitments)).toThrow();
  });

  it("should produce same root for same inputs", () => {
    const c = [computeCommitment(1n), computeCommitment(2n)];
    const t1 = buildMerkleTree(c);
    const t2 = buildMerkleTree(c);
    expect(t1.root).toBe(t2.root);
  });
});

describe("MerkleProof", () => {
  const secrets = [10n, 20n, 30n];
  const commitments = secrets.map(computeCommitment);
  const tree = buildMerkleTree(commitments);

  it("should verify for each leaf", () => {
    for (let i = 0; i < commitments.length; i++) {
      const proof = generateMerkleProof(tree, i);
      expect(verifyMerkleProof(commitments[i], tree.root, proof)).toBe(true);
    }
  });

  it("should fail for wrong commitment", () => {
    const proof = generateMerkleProof(tree, 0);
    const wrongCommitment = computeCommitment(999n);
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
    const commitments = secrets.map(computeCommitment);
    const tree = buildMerkleTree(commitments);
    const vaultAddress = 0x04a3n;

    const inputs = generateClaimInputs(secrets[1], tree, 1, vaultAddress);

    expect(inputs.secret).toBe("0x14"); // 20 in hex
    expect(inputs.merkle_root).toMatch(/^0x/);
    expect(inputs.nullifier_hash).toMatch(/^0x/);
    expect(inputs.vault_address).toBe("0x4a3");
    expect(inputs.path_indices.length).toBe(8);
    expect(inputs.path_siblings.length).toBe(8);
  });

  it("should throw if commitment not in tree", () => {
    const tree = buildMerkleTree([computeCommitment(1n)]);
    // Secret 999 has commitment at index... nowhere meaningful,
    // but index 0 holds commitment(1), not commitment(999)
    // The local verify check inside generateClaimInputs should catch this
    expect(() => generateClaimInputs(999n, tree, 0, 0n)).toThrow();
  });
});

describe("toProverToml", () => {
  it("should produce valid TOML format", () => {
    const secrets = [10n];
    const commitments = secrets.map(computeCommitment);
    const tree = buildMerkleTree(commitments);

    const inputs = generateClaimInputs(secrets[0], tree, 0, 0x100n);
    const toml = toProverToml(inputs);

    expect(toml).toContain('secret = "0xa"');
    expect(toml).toContain("path_indices = [");
    expect(toml).toContain("path_siblings = [");
    expect(toml).toContain("merkle_root = ");
    expect(toml).toContain("nullifier_hash = ");
    expect(toml).toContain('vault_address = "0x100"');
  });
});
