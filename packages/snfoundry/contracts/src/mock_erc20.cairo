use starknet::ContractAddress;
use starknet::get_caller_address;

#[starknet::interface]
pub trait IMockERC20<TContractState> {
    fn mint(ref self: TContractState, to: ContractAddress, amount: u256);
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
}

#[starknet::contract]
mod mock_erc20 {
    use super::{ContractAddress, get_caller_address};
    use starknet::storage::{
        Map,
        StoragePathEntry,
        StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    fn transfer_between(
        ref self: ContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) {
        let sender_balance = self.balances.entry(sender).read();
        assert(sender_balance >= amount, 'INSUFFICIENT_BALANCE');
        self.balances.entry(sender).write(sender_balance - amount);

        let recipient_balance = self.balances.entry(recipient).read();
        self.balances.entry(recipient).write(recipient_balance + amount);
    }

    #[abi(embed_v0)]
    impl MockERC20External of super::IMockERC20<ContractState> {
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            let current = self.balances.entry(to).read();
            self.balances.entry(to).write(current + amount);
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let owner = get_caller_address();
            self.allowances.entry((owner, spender)).write(amount);
            true
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            transfer_between(ref self, caller, recipient, amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            let current_allowance = self.allowances.entry((sender, caller)).read();
            assert(current_allowance >= amount, 'INSUFFICIENT_ALLOWANCE');
            self.allowances.entry((sender, caller)).write(current_allowance - amount);

            transfer_between(ref self, sender, recipient, amount);
            true
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.entry(account).read()
        }
    }
}
