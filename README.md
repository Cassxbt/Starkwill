# StarkWill — Private Crypto Inheritance

**What happens to your Bitcoin when you die?**

StarkWill is a privacy-preserving crypto inheritance protocol on Starknet. Deposit assets into a dead-man's-switch vault, designate heirs anonymously, and let zero-knowledge proofs handle the rest.

No lawyers. No centralized custodians. No identity exposure. Just math.

---

## The Problem

When a crypto holder dies or becomes incapacitated, their assets are lost forever. Current solutions require trusting lawyers, centralized services, or exposing heir identities on-chain.

## The Solution

StarkWill uses a **dead-man's switch** pattern combined with **zero-knowledge proofs** for anonymous heir claims:

1. **Owner** creates a vault, deposits assets (ETH, STRK, WBTC), and checks in periodically
2. **Heirs** are registered as commitments in a Merkle tree — no addresses stored on-chain
3. If the owner stops checking in, the vault unlocks
4. **Heirs claim anonymously** using a ZK proof that says "I am in the heir group" without revealing *which* heir

## Privacy Model

| What's Private | How | Technology |
|----------------|-----|------------|
| Heir identity on claim | ZK proof of Merkle tree membership | Noir + Garaga |
| Heir list | Stored as commitment hashes, not addresses | Semaphore-style group |
| Which heir claimed | Nullifier prevents double-claim without linking identity | Blake3 nullifier hash |

**What's public by design:** Vault existence, owner address, check-in timestamps, guardian addresses, token types.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              Frontend (Next.js)              │
│   Scaffold-Stark 2 · Framer Motion · Dark   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────┐  ┌────────────────────────┐  │
│  │  Merkle   │  │   Scaffold-Stark       │  │
│  │  Tree JS  │  │   Contract Hooks       │  │
│  │ (Blake3)  │  │  (read/write vault)    │  │
│  └─────┬─────┘  └──────────┬─────────────┘  │
│        │                   │                │
├────────┼───────────────────┼────────────────┤
│        ▼                   ▼                │
│  ┌─────────────────────────────────────┐    │
│  │       Starknet (Sepolia)            │    │
│  │                                     │    │
│  │  ┌──────────────┐ ┌──────────────┐  │    │
│  │  │  StarkWill   │ │  ZK Verifier │  │    │
│  │  │  Vault       │ │  (Garaga)    │  │    │
│  │  │              │ └──────────────┘  │    │
│  │  │ - check_in   │                   │    │
│  │  │ - deposit    │ ┌──────────────┐  │    │
│  │  │ - claim_with │ │  Noir Circuit│  │    │
│  │  │   _proof     │ │  (off-chain) │  │    │
│  │  │ - guardians  │ └──────────────┘  │    │
│  │  └──────────────┘                   │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Smart Contracts (Cairo)

- **StarkWill Vault** — Dead-man's-switch with check-in periods, grace periods, 2-of-3 guardian emergency unlock, token whitelist, ZK-verified heir claims
- **ZK Verifier** — Garaga-generated on-chain verifier for UltraKeccakZKHonk proofs

### ZK Circuit (Noir)

- Proves Merkle tree membership (depth 8, up to 256 heirs)
- Blake3 hash function matching on-chain commitment scheme
- Nullifier hash prevents double-claiming while preserving anonymity

### Frontend (Next.js)

- **Create Vault** — 4-step wizard: timing, guardians, heirs (live Merkle tree computation)
- **Dashboard** — Check-in, deposit assets, view vault status
- **Claim** — Enter secret, generate ZK proof, claim anonymously
- Framer Motion animations with `useReducedMotion` accessibility

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Cairo (Scarb 2.16.0, snforge 0.56.0) |
| ZK Circuit | Noir v1.0.0-beta.16 |
| Proof System | UltraKeccakZKHonk (Barretenberg) |
| On-chain Verifier | Garaga v1.0.1 |
| Frontend | Next.js 15, Scaffold-Stark 2 |
| Animations | Framer Motion (motion v12) |
| Hashing | Blake3 (@noble/hashes) |
| Network | Starknet Sepolia |

---

## Deployed Contracts

| Contract | Network | Address |
|----------|---------|---------|
| StarkWill Vault | Sepolia | `0x70362b5e45c3b3318357d3f27b4468bcc6c1b43484a243e4bab8622352931d9` |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn
- Scarb 2.16.0
- snforge 0.56.0
- Starknet wallet (Argent X or Braavos)

### Install & Run

```bash
# Clone
git clone https://github.com/your-repo/starkwill-app.git
cd starkwill-app

# Install dependencies
yarn install

# Run frontend (connects to Sepolia)
yarn start

# Run contract tests
cd packages/snfoundry
snforge test
```

### Deploy Contracts

```bash
# Configure .env with your Sepolia account
cp packages/snfoundry/.env.example packages/snfoundry/.env
# Edit with your PRIVATE_KEY_SEPOLIA, ACCOUNT_ADDRESS_SEPOLIA, RPC_URL_SEPOLIA

# Deploy
yarn deploy --network sepolia
```

---

## How It Works

### For the Vault Owner

1. **Create vault** with check-in period (e.g., 30 days), grace period, and 3 guardians
2. **Add heirs** — each heir generates a secret; owner registers commitment hashes in a Merkle tree
3. **Deposit assets** — whitelist and deposit ETH, STRK, or WBTC
4. **Check in periodically** — resets the dead-man's switch timer

### For Heirs

1. **Wait** until the vault becomes claimable (owner missed check-in + grace period)
2. **Enter your secret** in the Claim UI — commitment and nullifier are computed locally
3. **Generate ZK proof** — proves "I know a secret in the heir Merkle tree" without revealing which one
4. **Submit claim** — proof is verified on-chain, assets transferred, nullifier recorded

### For Guardians

- **Emergency unlock** — 2-of-3 guardians can unlock the vault before the timer expires
- Used for situations where the owner is incapacitated but heirs need immediate access

---

## Privacy Track Alignment

**Impact:** Universal problem — crypto inheritance affects every holder. Currently underserved with no privacy-preserving solutions.

**Technical depth:**
- Cairo smart contracts with on-chain ZK verification
- Noir circuit for anonymous group membership proofs
- Garaga-generated verifier for gas-efficient proof verification
- Blake3 hash function for Merkle tree construction
- Nullifier scheme for double-claim prevention

**Novel contribution:** First privacy-preserving inheritance protocol on Starknet combining anonymous heir claims with a dead-man's-switch mechanism.

---

## Bitcoin Track Alignment

WBTC is whitelisted as a vault asset — functional BTC integration for inheritance. Narrative: *"What happens to your Bitcoin when you die?"*

---

## License

MIT

---

Built with Cairo, Noir, Garaga, and Scaffold-Stark for the Starknet Re{define} Hackathon 2025.
