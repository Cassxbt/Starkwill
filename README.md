# StarkWill — Private Crypto Inheritance on Starknet

**What happens to your crypto when you die?**

StarkWill is a privacy-preserving inheritance protocol built on Starknet. It combines a **dead-man's switch** vault with **zero-knowledge proofs** so heirs can claim assets without ever revealing their identity on-chain.

No lawyers. No centralized custodians. No identity exposure. Just math.

> Built for the [Starknet Re{define} Hackathon 2026](https://dorahacks.io/hackathon/redefine/detail) — Privacy Track

---

## The Problem

An estimated **$140 billion** in crypto is permanently lost due to holders dying without a recovery plan. Current inheritance solutions require trusting lawyers, centralized custodians, or exposing heir identities on-chain — defeating the purpose of self-custody.

## The Solution

StarkWill introduces a non-custodial vault where:

1. **Owner** deposits assets and checks in periodically (dead-man's switch)
2. **Heirs** are registered as cryptographic commitments — no addresses stored on-chain
3. If the owner stops checking in, the vault unlocks
4. **Heirs claim anonymously** via ZK proof: "I am in the heir group" without revealing *which* heir

---

## Privacy Model

```
WHAT'S PRIVATE                        HOW
───────────────                        ───
Heir identity on claim           ZK proof of Merkle membership (Noir + Garaga)
Heir list                        Stored as Blake3 commitment hashes, not addresses
Which heir claimed               Nullifier hash — prevents double-claim without linking identity
Heir-to-secret mapping           Secrets never leave the heir's browser

WHAT'S PUBLIC (by design)
─────────────────────────
Vault existence, owner address, check-in timestamps,
guardian addresses, token types, total balance
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Frontend (Next.js 15)                  │
│              Scaffold-Stark 2 · Dark Theme               │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Merkle Tree  │  │  ZK Prover   │  │  Contract     │  │
│  │  (Blake3)    │  │  (bb.js WASM)│  │  Hooks        │  │
│  │  Commitment  │  │  ~5s proofs  │  │  (read/write) │  │
│  │  generation  │  │  in-browser  │  │               │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│         │     ┌───────────┘                   │          │
│         │     │  Garaga calldata conversion   │          │
│         ▼     ▼                               ▼          │
├──────────────────────────────────────────────────────────┤
│                    Starknet (Sepolia)                     │
│                                                          │
│  ┌─────────────────────┐     ┌────────────────────────┐  │
│  │   StarkWill Vault   │────▶│  ZK Verifier (Garaga)  │  │
│  │                     │     │  UltraKeccakZKHonk     │  │
│  │  - check_in()       │     └────────────────────────┘  │
│  │  - deposit()        │                                 │
│  │  - claim_with_proof()    ┌────────────────────────┐   │
│  │  - guardian_unlock()│    │  Noir Circuit           │   │
│  │  - recover()        │    │  (compiled off-chain)   │   │
│  └─────────────────────┘    │  - Merkle membership    │   │
│                             │  - Nullifier derivation │   │
│  ┌─────────────────────┐    └────────────────────────┘   │
│  │   Vault Factory     │                                 │
│  │  deploy_syscall()   │                                 │
│  └─────────────────────┘                                 │
└──────────────────────────────────────────────────────────┘
```

### Smart Contracts (Cairo)

- **StarkWill Vault** (284 lines) — Dead-man's-switch with configurable check-in/grace periods, 2-of-3 guardian emergency unlock, ERC-20 token whitelist, on-chain ZK proof verification, nullifier-based double-claim prevention
- **Vault Factory** (76 lines) — Deterministic vault deployment via `deploy_syscall` with unique salts
- **ZK Verifier** — Garaga-generated on-chain verifier for UltraKeccakZKHonk proofs

### ZK Circuit (Noir)

- **heir_membership** — Proves Merkle tree membership (depth 8, up to 256 heirs) using Blake3 hashing. Public inputs: `merkle_root`, `nullifier_hash`, `vault_address`
- Compiled to UltraKeccakZKHonk for gas-efficient Starknet verification via Garaga

### Frontend (Next.js)

| Page | Description |
|------|-------------|
| **Create Vault** | 4-step wizard: timing config, guardian addresses, heir secrets (live Merkle tree computation), token whitelist |
| **Dashboard** | Check-in button, deposit assets, view vault status and timers |
| **Claim** | Enter heir secret, generate ZK proof in-browser (~5s via bb.js WASM), submit anonymous claim |
| **How It Works** | Interactive explainer of the protocol |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Smart Contracts | Cairo (Scarb 2.16.0, snforge 0.56.0) | Vault logic, access control, ZK verification |
| ZK Circuit | Noir v1.0.0-beta.16 | Merkle membership proof |
| Proof System | UltraKeccakZKHonk (Barretenberg) | ZK proof generation (in-browser WASM) |
| On-chain Verifier | Garaga v1.0.1 | Gas-efficient proof verification on Starknet |
| Frontend | Next.js 15, Scaffold-Stark 2 | Wallet connection, contract interaction |
| Hashing | Blake3 (@noble/hashes) | Merkle tree + commitment + nullifier derivation |
| Network | Starknet Sepolia | Testnet deployment |

---

## Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| StarkWill Vault | [`0x055fbb6f...9fef37`](https://sepolia.starkscan.co/contract/0x055fbb6facff75ee0f8146f32c9da8a67b0ece9c1d99fa0257b830375c9fef37) |
| ZK Verifier (Garaga) | [`0x02ba3af4...cb9f53`](https://sepolia.starkscan.co/contract/0x02ba3af461b512d9053f6435d0a0b9278394cd7adb461450c258d586a8cb9f53) |

Both contracts are verified and functional on Sepolia. The vault has been E2E tested: deploy → set verifier → set heir Merkle root → deposit STRK → generate ZK proof → claim with proof.

---

## How It Works

### For the Vault Owner

1. **Create vault** — configure check-in period (e.g., 30 days), grace period, and 3 guardian addresses
2. **Add heirs** — each heir generates a secret offline; owner registers Blake3 commitment hashes in a Merkle tree
3. **Deposit assets** — whitelist and deposit any ERC-20 token (ETH, STRK, WBTC)
4. **Check in periodically** — resets the dead-man's switch timer. Miss a check-in → vault becomes claimable

### For Heirs

1. **Wait** until the vault is claimable (owner missed check-in + grace period elapsed)
2. **Enter your secret** — commitment and nullifier are computed locally in your browser
3. **Generate ZK proof** — proves Merkle membership without revealing which leaf. Proof generated in-browser via bb.js WASM (~5 seconds)
4. **Submit claim** — Garaga verifier checks the proof on-chain. Assets transferred. Nullifier recorded to prevent double-claims

### For Guardians

- **Emergency unlock** — 2-of-3 guardians can unlock the vault before the timer expires
- Use case: owner is incapacitated but heirs need immediate access
- Guardian addresses are set at vault creation and cannot be changed

---

## Testing

**14 Cairo contract tests** covering:

| Category | Tests |
|----------|-------|
| Core lifecycle | `deploy_and_check_in`, `check_in_resets_timer`, `claimable_after_timeout`, `not_claimable_before_timeout` |
| Access control | `check_in_not_owner`, `set_merkle_root_not_owner`, `non_guardian_cannot_approve` |
| Guardian system | `guardian_unlock` (2-of-3), `guardian_double_approve_idempotent` |
| Heir config | `add_heir`, `set_heir_merkle_root`, `nullifier_initially_unused` |
| Recovery | `recover_after_cancel_window`, `set_verifier_address` |

```bash
cd packages/snfoundry/contracts
snforge test
# Tests: 14 passed, 0 failed
```

---

## Project Structure

```
starkwill-app/
├── packages/
│   ├── nextjs/                      # Frontend
│   │   ├── app/
│   │   │   ├── create/              # Vault creation wizard
│   │   │   ├── dashboard/           # Owner dashboard
│   │   │   ├── claim/               # Anonymous heir claim
│   │   │   └── how-it-works/        # Protocol explainer
│   │   └── utils/starkwill/
│   │       ├── merkle.ts            # Blake3 Merkle tree (mirrors Noir circuit)
│   │       ├── prover.ts            # In-browser ZK proof generation
│   │       └── tokens.ts            # Token registry
│   └── snfoundry/
│       ├── contracts/
│       │   ├── src/
│       │   │   ├── vault.cairo      # Core vault contract (284 lines)
│       │   │   └── vault_factory.cairo  # Factory deployer (76 lines)
│       │   └── tests/
│       │       └── test_contract.cairo  # 14 integration tests
│       └── circuits/
│           └── heir_membership/     # Noir circuit + Garaga verifier
│               ├── src/main.nr      # ZK circuit source
│               └── heir_verifier/   # On-chain verifier (Cairo)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn
- Scarb 2.16.0 & snforge 0.56.0
- Starknet wallet (Argent X or Braavos)

### Install & Run

```bash
git clone https://github.com/Cassxbt/Starkwill.git
cd Starkwill

yarn install
yarn start
```

### Run Tests

```bash
cd packages/snfoundry/contracts
snforge test
```

### Deploy Contracts

```bash
cp packages/snfoundry/.env.example packages/snfoundry/.env
# Edit with PRIVATE_KEY_SEPOLIA, ACCOUNT_ADDRESS_SEPOLIA, RPC_URL_SEPOLIA

yarn deploy --network sepolia
```

---

## License

MIT
