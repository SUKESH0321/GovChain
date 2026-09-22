# GovChain Blockchain (Stage 2.1 + 2.2)

Local Ethereum-compatible blockchain development environment for GovChain.

```text
GovChain
   ↓
Hardhat local EVM network
   ↓
GovChain.sol
```

Stage 2.1 set up this foundation: a real local EVM chain, a Solidity audit contract and a
deployment script. Stage 2.2 added the backend integration on top of it - the Express API submits
`ProjectCreated`, `ProjectUpdated`, `TenderCreated` and `TenderAssigned` transactions to this
contract through `server/services/blockchain.service.js` (ethers.js). Stage 2.3 extended the same
service with the milestone lifecycle: `MilestoneCreated`, `MilestoneSubmitted`,
`MilestoneVerified` and `MilestoneRejected`. The React frontend still has no blockchain features
beyond the milestone review buttons - it never talks to the chain directly.

There is **no Hyperledger Fabric and no Docker** in this module. It is a plain Hardhat project.

## Requirements

- Node.js 22.13 or later (Hardhat 3 requirement)
- npm

## Install

```text
npm install
```

## Start the local blockchain

```text
npm run node
```

This starts a real local Ethereum-compatible blockchain (Hardhat network / EVM) at:

```text
http://127.0.0.1:8545
```

The node provides development accounts automatically. No MetaMask, wallet, external RPC
provider, API key or Docker is required. Leave this terminal running.

## Compile

In a second terminal:

```text
npm run compile
```

Compiles `contracts/GovChain.sol` (Solidity 0.8.28) into `artifacts/`.

## Deploy

With the node still running:

```text
npm run deploy
```

`npm run deploy` runs `hardhat run scripts/deploy.js --network localhost` and:

- uses the first Hardhat development account as the deployer
- deploys `GovChain.sol` to the local chain
- prints the network, chain ID, deployer address and deployed contract address

Expected output:

```text
================================
GovChain Blockchain Deployment
================================

Network: localhost
Chain ID: 31337
Deployer: 0x...
Deploying GovChain...

GovChain Contract: 0x...
Contract version: GovChain/2.2.0

Deployment artifact: .../blockchain/deployments/localhost.json

Deployment complete.
```

## Deployment artifact

After a successful deployment the contract address is written to:

```text
blockchain/deployments/localhost.json
```

The file contains the contract name, contract version, network name, chain ID, RPC URL,
deployed address, deployer address, transaction hash, block number and deployment timestamp.
Later stages (Express → blockchain service → ethers.js) read the address from this artifact
instead of hardcoding it. The folder is generated output and is listed in `.gitignore`, so
re-run `npm run deploy` after starting a fresh node.

## Layout

```text
blockchain/
├── contracts/
│   └── GovChain.sol      Solidity audit/event contract
├── scripts/
│   └── deploy.js         Deployment script (ethers.js)
├── deployments/          Generated deployment artifacts (gitignored)
├── hardhat.config.js     Hardhat configuration (Solidity + localhost network)
├── package.json          Dependencies and npm scripts
└── README.md
```

## What `GovChain.sol` does

`GovChain` is an audit/event foundation - it stores nothing and moves no funds. It defines one
event per GovChain lifecycle action and one thin `record...` function per event. Each function
uses `msg.sender` as the on-chain actor and `block.timestamp` as the recording time:

| Event | Recorder function |
|---|---|
| `ProjectCreated` | `recordProjectCreated(projectId, projectReference)` |
| `ProjectUpdated` | `recordProjectUpdated(projectId, projectReference)` |
| `TenderCreated` | `recordTenderCreated(tenderId, projectId, tenderReference)` |
| `TenderAssigned` | `recordTenderAssigned(tenderId, projectId, contractorId)` |
| `MilestoneCreated` | `recordMilestoneCreated(milestoneId, projectId, milestoneReference)` |
| `MilestoneSubmitted` | `recordMilestoneSubmitted(milestoneId, projectId)` |
| `MilestoneVerified` | `recordMilestoneVerified(milestoneId, projectId)` |
| `MilestoneRejected` | `recordMilestoneRejected(milestoneId, projectId, reason)` |
| `PaymentAuthorized` | `recordPaymentAuthorized(paymentId, projectId, amount)` |
| `PaymentReleased` | `recordPaymentReleased(paymentId, projectId, amount, recipient)` |

