// Generate valid test inputs for the heir_membership circuit
// Uses Noir's pedersen_hash computation via nargo

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// We need to compute pedersen hashes the same way Noir does.
// Instead, let's use a simpler approach: write a Noir script that computes
// the merkle tree and outputs the values.

// For now, write a helper circuit that computes and prints values
const helperCircuit = `
use std::hash::pedersen_hash;

global DEPTH: u32 = 8;

fn main(secret: Field, vault_address: Field) -> pub (Field, Field, Field) {
    // Compute commitment
    let commitment = pedersen_hash([secret, 0]);

    // Build a single-leaf merkle tree (all siblings are 0)
    let mut current = commitment;
    for _i in 0..DEPTH {
        current = pedersen_hash([current, 0]);
    }
    let merkle_root = current;

    // Compute nullifier
    let nullifier_hash = pedersen_hash([secret, vault_address]);

    (commitment, merkle_root, nullifier_hash)
}
`;

console.log("Helper circuit to compute valid test values:");
console.log(helperCircuit);
console.log("\nTo generate valid Prover.toml values:");
console.log("1. Create a temp Noir project with this circuit");
console.log("2. Run nargo execute to get the computed values");
console.log("3. Use those values in the main circuit's Prover.toml");
