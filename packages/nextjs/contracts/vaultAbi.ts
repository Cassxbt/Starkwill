/**
 * Vault ABI extracted from the deployed vault contract.
 * Used for dynamic vault instances created via the factory.
 */
export const VAULT_ABI = [
  {
    type: "impl",
    name: "VaultExternal",
    interface_name: "starkwill::vault::IVault",
  },
  {
    type: "enum",
    name: "core::bool",
    variants: [
      { name: "False", type: "()" },
      { name: "True", type: "()" },
    ],
  },
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    type: "struct",
    name: "core::array::Span::<core::felt252>",
    members: [
      { name: "snapshot", type: "@core::array::Array::<core::felt252>" },
    ],
  },
  {
    type: "interface",
    name: "starkwill::vault::IVault",
    items: [
      {
        type: "function",
        name: "check_in",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "add_heir",
        inputs: [
          { name: "heir", type: "core::starknet::contract_address::ContractAddress" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "whitelist_token",
        inputs: [
          { name: "token", type: "core::starknet::contract_address::ContractAddress" },
          { name: "allowed", type: "core::bool" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "deposit",
        inputs: [
          { name: "token", type: "core::starknet::contract_address::ContractAddress" },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "guardian_approve_unlock",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "recover",
        inputs: [
          { name: "token", type: "core::starknet::contract_address::ContractAddress" },
          { name: "to", type: "core::starknet::contract_address::ContractAddress" },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "claim",
        inputs: [
          { name: "token", type: "core::starknet::contract_address::ContractAddress" },
          { name: "to", type: "core::starknet::contract_address::ContractAddress" },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "claim_with_proof",
        inputs: [
          { name: "full_proof_with_hints", type: "core::array::Span::<core::felt252>" },
          { name: "token", type: "core::starknet::contract_address::ContractAddress" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "set_verifier_address",
        inputs: [
          { name: "verifier", type: "core::starknet::contract_address::ContractAddress" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "set_heir_merkle_root",
        inputs: [
          { name: "root", type: "core::felt252" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "is_claimable",
        inputs: [],
        outputs: [{ type: "core::bool" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_heir_merkle_root",
        inputs: [],
        outputs: [{ type: "core::felt252" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_verifier_address",
        inputs: [],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "is_nullifier_used",
        inputs: [
          { name: "nullifier", type: "core::felt252" },
        ],
        outputs: [{ type: "core::bool" }],
        state_mutability: "view",
      },
    ],
  },
  {
    type: "constructor",
    name: "constructor",
    inputs: [
      { name: "owner", type: "core::starknet::contract_address::ContractAddress" },
      { name: "checkin_period_secs", type: "core::integer::u64" },
      { name: "grace_period_secs", type: "core::integer::u64" },
      { name: "cancelable_until_ts", type: "core::integer::u64" },
      { name: "guardian_1", type: "core::starknet::contract_address::ContractAddress" },
      { name: "guardian_2", type: "core::starknet::contract_address::ContractAddress" },
      { name: "guardian_3", type: "core::starknet::contract_address::ContractAddress" },
    ],
  },
  {
    type: "event",
    name: "starkwill::vault::vault::ZKClaim",
    kind: "struct",
    members: [
      { name: "nullifier_hash", type: "core::felt252", kind: "data" },
      { name: "token", type: "core::starknet::contract_address::ContractAddress", kind: "data" },
      { name: "amount", type: "core::integer::u256", kind: "data" },
      { name: "weight_bps", type: "core::integer::u256", kind: "data" },
    ],
  },
  {
    type: "event",
    name: "starkwill::vault::vault::Event",
    kind: "enum",
    variants: [
      { name: "ZKClaim", type: "starkwill::vault::vault::ZKClaim", kind: "nested" },
    ],
  },
] as const;

export const VAULT_CLASS_HASH = "0x6c31f8391d18439ce128c3a5ac10e88ceabbb8c44290fd4527f07ce1062629a";
