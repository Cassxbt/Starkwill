use starkwill::vault::{IVaultDispatcher, IVaultDispatcherTrait};
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

const CHECKIN_PERIOD: u64 = 2592000; // 30 days
const GRACE_PERIOD: u64 = 604800; // 7 days
const CANCEL_UNTIL: u64 = 31536000; // 1 year

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
fn test_add_heir() {
    let (addr, dispatcher) = deploy_vault();

    cheat_caller_address(addr, OWNER(), CheatSpan::TargetCalls(1));
    dispatcher.add_heir(HEIR_1());
}

#[test]
fn test_set_heir_merkle_root() {
    let (addr, dispatcher) = deploy_vault();

    cheat_caller_address(addr, OWNER(), CheatSpan::TargetCalls(1));
    dispatcher.set_heir_merkle_root(0x1234, 3);

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
#[should_panic(expected: 'ONLY_OWNER')]
fn test_set_merkle_root_not_owner() {
    let (addr, dispatcher) = deploy_vault();

    cheat_caller_address(addr, HEIR_1(), CheatSpan::TargetCalls(1));
    dispatcher.set_heir_merkle_root(0x1234, 3);
}

#[test]
fn test_nullifier_initially_unused() {
    let (_addr, dispatcher) = deploy_vault();
    assert(!dispatcher.is_nullifier_used(0xdead), 'Should be unused');
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
