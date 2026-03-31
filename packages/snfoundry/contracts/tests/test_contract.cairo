use starkwill::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use starkwill::mock_verifier::{IMockVerifierDispatcher, IMockVerifierDispatcherTrait};
use starkwill::vault::{IVaultDispatcher, IVaultDispatcherTrait};
use starkwill::vault_factory::{IVaultFactoryDispatcher, IVaultFactoryDispatcherTrait};
use snforge_std::{
    CheatSpan, ContractClassTrait, DeclareResultTrait,
    cheat_caller_address, cheat_block_timestamp, declare,
};
use starknet::ContractAddress;

fn OWNER() -> ContractAddress {
    'owner'.try_into().unwrap()
}
fn GUARDIAN_1() -> ContractAddress {
    'guardian1'.try_into().unwrap()
}
fn GUARDIAN_2() -> ContractAddress {
    'guardian2'.try_into().unwrap()
}
fn GUARDIAN_3() -> ContractAddress {
    'guardian3'.try_into().unwrap()
}
fn HEIR_1() -> ContractAddress {
    'heir1'.try_into().unwrap()
}
fn HEIR_2() -> ContractAddress {
    'heir2'.try_into().unwrap()
}
fn HEIR_3() -> ContractAddress {
    'heir3'.try_into().unwrap()
}
fn DEPOSITOR() -> ContractAddress {
    'depositor'.try_into().unwrap()
}

const CHECKIN_PERIOD: u64 = 2592000; // 30 days
const GRACE_PERIOD: u64 = 604800; // 7 days
const CANCEL_UNTIL: u64 = 31536000; // 1 year
const MERKLE_ROOT: felt252 = 0x1234;

fn addr_as_u256(addr: ContractAddress) -> u256 {
    let addr_felt: felt252 = addr.into();
    addr_felt.try_into().unwrap()
}

fn deploy_vault() -> (ContractAddress, IVaultDispatcher) {
    let contract = declare("vault").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    calldata.append(OWNER().into());
    calldata.append(CHECKIN_PERIOD.into());
    calldata.append(GRACE_PERIOD.into());
    calldata.append(CANCEL_UNTIL.into());
    calldata.append(GUARDIAN_1().into());
    calldata.append(GUARDIAN_2().into());
    calldata.append(GUARDIAN_3().into());
    let (addr, _) = contract.deploy(@calldata).unwrap();
    (addr, IVaultDispatcher { contract_address: addr })
}

fn deploy_factory() -> (ContractAddress, IVaultFactoryDispatcher) {
    let vault_class = declare("vault").unwrap().contract_class();
    let factory_class = declare("vault_factory").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    calldata.append((*vault_class.class_hash).into());
    let (addr, _) = factory_class.deploy(@calldata).unwrap();
    (addr, IVaultFactoryDispatcher { contract_address: addr })
}

fn deploy_mock_token() -> (ContractAddress, IMockERC20Dispatcher) {
    let contract = declare("mock_erc20").unwrap().contract_class();
    let calldata: Array<felt252> = array![];
    let (addr, _) = contract.deploy(@calldata).unwrap();
    (addr, IMockERC20Dispatcher { contract_address: addr })
}

fn deploy_mock_verifier() -> (ContractAddress, IMockVerifierDispatcher) {
    let contract = declare("mock_verifier").unwrap().contract_class();
    let calldata: Array<felt252> = array![];
    let (addr, _) = contract.deploy(@calldata).unwrap();
    (addr, IMockVerifierDispatcher { contract_address: addr })
}