Identifiers and actor/counterparty ids are `indexed` so later modules can filter events (for
example all events of one project). `TenderAssigned` identifies the contractor by its off-chain
GovChain user id because contractors have no wallet yet. The string arguments carry short,
non-sensitive references only (`PRJ-<id>`, `TND-<id>`, `MST-<id>`, or a bounded rejection
reference) - free-form titles, descriptions, documents and personal data stay off-chain.
`contractVersion()` returns `GovChain/2.2.0` and is used by the deployment script as a sanity
check.

Off-chain business data (PostgreSQL) stays off-chain and is referenced only by its numeric
identifier. Sensitive data must never be written on-chain.

## Using the deployment script against another network

The default target is the local node (`--network localhost`). Another configured network can be
selected without touching the script:

```text
npm run deploy -- --network <network-name>
```

Do not deploy to a public testnet or mainnet in Stage 2.1 / 2.2.

## Stage 2.2 backend integration

The Express backend loads the address and ABI from this folder - nothing is duplicated by hand:

- ABI: `blockchain/artifacts/contracts/GovChain.sol/GovChain.json` (produced by `npm run compile`)
- address: `GOVCHAIN_CONTRACT_ADDRESS` in `server/.env`, falling back to
  `blockchain/deployments/localhost.json`

Backend variables (see `server/.env.example`): `BLOCKCHAIN_ENABLED`, `BLOCKCHAIN_RPC_URL`,
`BLOCKCHAIN_PRIVATE_KEY`, `GOVCHAIN_CONTRACT_ADDRESS`, plus the optional
`GOVCHAIN_ARTIFACT_PATH` / `GOVCHAIN_DEPLOYMENT_FILE` overrides.

Because the ABI and the contract version changed in Stage 2.2, recompile and redeploy after
pulling these changes, then update `GOVCHAIN_CONTRACT_ADDRESS` and restart the backend:

```text
npm run compile
npm run deploy
```

## Stage 2.3 milestone verification ledger

The milestone lifecycle is recorded through the same blockchain service:

| Application action | Endpoint | Event |
|---|---|---|
| milestone created | `POST /api/projects/:projectId/milestones` | `MilestoneCreated` |
| submitted for review | `PUT /api/milestones/:id/submit` | `MilestoneSubmitted` |
| verified | `PUT /api/milestones/:id/verify` | `MilestoneVerified` |
| rejected | `PUT /api/milestones/:id/reject` | `MilestoneRejected` |

PostgreSQL is written first (`milestones.status` moves through
`PENDING / IN_PROGRESS -> SUBMITTED -> VERIFIED | REJECTED`); the transaction is submitted only
after that write succeeded. A blockchain failure never rolls the milestone back - it is stored in
`blockchain_events` with status `FAILED` and reported in the API response as
`blockchain.status = "FAILED"`.

Idempotency follows Stage 2.2: `MilestoneCreated:milestone:<id>` for creation and
`Milestone<Action>:milestone:<id>:<milestones.updated_at>` for the review steps, so a repeated
request cannot record the same action twice, while a resubmission after a rejection is a new
(legitimately distinct) event.

The contract itself did **not** change in Stage 2.3: the four milestone events and their recorder
functions already existed from Stage 2.1, so an existing Stage 2.2 deployment keeps working - no
redeployment and no new contract address is required. Run `npm run compile` only if
`blockchain/artifacts/` is missing.

## Not part of Stage 2.1 - 2.3

Frontend blockchain UI (dashboard, explorer, transaction history), wallets/MetaMask, payment
blockchain records, an event listener, AI anomaly detection, tokens/NFTs, DAO features, IPFS and
public testnet deployments are later stages and are intentionally not implemented here.
