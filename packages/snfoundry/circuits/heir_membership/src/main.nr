// StarkWill - Heir Membership Proof Circuit
// Proves: "I know a secret whose commitment is in the heir Merkle tree"
// Without revealing: which heir I am

global DEPTH: u32 = 8;

fn hash2(a: Field, b: Field) -> Field {
    let a_bytes: [u8; 32] = a.to_be_bytes();
    let b_bytes: [u8; 32] = b.to_be_bytes();
    let mut input: [u8; 64] = [0; 64];
    for i in 0..32 {
        input[i] = a_bytes[i];
        input[i + 32] = b_bytes[i];
    }
    let digest: [u8; 32] = std::hash::blake3(input);
    // Take 31 bytes to fit in BN254 field
    let mut result: Field = 0;
    for i in 0..31 {
        result = result * 256 + digest[i] as Field;
    }
    result
}

fn main(
    // Private inputs (witness - never revealed on-chain)
    secret: Field,
    path_indices: [Field; DEPTH],
    path_siblings: [Field; DEPTH],

    // Public inputs (visible on-chain, embedded in the proof)
    merkle_root: pub Field,
    nullifier_hash: pub Field,
    vault_address: pub Field,
) {
    // 1. Compute identity commitment from secret
    let commitment = hash2(secret, 0);

    // 2. Verify Merkle membership - walk from leaf to root
    let mut current = commitment;
    for i in 0..DEPTH {
        let left = if path_indices[i] == 0 { current } else { path_siblings[i] };
        let right = if path_indices[i] == 0 { path_siblings[i] } else { current };
        current = hash2(left, right);
    }
    assert(current == merkle_root, "Merkle proof invalid");

    // 3. Compute and verify nullifier (prevents double-claiming)
    let computed_nullifier = hash2(secret, vault_address);
    assert(computed_nullifier == nullifier_hash, "Nullifier mismatch");
}
