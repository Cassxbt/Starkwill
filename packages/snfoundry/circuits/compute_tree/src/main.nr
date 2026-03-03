global DEPTH: u32 = 8;

// Use a simple arithmetic hash that works without external libraries
// For the hackathon, the circuit logic matters more than the specific hash
fn hash2(a: Field, b: Field) -> Field {
    // Use blake3 which should be available
    let a_bytes: [u8; 32] = a.to_be_bytes();
    let b_bytes: [u8; 32] = b.to_be_bytes();
    let mut input: [u8; 64] = [0; 64];
    for i in 0..32 {
        input[i] = a_bytes[i];
        input[i + 32] = b_bytes[i];
    }
    let digest: [u8; 32] = std::hash::blake3(input);
    let mut result: Field = 0;
    for i in 0..31 {
        result = result * 256 + digest[i] as Field;
    }
    result
}

fn main(
    secret: pub Field,
    vault_address: pub Field,
) -> pub [Field; 3] {
    let commitment = hash2(secret, 0);
    let mut current = commitment;
    for _i in 0..DEPTH {
        current = hash2(current, 0);
    }
    let merkle_root = current;
    let nullifier_hash = hash2(secret, vault_address);
    [commitment, merkle_root, nullifier_hash]
}