fn configure_two_token_claimable_vault() -> (
    ContractAddress, IVaultDispatcher, ContractAddress, IMockERC20Dispatcher, ContractAddress,
    IMockERC20Dispatcher, IMockVerifierDispatcher,
) {
    let (vault_addr, vault) = deploy_vault();
    let (token_1_addr, token_1) = deploy_mock_token();
    let (token_2_addr, token_2) = deploy_mock_token();
    let (verifier_addr, verifier) = deploy_mock_verifier();

    cheat_caller_address(vault_addr, OWNER(), CheatSpan::TargetCalls(4));
    vault.set_heir_merkle_root(MERKLE_ROOT);
    vault.set_verifier_address(verifier_addr);
    vault.whitelist_token(token_1_addr, true);
    vault.whitelist_token(token_2_addr, true);

    cheat_caller_address(token_1_addr, OWNER(), CheatSpan::TargetCalls(1));
    token_1.mint(DEPOSITOR(), 10_000_u256);
    cheat_caller_address(token_2_addr, OWNER(), CheatSpan::TargetCalls(1));
    token_2.mint(DEPOSITOR(), 5_000_u256);

    cheat_caller_address(token_1_addr, DEPOSITOR(), CheatSpan::TargetCalls(1));
    token_1.approve(vault_addr, 10_000_u256);
    cheat_caller_address(vault_addr, DEPOSITOR(), CheatSpan::TargetCalls(1));
    vault.deposit(token_1_addr, 10_000_u256);

    cheat_caller_address(token_2_addr, DEPOSITOR(), CheatSpan::TargetCalls(1));
    token_2.approve(vault_addr, 5_000_u256);
    cheat_caller_address(vault_addr, DEPOSITOR(), CheatSpan::TargetCalls(1));
    vault.deposit(token_2_addr, 5_000_u256);

    let future_ts = CHECKIN_PERIOD + GRACE_PERIOD + 1;
    cheat_block_timestamp(vault_addr, future_ts, CheatSpan::Indefinite);

    (vault_addr, vault, token_1_addr, token_1, token_2_addr, token_2, verifier)
}

fn configure_claimable_vault() -> (
    ContractAddress, IVaultDispatcher, ContractAddress, IMockERC20Dispatcher, IMockVerifierDispatcher,
) {
    let (vault_addr, vault) = deploy_vault();
    let (token_addr, token) = deploy_mock_token();
    let (verifier_addr, verifier) = deploy_mock_verifier();

    cheat_caller_address(vault_addr, OWNER(), CheatSpan::TargetCalls(3));
    vault.set_heir_merkle_root(MERKLE_ROOT);
    vault.set_verifier_address(verifier_addr);
    vault.whitelist_token(token_addr, true);

    cheat_caller_address(token_addr, OWNER(), CheatSpan::TargetCalls(1));
    token.mint(DEPOSITOR(), 10_000_u256);

    cheat_caller_address(token_addr, DEPOSITOR(), CheatSpan::TargetCalls(1));
    token.approve(vault_addr, 10_000_u256);

    cheat_caller_address(vault_addr, DEPOSITOR(), CheatSpan::TargetCalls(1));
    vault.deposit(token_addr, 10_000_u256);

    let future_ts = CHECKIN_PERIOD + GRACE_PERIOD + 1;
    cheat_block_timestamp(vault_addr, future_ts, CheatSpan::Indefinite);

    (vault_addr, vault, token_addr, token, verifier)
}

#[test]
fn test_deploy_and_check_in() {
    let (addr, dispatcher) = deploy_vault();

    // Owner can check in
    cheat_caller_address(addr, OWNER(), CheatSpan::TargetCalls(1));
    dispatcher.check_in();

    // Should not be claimable right after check-in
    assert(!dispatcher.is_claimable(), 'Should not be claimable');
}

#[test]
#[should_panic(expected: 'ONLY_OWNER')]
fn test_check_in_not_owner() {
    let (addr, dispatcher) = deploy_vault();
    cheat_caller_address(addr, HEIR_1(), CheatSpan::TargetCalls(1));
    dispatcher.check_in();
}

#[test]
fn test_guardian_unlock() {
    let (addr, dispatcher) = deploy_vault();

    // Guardian 1 approves
    cheat_caller_address(addr, GUARDIAN_1(), CheatSpan::TargetCalls(1));
    dispatcher.guardian_approve_unlock();
    assert(!dispatcher.is_claimable(), 'Should need 2 guardians');

    // Guardian 2 approves -> unlocked
    cheat_caller_address(addr, GUARDIAN_2(), CheatSpan::TargetCalls(1));
    dispatcher.guardian_approve_unlock();
    assert(dispatcher.is_claimable(), 'Should be claimable after 2');
}

#[test]
fn test_claimable_after_timeout() {
    let (addr, dispatcher) = deploy_vault();

    // Fast-forward past checkin + grace period
    let future_ts = CHECKIN_PERIOD + GRACE_PERIOD + 1;
    cheat_block_timestamp(addr, future_ts, CheatSpan::Indefinite);

    assert(dispatcher.is_claimable(), 'Should be claimable');
}

