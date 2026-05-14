# Chainbills - Relayer

Chainbills is a cross-chain payment gateway that allows anyone (hosts) to receive any amount of cryptocurrency from everybody (payers), powered by [Wormhole](https://wormhole.com) and [Circle CCTP](https://www.circle.com/cross-chain-transfer-protocol). Chainbills deducts 2% from all withdrawals for fees and maintenance.

This subdirectory contains a standalone Node.js service that automates cross-chain message relaying and event indexing for the Chainbills EVM ecosystem.

For more about Chainbills' features and how things work overall, check the [top-level README](../README.md).

To understand the data structures and architecture of Chainbills' contracts, check the [ARCHITECTURE doc](../ARCHITECTURE.md).

## Table of Contents

- [About](#about)
- [Architecture Flow](#architecture-flow)
- [Firestore Write Strategy](#firestore-write-strategy)
- [Dual-Path Writes](#dual-path-writes)
- [Chain Configuration](#chain-configuration)
- [Environment Variables](#environment-variables)

## About

The relayer automates off-chain tasks by acting as a highly-available indexing and relaying bridge. Using a push-based, event-driven architecture, it removes the need for clients to manually synchronize on-chain state or trigger cross-chain relays.

Key responsibilities:

- Watches and indexes EVM events (`CreatedPayable`, `UserPaid`, `PayableReceived`, `Withdrew`).
- Automatically fetches Wormhole VAAs and Circle CCTP attestations.
- Relays payable updates and cross-chain payments to destination chains.
- Dispatches Firebase Cloud Messaging (FCM) push notifications upon indexing.

The web server retains only the management of off-chain metadata (like descriptions and auth) while the relayer handles all on-chain synchronization.

## Architecture Flow

| Component         | Responsibility                                              |
| ----------------- | ----------------------------------------------------------- |
| `src/chains/`     | Chain registry (Arc, Sepolia, MegaETH + more)               |
| `src/watchers/`   | `getLogs` polling loops, one per chain                      |
| `src/indexer/`    | Firestore writers (`merge: true`, dual-path writes)         |
| `src/resolvers/`  | Wormhole VAA fetcher + Circle attestation poller            |
| `src/submitters/` | `viem` wallet clients for on-chain tx submission            |
| `src/jobs/`       | Firestore-backed job queue (`PENDING` → `DONE` \| `FAILED`) |
| `src/notify/`     | FCM push notifications                                      |

The relayer uses **`getLogs` polling** rather than WebSocket subscriptions because:

1. WebSockets drop silently after ~1 hour on most public RPCs.
2. Polling with a Firestore block cursor (`/relayerCursors/{chainName}`) ensures crash-safety. On process restart, the watcher resumes from the last indexed block with zero events missed.
3. Each chain runs on a tuned `pollIntervalMs` reflecting its exact block time.

## Firestore Write Strategy

All writes use `{ merge: true }` so the relayer and the server can write to the same document in any order without conflict.

- The relayer writes on-chain data (host, chainCount, etc.) when it indexes a `CreatedPayable` event.
- The server writes the description when the host calls `POST /payable`.
- Whichever arrives first, the merge ensures neither overwrites the other.

## Dual-Path Writes

Every indexed entity is written to **two Firestore paths**. Top-level paths handle global queries and descriptions, while chain-scoped paths optimize for localized lookups.

```
/payables/{payableId}
/chains/{chainName}/payables/{payableId}

/userPayments/{paymentId}
/chains/{chainName}/userPayments/{paymentId}

/payablePayments/{paymentId}
/chains/{chainName}/payablePayments/{paymentId}

/withdrawals/{withdrawalId}
/chains/{chainName}/withdrawals/{withdrawalId}
```

Internal relayer paths:

- `/relayerCursors/{chainName}`: Last indexed block per chain (crash recovery).
- `/relayerJobs/{jobId}`: Relay job queue with full lifecycle tracking.

## Chain Configuration

Chains are defined in `src/chains/index.ts`. Each chain configuration specifies protocol support and network topologies.

| Field             | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| `wormholeNetwork` | `'Testnet'` or `'Mainnet'` — per-chain Wormhole environment        |
| `hasWormhole`     | Whether Wormhole Core is deployed on this chain                    |
| `wormholeChainId` | Wormhole uint16 chain ID (if `hasWormhole=true`)                   |
| `hasCctp`         | Whether Circle CCTP is deployed on this chain                      |
| `circleDomain`    | Circle uint32 domain (if `hasCctp=true`)                           |
| `cctpNetwork`     | `'Testnet'` or `'Mainnet'` — per-chain Circle Iris API environment |
| `deploymentBlock` | Block to start indexing from (0n = genesis)                        |
| `pollIntervalMs`  | Per-chain `getLogs` poll interval override                         |

### Active Chains

| Chain                                | Wormhole        | CCTP          | Network   |
| ------------------------------------ | --------------- | ------------- | --------- |
| Arc Testnet (`eip155:5042002`)       | ✗               | ✓ (domain 10) | `Testnet` |
| Ethereum Sepolia (`eip155:11155111`) | ✓ (chain 10002) | ✓ (domain 0)  | `Testnet` |
| MegaETH Mainnet (`eip155:4326`)      | ✓ (chain 64)    | ✗             | `Mainnet` |

### Adding a New Chain

```typescript
export const myNewChain: ChainConfig = {
  name: 'mynewchain',
  displayName: 'My New Chain',
  viemChain: viemMyNewChain,
  rpcUrl: '', // injected from RPC_MY_NEW_CHAIN env var
  contractAddress: '0x...',
  gettersAddress: '0x...',
  cbChainId: '0x...', // keccak256(abi.encodePacked("eip155:CHAIN_ID"))
  wormholeNetwork: 'Mainnet',
  hasWormhole: true,
  wormholeChainId: 999,
  hasCctp: false,
  deploymentBlock: 0n,
  pollIntervalMs: 2000,
};
```

2. Add it to the `ALL_CHAINS` array.
3. Add `RPC_MY_NEW_CHAIN` env var injection in `src/config.ts`.
4. Add the env var to `.env` and `.env.sample`.
5. Restart the relayer — it will begin watching the new chain immediately.

## Protocol Routing

The relayer intelligently routes cross-chain messages based on the capabilities of both the source and destination chains:

### Payable Updates

When a host updates allowed tokens on a payable:

1. Detects `PayableUpdateBroadcasted` on the source chain.
2. Checks all registered foreign chains.
3. If both chains support Wormhole, fetches VAA and calls `receivePayableUpdateViaWormhole()`.
4. If both support CCTP, polls Iris API and calls `receivePayableUpdateViaCircle()`.
5. If no common protocol exists, requires manual fallback.

### Cross-Chain Payments

When a payer pays via CCTP cross-chain:

1. Detects `UserPaid` event on the source chain where `payableChainId` differs.
2. Concurrently fetches the Wormhole VAA and polls the Circle Iris API.
3. Once both are acquired, calls `receiveForeignPaymentWithCircle()` on the destination chain to finalize the payment and emit `PayableReceived`.

## Job Queue

Every cross-chain relay action is persisted in Firestore at `/relayerJobs/{jobId}` **before** any on-chain tx is attempted.

Job lifecycle: `PENDING → PROCESSING → DONE` (or `FAILED` after 5 attempts).
This provides crash safety, full auditability of cross-chain relays, and visibility into stuck transactions.

## Setup

### Prerequisites

- Node.js 22+
- A funded EVM wallet (must hold gas on each destination chain)
- `ADMIN_ROLE` granted to the relayer wallet on every Chainbills proxy contract
- Firebase service account with Firestore read/write access

### Install & Configure

```bash
cd relayer
npm install
cp .env.sample .env
```

Fill in all values in `.env`. See [`.env.sample`](./.env.sample) for descriptions.

### Run Locally

```bash
npm run dev
```

### Production (Cloud Run)

The relayer is designed for 1-instance highly-available deployments.

```bash
npm run build
docker build -t chainbills-relayer .

# Deploy to Cloud Run (min-instances=1 ensures it never sleeps)
gcloud run deploy chainbills-relayer \
  --image gcr.io/PROJECT/chainbills-relayer \
  --min-instances=1 \
  --set-env-vars="$(cat .env | xargs)"
```

### Historical Backfill

If deploying for the first time on a chain with existing history:

```bash
npm run backfill
# Or for a specific chain: BACKFILL_CHAIN=arctestnet npm run backfill
```

## Gas Management

The relayer uses a **single private key** (`RELAYER_PRIVATE_KEY`) across all chains. The wallet must hold sufficient gas:

| Chain            | Gas Token     | Minimum Recommended |
| ---------------- | ------------- | ------------------- |
| Arc Testnet      | USDC (native) | 10 USDC             |
| Ethereum Sepolia | ETH           | 0.05 ETH            |
| MegaETH Mainnet  | ETH           | 0.05 ETH            |

The relayer continuously monitors its own balance in the background and will log a critical warning if funds fall below the minimums defined directly in the `src/chains/index.ts` configurations.
