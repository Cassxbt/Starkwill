# StarkWill

A dead-man's-switch inheritance vault on Starknet where heirs claim with zero-knowledge proofs instead of on-chain identity.

StarkWill is a privacy-preserving inheritance vault on Starknet.

The owner configures a vault with a check-in period, a grace period, a 2-of-3 guardian set, and a private heir set represented by a Merkle root. If the owner keeps checking in, the vault stays locked. If the owner stops checking in for long enough, or guardians unlock it early, heirs can claim with a zero-knowledge proof.

This repository contains the Cairo contracts, the Noir circuit, the browser-side prover flow, and the Next.js frontend used to configure and claim from the vault.

Live app: [starkwill.vercel.app](https://starkwill.vercel.app)

## What the system does

- Creates one inheritance vault per owner.
- Keeps the vault locked while the owner remains active.
- Allows a 2-of-3 guardian set to unlock the vault early.
- Stores only a Merkle root of the heir set on-chain.
- Lets each heir prove membership and weight without revealing their secret.
- Snapshots each token's distributable balance on first claim so weighted payouts do not depend on claim order.

## What the system does not do

- It does not hide the wallet that submits a claim transaction. The proof hides which committed heir is claiming, not the recipient address.
- It does not currently enforce the sum of all heir weights on-chain. The official app enforces `10000` basis points during setup.
- It does not model recurring inheritance rounds. The current contract is intentionally a one-shot inheritance event.
- It does not treat late direct ERC-20 transfers after the first claim snapshot as part of the active distribution round.

## Protocol outline

### 1. Vault setup

The owner creates a vault through the factory and configures:

- `checkin_period_secs`
- `grace_period_secs`
- three guardian addresses
- a verifier address
- a Merkle root representing the heir set
- an ERC-20 token whitelist

The heir set is prepared off-chain. Each heir is represented as:

```text
commitment = hash(secret, weight_bps)
```

The frontend builds a Merkle tree from those commitments and stores only the root on-chain.

### 2. Credential distribution

After setup, the frontend exports one package per heir. Each package contains:

- vault address
- heir secret
- heir weight in basis points
- commitment list
- Merkle root
- package version

The app does not persist heir secrets for long-term custody. The package is the claim credential and needs to be distributed and backed up intentionally.

### 3. Active period

While the vault is not claimable:

- the owner can check in
- the owner can recover assets during the cancel window
- approved ERC-20 tokens can be deposited

### 4. Claim phase

The vault becomes claimable when either:

- the owner misses the check-in deadline plus grace period, or
- at least two guardians approve unlock

Once claimability begins, owner-side mutation is frozen. The owner can no longer re-lock the vault or replace core configuration.

### 5. Heir claim

The heir imports their package, generates the proof locally in the browser, and submits `claim_with_proof`.

The proof binds:

- `merkle_root`
- `nullifier_hash`
- `vault_address`
- `weight_bps_pub`

The contract verifies the proof, checks that the nullifier has not been used for that token, snapshots the token balance on first claim, and transfers the claimant's weighted share.

## Architecture

### Contracts

- [vault.cairo](packages/snfoundry/contracts/src/vault.cairo)
  Core inheritance logic: check-in, guardian unlock, token whitelist, claim gating, balance snapshots, proof verification, and payout.
- [vault_factory.cairo](packages/snfoundry/contracts/src/vault_factory.cairo)
  Factory deployment path. Enforces one vault per owner.

### Circuit

- [main.nr](packages/snfoundry/circuits/heir_membership/src/main.nr)
  Noir circuit proving Merkle membership and vault-bound nullifier validity.

### Frontend

- [create/page.tsx](packages/nextjs/app/create/page.tsx)
  Vault creation and configuration flow, including package export.
- [dashboard/page.tsx](packages/nextjs/app/dashboard/page.tsx)
  Owner dashboard for deposits, check-in, and vault state.
- [guardian/page.tsx](packages/nextjs/app/guardian/page.tsx)
  Guardian approval flow.
- [claim/page.tsx](packages/nextjs/app/claim/page.tsx)
  Heir import flow, browser proof generation, and claim submission.

### Shared frontend logic

- [merkle.ts](packages/nextjs/utils/starkwill/merkle.ts)
  Hashing, Merkle tree construction, proof generation, and nullifier derivation.
- [prover.ts](packages/nextjs/utils/starkwill/prover.ts)
  Browser-side Noir execution, Barretenberg proof generation, and Garaga calldata conversion.
- [heirPackage.ts](packages/nextjs/utils/starkwill/heirPackage.ts)
  Package schema, parsing, normalization, and stale-root checks.

## Current contract properties

- One vault per owner is enforced in the factory.
- Deposits revert once the vault is claimable.
- Recovery reverts once the vault is claimable.
- Owner config mutation reverts once claimability begins.
- Guardian approvals reset on owner check-in.
- Claim payouts are based on a fixed token snapshot taken on first claim.
- Nullifiers are tracked per token, so one heir credential can claim once per token.

## Privacy model

What is private:

- the heir secret
- which committed heir corresponds to a given claim
- the weight as an on-chain configuration table

What is public:

- vault existence
- owner address
- guardian addresses
- token types and balances
- the Merkle root
- the claiming wallet address
- the transferred amount

The system provides private heir membership, not full transaction anonymity.

## Repository layout

```text
starkwill-app/
├── packages/
│   ├── nextjs/
│   │   ├── app/
│   │   ├── contexts/
│   │   ├── contracts/
│   │   ├── hooks/
│   │   └── utils/starkwill/
│   └── snfoundry/
│       ├── circuits/
│       └── contracts/
└── .github/workflows/
```

## Local development

### Prerequisites

- Node.js 22
- npm
- Scarb 2.16.0
- snforge 0.56.0
- a Starknet wallet for frontend testing

### Install

```bash
npm install --legacy-peer-deps
```

### Run the frontend

```bash
npm run start
```

### Typecheck

```bash
npm run next:check-types
```

### Frontend tests

```bash
npm run test:nextjs
```

### Frontend production build

```bash
npm run build:nextjs
```

### Cairo tests

```bash
cd packages/snfoundry/contracts
snforge test
```

Current verified status:

- Cairo tests: `24 passed`
- Frontend tests: `302 passed`, `9 skipped`
- Typecheck: passing
- Production build: passing

## Deployment notes

The frontend is deployed on Vercel. The repo uses npm workspaces and currently installs with `--legacy-peer-deps` because of dependency constraints in the frontend workspace.

For contract deployment:

```bash
cp packages/snfoundry/.env.example packages/snfoundry/.env
# fill in PRIVATE_KEY_SEPOLIA, ACCOUNT_ADDRESS_SEPOLIA, RPC_URL_SEPOLIA

npm run deploy -- --network sepolia
```

## Demo path

The cleanest demo is:

1. create a vault
2. export heir packages
3. deposit assets
4. unlock via guardians
5. import a package on the claim page
6. generate the proof locally
7. submit the claim

That sequence matches the current contract design and is the least misleading way to present the project.

## Known limitations

- Aggregate heir weight integrity is enforced by the official app, not cryptographically by the contract.
- Direct token transfers to the vault after the first claim snapshot are outside the intended payout model.
- The Tongo path is still experimental and should not be treated as the core protocol path.
- Existing-vault editing in the frontend is partial management, not a full admin console.

## License

MIT