#[test]
fn test_set_heir_merkle_root() {
    let (addr, dispatcher) = deploy_vault();

    cheat_caller_address(addr, OWNER(), CheatSpan::TargetCalls(1));
    dispatcher.set_heir_merkle_root(0x1234);

    assert(dispatcher.get_heir_merkle_root() == 0x1234, 'Root mismatch');
}

#[test]
fn test_set_verifier_address() {
    let (addr, dispatcher) = deploy_vault();
    let verifier: ContractAddress = 'verifier'.try_into().unwrap();

    cheat_caller_address(addr, OWNER(), CheatSpan::TargetCalls(1));
    dispatcher.set_verifier_address(verifier);

    assert(dispatcher.get_verifier_address() == verifier, 'Verifier mismatch');
}

#[test]
#[should_panic(expected: 'VAULT_EXISTS')]
fn test_factory_rejects_second_vault_for_same_owner() {
    let (factory_addr, factory) = deploy_factory();
    cheat_caller_address(factory_addr, OWNER(), CheatSpan::TargetCalls(2));
    factory.create_vault(
        CHECKIN_PERIOD,
        GRACE_PERIOD,
        CANCEL_UNTIL,
        GUARDIAN_1(),
        GUARDIAN_2(),
        GUARDIAN_3(),
    );
    factory.create_vault(
        CHECKIN_PERIOD,
        GRACE_PERIOD,
        CANCEL_UNTIL,
        GUARDIAN_1(),
        GUARDIAN_2(),
        GUARDIAN_3(),
    );
}

#[test]
#[should_panic(expected: 'ONLY_OWNER')]
fn test_set_merkle_root_not_owner() {
    let (addr, dispatcher) = deploy_vault();

    cheat_caller_address(addr, HEIR_1(), CheatSpan::TargetCalls(1));
    dispatcher.set_heir_merkle_root(0x1234);
}

#[test]
fn test_nullifier_initially_unused() {
    let (_addr, dispatcher) = deploy_vault();
    let token: ContractAddress = 'token'.try_into().unwrap();
    assert(!dispatcher.is_nullifier_used(token, 0xdead), 'Should be unused');
}

#[test]
fn test_not_claimable_before_timeout() {
    let (addr, dispatcher) = deploy_vault();

    // Advance to exactly checkin + grace (not past it)
    let boundary_ts = CHECKIN_PERIOD + GRACE_PERIOD;
    cheat_block_timestamp(addr, boundary_ts, CheatSpan::Indefinite);

    assert(!dispatcher.is_claimable(), 'Should NOT be claimable yet');
}

#[test]
#[should_panic(expected: 'ONLY_GUARDIAN')]
fn test_non_guardian_cannot_approve() {
    let (addr, dispatcher) = deploy_vault();
    cheat_caller_address(addr, HEIR_1(), CheatSpan::TargetCalls(1));
    dispatcher.guardian_approve_unlock();
}

#[test]
fn test_check_in_resets_timer() {
    let (addr, dispatcher) = deploy_vault();

    // Advance to midway through the checkin period
    let mid_ts = CHECKIN_PERIOD / 2;
    cheat_block_timestamp(addr, mid_ts, CheatSpan::Indefinite);

    // Owner checks in — this resets the timer to `mid_ts`
    cheat_caller_address(addr, OWNER(), CheatSpan::TargetCalls(1));
    dispatcher.check_in();

    // Advance by checkin + grace from the original deploy time
    // This would have been claimable WITHOUT the reset
    let would_be_claimable = CHECKIN_PERIOD + GRACE_PERIOD + 1;
    cheat_block_timestamp(addr, would_be_claimable, CheatSpan::Indefinite);

    // But because we checked in at mid_ts, deadline is now mid_ts + period + grace
    // which is greater than would_be_claimable
    assert(!dispatcher.is_claimable(), 'Timer should have reset');
}

#[test]
#[should_panic(expected: 'CLAIM_PHASE_STARTED')]
fn test_check_in_cannot_relock_after_guardian_unlock() {
    let (addr, dispatcher) = deploy_vault();

    cheat_caller_address(addr, GUARDIAN_1(), CheatSpan::TargetCalls(1));
    dispatcher.guardian_approve_unlock();
    cheat_caller_address(addr, GUARDIAN_2(), CheatSpan::TargetCalls(1));
    dispatcher.guardian_approve_unlock();
    assert(dispatcher.is_claimable(), 'Should unlock after 2 approvals');

    cheat_caller_address(addr, OWNER(), CheatSpan::TargetCalls(1));
    dispatcher.check_in();
}

