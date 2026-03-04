use starknet::ContractAddress;
use starknet::get_block_timestamp;
use starknet::get_caller_address;
use starknet::get_contract_address;

#[starknet::interface]
pub trait IUltraKeccakZKHonkVerifier<TContractState> {
    fn verify_ultra_keccak_zk_honk_proof(
        self: @TContractState, full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}

#[starknet::interface]
pub trait IVault<TContractState> {
    fn check_in(ref self: TContractState);
    fn add_heir(ref self: TContractState, heir: ContractAddress);
    fn whitelist_token(ref self: TContractState, token: ContractAddress, allowed: bool);
    fn deposit(ref self: TContractState, token: ContractAddress, amount: u256);
    fn guardian_approve_unlock(ref self: TContractState);
    fn recover(ref self: TContractState, token: ContractAddress, to: ContractAddress, amount: u256);
    fn claim(ref self: TContractState, token: ContractAddress, to: ContractAddress, amount: u256);
    fn claim_with_proof(
        ref self: TContractState, full_proof_with_hints: Span<felt252>, token: ContractAddress,
    );
    fn set_verifier_address(ref self: TContractState, verifier: ContractAddress);
    fn set_heir_merkle_root(ref self: TContractState, root: felt252);
    fn is_claimable(self: @TContractState) -> bool;
    fn get_heir_merkle_root(self: @TContractState) -> felt252;
    fn get_verifier_address(self: @TContractState) -> ContractAddress;
    fn is_nullifier_used(self: @TContractState, nullifier: felt252) -> bool;
}

#[starknet::contract]
mod vault {
    use super::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
    use super::{IUltraKeccakZKHonkVerifierDispatcher, IUltraKeccakZKHonkVerifierDispatcherTrait};
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use core::num::traits::Zero;
    use starknet::storage::{
        Map,
        StoragePathEntry,
        StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };

    #[storage]
    struct Storage {
        owner: ContractAddress,
        checkin_period_secs: u64,
        grace_period_secs: u64,
        last_checkin_ts: u64,
        cancelable_until_ts: u64,
        is_unlocked: bool,

        guardians: Map<u32, ContractAddress>,
        guardian_count: u32,
        guardian_approved: Map<ContractAddress, bool>,
        guardian_approval_count: u32,

        heirs: Map<u32, ContractAddress>,
        heir_count: u32,

        token_whitelist: Map<ContractAddress, bool>,

        verifier_address: ContractAddress,
        heir_merkle_root: felt252,
        nullifiers_used: Map<felt252, bool>,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        checkin_period_secs: u64,
        grace_period_secs: u64,
        cancelable_until_ts: u64,
        guardian_1: ContractAddress,
        guardian_2: ContractAddress,
        guardian_3: ContractAddress,
    ) {
        self.owner.write(owner);
        self.checkin_period_secs.write(checkin_period_secs);
        self.grace_period_secs.write(grace_period_secs);
        let now = get_block_timestamp();
        self.last_checkin_ts.write(now);
        self.cancelable_until_ts.write(cancelable_until_ts);
        self.is_unlocked.write(false);

        self.guardians.entry(0).write(guardian_1);
        self.guardians.entry(1).write(guardian_2);
        self.guardians.entry(2).write(guardian_3);
        self.guardian_count.write(3);
        self.guardian_approval_count.write(0);

        self.heir_count.write(0);
    }

    fn assert_only_owner(self: @ContractState) {
        let caller = get_caller_address();
        assert(caller == self.owner.read(), 'ONLY_OWNER');
    }

    fn is_guardian(self: @ContractState, who: ContractAddress) -> bool {
        let mut i: u32 = 0;
        let n = self.guardian_count.read();
        loop {
            if i == n {
                return false;
            }
            if self.guardians.entry(i).read() == who {
                return true;
            }
            i = i + 1;
        };
    }

    fn assert_claimable(self: @ContractState) {
        if self.is_unlocked.read() {
            return;
        }
        let now = get_block_timestamp();
        let last = self.last_checkin_ts.read();
        let period = self.checkin_period_secs.read();
        let grace = self.grace_period_secs.read();
        assert(now > last + period + grace, 'NOT_CLAIMABLE');
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ZKClaim: ZKClaim,
    }

    #[derive(Drop, starknet::Event)]
    struct ZKClaim {
        nullifier_hash: felt252,
        token: ContractAddress,
        amount: u256,
        weight_bps: u256,
    }

    #[abi(embed_v0)]
    impl VaultExternal of super::IVault<ContractState> {
        fn check_in(ref self: ContractState) {
            assert_only_owner(@self);
            let now = get_block_timestamp();
            self.last_checkin_ts.write(now);
        }

        fn add_heir(ref self: ContractState, heir: ContractAddress) {
            assert_only_owner(@self);
            let count = self.heir_count.read();
            self.heirs.entry(count).write(heir);
            self.heir_count.write(count + 1);
        }

        fn whitelist_token(ref self: ContractState, token: ContractAddress, allowed: bool) {
            assert_only_owner(@self);
            self.token_whitelist.entry(token).write(allowed);
        }

