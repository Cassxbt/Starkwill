use starknet::ContractAddress;
use starknet::get_caller_address;

#[starknet::interface]
trait IVaultFactory<TContractState> {
    fn create_vault(
        ref self: TContractState,
        checkin_period_secs: u64,
        grace_period_secs: u64,
        cancelable_until_ts: u64,
        guardian_1: ContractAddress,
        guardian_2: ContractAddress,
        guardian_3: ContractAddress,
    ) -> ContractAddress;
}

#[starknet::contract]
mod vault_factory {
    use super::{ContractAddress, get_caller_address};
    use starknet::ClassHash;
    use starknet::storage::{
        StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::syscalls::deploy_syscall;

    use super::IVaultFactory;

    #[storage]
    struct Storage {
        vault_class_hash: ClassHash,
        vault_count: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, vault_class_hash: ClassHash) {
        self.vault_class_hash.write(vault_class_hash);
        self.vault_count.write(0);
    }

    #[abi(embed_v0)]
    impl FactoryExternal of IVaultFactory<ContractState> {
        fn create_vault(
            ref self: ContractState,
            checkin_period_secs: u64,
            grace_period_secs: u64,
            cancelable_until_ts: u64,
            guardian_1: ContractAddress,
            guardian_2: ContractAddress,
            guardian_3: ContractAddress,
        ) -> ContractAddress {
            let owner = get_caller_address();
            let salt = self.vault_count.read();

            let mut calldata: Array<felt252> = ArrayTrait::new();
            calldata.append(owner.into());
            calldata.append(checkin_period_secs.into());
            calldata.append(grace_period_secs.into());
            calldata.append(cancelable_until_ts.into());
            calldata.append(guardian_1.into());
            calldata.append(guardian_2.into());
            calldata.append(guardian_3.into());

            let (addr, _) = deploy_syscall(
                self.vault_class_hash.read(),
                salt.into(),
                calldata.span(),
                false,
            )
            .unwrap();

            self.vault_count.write(salt + 1);
            addr
        }
    }
}