#[test]
#[should_panic(expected: 'CLAIM_PHASE_STARTED')]
fn test_check_in_reverts_once_vault_is_claimable() {
    let (vault_addr, vault, _token_addr, _token, _verifier) = configure_claimable_vault();
    cheat_caller_address(vault_addr, OWNER(), CheatSpan::TargetCalls(1));
    vault.check_in();
}

#[test]
fn test_guardian_double_approve_idempotent() {
    let (addr, dispatcher) = deploy_vault();

    // Guardian 1 approves twice
    cheat_caller_address(addr, GUARDIAN_1(), CheatSpan::TargetCalls(1));
    dispatcher.guardian_approve_unlock();
    cheat_caller_address(addr, GUARDIAN_1(), CheatSpan::TargetCalls(1));
    dispatcher.guardian_approve_unlock();

    // Should still need another guardian — double approve doesn't count twice
    assert(!dispatcher.is_claimable(), 'Double approve shouldnt unlock');
}

#[test]
#[should_panic(expected: 'VAULT_CLAIMABLE')]
fn test_deposit_reverts_once_vault_is_claimable() {
    let (vault_addr, vault, token_addr, token, _verifier) = configure_claimable_vault();

    cheat_caller_address(token_addr, OWNER(), CheatSpan::TargetCalls(1));
    token.mint(DEPOSITOR(), 100_u256);

    cheat_caller_address(token_addr, DEPOSITOR(), CheatSpan::TargetCalls(1));
    token.approve(vault_addr, 100_u256);

    cheat_caller_address(vault_addr, DEPOSITOR(), CheatSpan::TargetCalls(1));
    vault.deposit(token_addr, 100_u256);
}

#[test]
#[should_panic(expected: 'CLAIM_PHASE_STARTED')]
fn test_set_heir_merkle_root_reverts_once_vault_is_claimable() {
    let (vault_addr, vault, _token_addr, _token, _verifier) = configure_claimable_vault();
    cheat_caller_address(vault_addr, OWNER(), CheatSpan::TargetCalls(1));
    vault.set_heir_merkle_root(0x9999);
}

#[test]
#[should_panic(expected: 'CLAIM_PHASE_STARTED')]
fn test_set_verifier_reverts_once_vault_is_claimable() {
    let (vault_addr, vault, _token_addr, _token, _verifier) = configure_claimable_vault();
    let next_verifier: ContractAddress = 'nextverifier'.try_into().unwrap();
    cheat_caller_address(vault_addr, OWNER(), CheatSpan::TargetCalls(1));
    vault.set_verifier_address(next_verifier);
}

#[test]
fn test_claim_with_proof_single_heir_gets_full_snapshot_share() {
    let (vault_addr, vault, token_addr, token, verifier) = configure_claimable_vault();

    verifier.set_public_inputs(
        MERKLE_ROOT.into(),
        0x111_u256,
        addr_as_u256(vault_addr),
        10_000_u256,
    );

    cheat_caller_address(vault_addr, HEIR_1(), CheatSpan::TargetCalls(1));
    let empty_proof: Array<felt252> = array![];
    vault.claim_with_proof(empty_proof.span(), token_addr);

    assert(token.balance_of(HEIR_1()) == 10_000_u256, 'Heir should receive full amount');
    assert(token.balance_of(vault_addr) == 0_u256, 'Vault should be emptied');
}

#[test]
fn test_claim_with_proof_is_order_independent_for_weighted_heirs() {
    let (vault_addr, vault, token_addr, token, verifier) = configure_claimable_vault();
    let empty_proof: Array<felt252> = array![];

    verifier.set_public_inputs(
        MERKLE_ROOT.into(),
        0x222_u256,
        addr_as_u256(vault_addr),
        4_000_u256,
    );
    cheat_caller_address(vault_addr, HEIR_1(), CheatSpan::TargetCalls(1));
    vault.claim_with_proof(empty_proof.span(), token_addr);

    verifier.set_public_inputs(
        MERKLE_ROOT.into(),
        0x333_u256,
        addr_as_u256(vault_addr),
        6_000_u256,
    );
    cheat_caller_address(vault_addr, HEIR_2(), CheatSpan::TargetCalls(1));
    vault.claim_with_proof(empty_proof.span(), token_addr);

    assert(token.balance_of(HEIR_1()) == 4_000_u256, 'First heir payout mismatch');
    assert(token.balance_of(HEIR_2()) == 6_000_u256, 'Second heir payout mismatch');
}