        fn deposit(ref self: ContractState, token: ContractAddress, amount: u256) {
            assert(self.token_whitelist.entry(token).read(), 'TOKEN_NOT_ALLOWED');
            let caller = get_caller_address();
            let self_addr = get_contract_address();
            let erc20 = IERC20Dispatcher { contract_address: token };
            erc20.transfer_from(caller, self_addr, amount);
        }

        fn guardian_approve_unlock(ref self: ContractState) {
            let caller = get_caller_address();
            assert(is_guardian(@self, caller), 'ONLY_GUARDIAN');
            if self.guardian_approved.entry(caller).read() {
                return;
            }
            self.guardian_approved.entry(caller).write(true);
            let approvals = self.guardian_approval_count.read() + 1;
            self.guardian_approval_count.write(approvals);
            if approvals >= 2 {
                self.is_unlocked.write(true);
            }
        }

        fn recover(ref self: ContractState, token: ContractAddress, to: ContractAddress, amount: u256) {
            assert_only_owner(@self);
            let now = get_block_timestamp();
            assert(now <= self.cancelable_until_ts.read(), 'CANCEL_WINDOW_OVER');
            let erc20 = IERC20Dispatcher { contract_address: token };
            erc20.transfer(to, amount);
        }

        fn claim(ref self: ContractState, token: ContractAddress, to: ContractAddress, amount: u256) {
            assert_claimable(@self);
            let caller = get_caller_address();
            assert(is_guardian(@self, caller) || caller == self.owner.read(), 'UNAUTHORIZED');
            let erc20 = IERC20Dispatcher { contract_address: token };
            erc20.transfer(to, amount);
        }

        fn claim_with_proof(
            ref self: ContractState, full_proof_with_hints: Span<felt252>, token: ContractAddress,
        ) {
            assert_claimable(@self);

            let verifier_addr = self.verifier_address.read();
            assert(!verifier_addr.is_zero(), 'VERIFIER_NOT_SET');
            assert(self.heir_merkle_root.read() != 0, 'MERKLE_ROOT_NOT_SET');

            let verifier = IUltraKeccakZKHonkVerifierDispatcher {
                contract_address: verifier_addr,
            };
            let result = verifier.verify_ultra_keccak_zk_honk_proof(full_proof_with_hints);
            let public_inputs: Span<u256> = result.expect('ZK_PROOF_INVALID');

            // Public inputs order from our Noir circuit:
            // [0] = merkle_root, [1] = nullifier_hash, [2] = vault_address, [3] = weight_bps_pub
            let pi_len = SpanTrait::len(public_inputs);
            assert(pi_len >= 4, 'BAD_PUBLIC_INPUTS');

            let pi_root: u256 = *SpanTrait::at(public_inputs, 0);
            let pi_nullifier: u256 = *SpanTrait::at(public_inputs, 1);
            let pi_vault: u256 = *SpanTrait::at(public_inputs, 2);
            let pi_weight: u256 = *SpanTrait::at(public_inputs, 3);

            let proof_merkle_root: felt252 = pi_root.try_into().unwrap();
            let nullifier_hash: felt252 = pi_nullifier.try_into().unwrap();
            let proof_vault_addr: felt252 = pi_vault.try_into().unwrap();

            assert(proof_merkle_root == self.heir_merkle_root.read(), 'MERKLE_ROOT_MISMATCH');

            let self_addr = get_contract_address();
            let self_felt: felt252 = self_addr.into();
            assert(proof_vault_addr == self_felt, 'VAULT_ADDR_MISMATCH');

            assert(!self.nullifiers_used.entry(nullifier_hash).read(), 'ALREADY_CLAIMED');
            self.nullifiers_used.entry(nullifier_hash).write(true);

            // Weight is cryptographically bound in the ZK proof (basis points, 1-10000)
            assert(pi_weight > 0, 'ZERO_WEIGHT');
            assert(pi_weight <= 10000, 'WEIGHT_EXCEEDS_MAX');

            let erc20 = IERC20Dispatcher { contract_address: token };
            let balance = erc20.balance_of(get_contract_address());
            let share = balance * pi_weight / 10000;
            assert(share > 0, 'ZERO_SHARE');

            let caller = get_caller_address();
            erc20.transfer(caller, share);
            self.emit(ZKClaim { nullifier_hash, token, amount: share, weight_bps: pi_weight });
        }

        fn set_verifier_address(ref self: ContractState, verifier: ContractAddress) {
            assert_only_owner(@self);
            self.verifier_address.write(verifier);
        }

        fn set_heir_merkle_root(ref self: ContractState, root: felt252) {
            assert_only_owner(@self);
            assert(root != 0, 'INVALID_MERKLE_ROOT');
            self.heir_merkle_root.write(root);
        }

        fn is_claimable(self: @ContractState) -> bool {
            if self.is_unlocked.read() {
                return true;
            }
            let now = get_block_timestamp();
            let last = self.last_checkin_ts.read();
            let period = self.checkin_period_secs.read();
            let grace = self.grace_period_secs.read();
            now > last + period + grace
        }

        fn get_heir_merkle_root(self: @ContractState) -> felt252 {
            self.heir_merkle_root.read()
        }

        fn get_verifier_address(self: @ContractState) -> ContractAddress {
            self.verifier_address.read()
        }

        fn is_nullifier_used(self: @ContractState, nullifier: felt252) -> bool {
            self.nullifiers_used.entry(nullifier).read()
        }
    }
}
