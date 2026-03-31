#[starknet::interface]
pub trait IMockVerifier<TContractState> {
    fn set_public_inputs(
        ref self: TContractState,
        merkle_root: u256,
        nullifier_hash: u256,
        vault_address: u256,
        weight_bps: u256,
    );
    fn verify_ultra_keccak_zk_honk_proof(
        self: @TContractState, full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}

#[starknet::contract]
mod mock_verifier {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        merkle_root: u256,
        nullifier_hash: u256,
        vault_address: u256,
        weight_bps: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl MockVerifierExternal of super::IMockVerifier<ContractState> {
        fn set_public_inputs(
            ref self: ContractState,
            merkle_root: u256,
            nullifier_hash: u256,
            vault_address: u256,
            weight_bps: u256,
        ) {
            self.merkle_root.write(merkle_root);
            self.nullifier_hash.write(nullifier_hash);
            self.vault_address.write(vault_address);
            self.weight_bps.write(weight_bps);
        }

        fn verify_ultra_keccak_zk_honk_proof(
            self: @ContractState, full_proof_with_hints: Span<felt252>,
        ) -> Result<Span<u256>, felt252> {
            let _ = full_proof_with_hints;
            let mut public_inputs: Array<u256> = array![];
            public_inputs.append(self.merkle_root.read());
            public_inputs.append(self.nullifier_hash.read());
            public_inputs.append(self.vault_address.read());
            public_inputs.append(self.weight_bps.read());
            Result::Ok(public_inputs.span())
        }
    }
}