#[test]
fn test_claim_with_proof_can_fully_distribute_snapshot_balance() {
    let (vault_addr, vault, token_addr, token, verifier) = configure_claimable_vault();
    let empty_proof: Array<felt252> = array![];

    verifier.set_public_inputs(
        MERKLE_ROOT.into(),
        0x444_u256,
        addr_as_u256(vault_addr),
        4_000_u256,
    );
    cheat_caller_address(vault_addr, HEIR_1(), CheatSpan::TargetCalls(1));
    vault.claim_with_proof(empty_proof.span(), token_addr);

    verifier.set_public_inputs(
        MERKLE_ROOT.into(),
        0x555_u256,
        addr_as_u256(vault_addr),
        4_000_u256,
    );
    cheat_caller_address(vault_addr, HEIR_2(), CheatSpan::TargetCalls(1));
    vault.claim_with_proof(empty_proof.span(), token_addr);

    verifier.set_public_inputs(
        MERKLE_ROOT.into(),
        0x666_u256,
        addr_as_u256(vault_addr),
        2_000_u256,
    );
    cheat_caller_address(vault_addr, HEIR_3(), CheatSpan::TargetCalls(1));
    vault.claim_with_proof(empty_proof.span(), token_addr);

    assert(token.balance_of(HEIR_1()) == 4_000_u256, 'Heir 1 payout mismatch');
    assert(token.balance_of(HEIR_2()) == 4_000_u256, 'Heir 2 payout mismatch');
    assert(token.balance_of(HEIR_3()) == 2_000_u256, 'Heir 3 payout mismatch');
    assert(token.balance_of(vault_addr) == 0_u256, 'SNAPSHOT_DISTRIBUTED');
}

#[test]
fn test_same_nullifier_can_claim_multiple_tokens_once_each() {
    let (vault_addr, vault, token_1_addr, token_1, token_2_addr, token_2, verifier) =
        configure_two_token_claimable_vault();
    let empty_proof: Array<felt252> = array![];

    verifier.set_public_inputs(
        MERKLE_ROOT.into(),
        0x777_u256,
        addr_as_u256(vault_addr),
        10_000_u256,
    );
    cheat_caller_address(vault_addr, HEIR_1(), CheatSpan::TargetCalls(1));
    vault.claim_with_proof(empty_proof.span(), token_1_addr);

    verifier.set_public_inputs(
        MERKLE_ROOT.into(),
        0x777_u256,
        addr_as_u256(vault_addr),
        10_000_u256,
    );
    cheat_caller_address(vault_addr, HEIR_1(), CheatSpan::TargetCalls(1));
    vault.claim_with_proof(empty_proof.span(), token_2_addr);

    assert(token_1.balance_of(HEIR_1()) == 10_000_u256, 'TOKEN_1_CLAIM');
    assert(token_2.balance_of(HEIR_1()) == 5_000_u256, 'TOKEN_2_CLAIM');
    assert(token_1.balance_of(vault_addr) == 0_u256, 'TOKEN_1_EMPTY');
    assert(token_2.balance_of(vault_addr) == 0_u256, 'TOKEN_2_EMPTY');
}

#[test]
#[should_panic(expected: 'CANCEL_WINDOW_OVER')]
fn test_recover_after_cancel_window() {
    let (addr, dispatcher) = deploy_vault();

    // Advance past the cancel window
    cheat_block_timestamp(addr, CANCEL_UNTIL + 1, CheatSpan::Indefinite);

    // Owner tries to recover — should fail
    cheat_caller_address(addr, OWNER(), CheatSpan::TargetCalls(1));
    let token: ContractAddress = 'token'.try_into().unwrap();
    let to: ContractAddress = 'receiver'.try_into().unwrap();
    dispatcher.recover(token, to, 100_u256);
}

#[test]
#[should_panic(expected: 'VAULT_CLAIMABLE')]
fn test_recover_reverts_once_vault_is_claimable() {
    let (vault_addr, vault, token_addr, _token, _verifier) = configure_claimable_vault();
    let to: ContractAddress = 'receiver'.try_into().unwrap();

    cheat_caller_address(vault_addr, OWNER(), CheatSpan::TargetCalls(1));
    vault.recover(token_addr, to, 100_u256);
}
