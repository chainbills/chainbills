# Brief 01: On-Chain Data Layer, Transaction Flows Engine, Host Controls

**Wave:** 1 (runs in parallel with brief 00) · **Depends on:** nothing · **Blocks:** briefs 02–06

## Read first

1. `frontend/docs/redesign/README.md`, the global rules. On-chain-only data and the documentation rules are mandatory.
2. `frontend/docs/redesign/reference/onchain-data.md`, the contract facts this brief implements. Treat it as the specification.
3. `frontend/CLAUDE.md` and all of `frontend/src/stores/*` and `frontend/src/schemas/*`.
4. Contract sources for exact signatures: `evm/src/CbGetters.sol`, `evm/src/Chainbills.sol`, `evm/src/CbStructs.sol`, `evm/src/CbEvents.sol`.

## Goal

Build a **headless** data and transaction layer that later briefs render. It covers:

- on-chain chain discovery,
- unified activity records,
- chain statistics,
- host-control writes,
- a transaction-flow step engine that reports every step as it happens,
- destination-chain pollers for cross-chain delivery,
- a set of correctness fixes.

**No visual work.** Views may get minimal wiring changes only where an existing call signature changes. Brief 00 is restyling the UI in parallel, so do not touch `src/components/*` (except the one-line sort fix in `TransactionsTable.vue`), `src/assets/*`, `tailwind.config.js`, `stores/theme.ts` or `App.vue`.

## Requirements

### 1. Public read client (`stores/evm.ts`)

- Add `publicClientFor(chainName)`. It returns a cached viem `PublicClient` per EVM chain (`createPublicClient({ chain, transport: http() })`). All getter reads use it, so reads work **without a connected wallet**.
- Add `readGetter(chainName, functionName, args, { ignoreErrors })` and `readMain(chainName, functionName, args, …)` helpers. `readMain` reads public mappings on the proxy: `consumedPaymentNonces`, `payableUpdateNonces`, `getWormholeMessageFee`.
- Batch independent reads with `Promise.all`. Where a chain supports multicall3 (Sepolia and MegaETH do; check Arc Testnet via `viem/chains`), prefer `client.multicall` for bulk entity resolution. Fall back to parallel reads.
- Deduplicate `gettersAbi` and `mainAbi` in `stores/abis.ts`. Every entry currently appears twice.

### 2. Chain discovery (`stores/payable.ts`, `stores/payment.ts`, `stores/withdrawal.ts`)

- `payableStore.get(id)` resolves the home chain **on-chain**. It probes `getPayable(id)` on every EVM chain in parallel and takes the chain that succeeds.
  - It caches `{ chainName }` for the id.
  - It then loads `getAllowedTokensAndAmounts` and `getBalances`, and fetches the description from `server.getPayable(id)` with `ignoreErrors`. A missing description becomes `''`.
  - It **does not require a connected wallet.**
- `Payable` schema: add `isAutoWithdraw` and `activitiesCount`. Keep `isClosed`.
- A payment or withdrawal `get(id)` probes all EVM chains in parallel, not sequentially.
- Fix the swapped arguments in `payable.ts` `getEntityId`. The call is `cacheKey(payableId, chain.name, …)` but the signature is `(chainName, id, …)`.
- Remove the requirement for a signed-in user from read paths (`getEntityId`, `getManyForPayable`, and similar). Payables and their activity are public.

### 3. Activity records

**`schemas/activity.ts`**

- A `ActivityType` TypeScript enum whose members mirror the Solidity order exactly (see reference §3).
- Per type, metadata:
  - `label`, for example "Payment received",
  - `tone` (`success | info | warning | danger | accent | neutral`),
  - `icon` key,
  - `category` (`payments | withdrawals | payables | users`).
- An `Activity` class holding:
  - `id`, `chain`, `chainCount`, `userCount`, `payableCount`, `timestamp`, `entityId`, `type`;
  - a resolved `entity`, typed as `Payable | UserPayment | PayablePayment | Withdrawal | User | null`;
  - derived helpers: `payableId`, `actor` (payer or host wallet), `amount` (a `TokenAndAmount` when relevant), `counterpartChain` (for cross-chain payments), `isCrossChain`.

**`stores/activity.ts` (`useActivityStore`)**

- `getForPayable(payable, { page, size })`, `getForUser(address, chain, { page, size })` and `getForChain(chain, { page, size })`.
  - Each returns `{ items: Activity[], total }`, newest first.
  - The pagination maths is in reference §2. Comment it thoroughly.
- `resolveEntities(activities)` groups entity ids by type and resolves each group with one bulk getter per chain: `getPayablesBulk` + ATAA reads, `getUserPaymentsBulk`, `getPayablePaymentsBulk`, `getWithdrawalsBulk`, and `getUsersBulk` for `InitializedUser` (entity is the left-padded address).
  - If a bulk call reverts, fall back to per-id reads with `ignoreErrors`.
  - Cache resolved immutable entities (payments, withdrawals, activity records) in `cache.ts`. Never cache payables: their state changes.
- `getForUserAcrossChains(address, networkType, cursor)` is for the scan address page and the user activity page. It:
  - reads `getUser(address)` on every EVM chain of that network (chains where the call reverts are skipped),
  - merges the per-chain newest-first streams by `timestamp` with a **k-way merge**,
  - returns `{ items, cursor, hasMore }`.
  - The cursor stores the next offset per chain. Document the algorithm and its guarantees: items appear strictly newest first and no duplicates are possible.
- `getForNetwork(networkType, cursor)` does the same merge over `chainActivityIdsPaginated` for every chain in the network, for the scan "All chains" view.
- Filtering helpers: `byCategory(items, category)` and `byTypes(items, types[])`.
  - Server-side filtering does not exist on-chain. Document that filters apply to the loaded window, and that the UI keeps loading pages until enough filtered items exist or the stream ends. Expose `loadUntil(predicate, minCount)` to support this.

### 4. Chain statistics (`stores/stats.ts`, `useStatsStore`)

- `getChainStats(chain)` returns the `getChainStats()` struct plus `getConfig()`. From the config it exposes `withdrawalFeePercentage` (basis points), `hasWormhole` (`wormholeChainId != 0`) and `hasCctp` (non-zero circle transmitter).
- `getTokenVolumes(chain)` calls `getTokenDetails(token)` for every token in `schemas/tokens.ts` that has details on that chain. It returns per-token `totalUserPaid`, `totalPayableReceived`, `totalWithdrawn` and `totalWithdrawalFeesCollected` as bigint.
- `getNetworkStats(networkType)` aggregates counts across the network's chains and keeps volumes per token (never sum across different tokens). It returns per-chain breakdowns too.
- Cache results in memory for 30 s.

### 5. Transaction flow engine (`stores/tx-flow.ts`, `useTxFlowStore`)

A reactive model of multi-step user actions that the UI renders step by step (brief 03). Types:

```ts
/** Lifecycle of a single step inside a transaction flow. */
type TxStepStatus = 'upcoming' | 'active' | 'waiting' | 'done' | 'skipped' | 'failed';

/** One step of a flow, e.g. "Approve USDC" or "Relaying to Arc Testnet". */
interface TxStep {
  key: string;
  title: string;          // "Approve 25 USDC"
  description: string;    // "Your wallet asks you to let Chainbills move 25 USDC."
  hints?: string[];       // rotating microcopy shown while active or waiting
  status: TxStepStatus;
  chain?: Chain;
  txHash?: string;
  explorerUrl?: string;
  startedAt?: number;
  endedAt?: number;
  error?: string;
}

/** A user-initiated multi-step action. */
interface TxFlow {
  id: string;
  kind: 'create-payable' | 'pay' | 'pay-cross-chain' | 'withdraw' | 'close-payable' | 'reopen-payable'
      | 'update-payable-tokens' | 'update-payable-auto-withdraw' | 'update-payable-description';
  title: string;
  subtitle?: string;
  steps: TxStep[];
  status: 'running' | 'succeeded' | 'failed' | 'cancelled';
  result?: Record<string, unknown>; // ids, hashes
  canRunInBackground?: boolean;     // long waits the user may leave (relay, sync)
}
```

Store API:

- `start(kind, title, steps)` returns a handle with `step(key).activate() / wait() / done(meta?) / skip() / fail(error)` plus `finish(result)`, `cancel()` and `fail(error)`.
- `current` is the flow the UI shows in its modal. `background` is a list of flows still waiting (relay, sync) that the header can surface.
- A wallet rejection marks the flow `cancelled` with no error toast. Other errors mark the active step `failed` with a human-readable message and keep the existing error toast behaviour.

**Split `evm.writeContract` into observable phases.** It takes an optional step handle and reports:

1. `simulate`: the step is active with the description "Checking the transaction will succeed…".
2. Wallet prompt: the step is **waiting**, with the hint "Confirm in your wallet".
3. Hash received: the step records `txHash` and `explorerUrl`, and its description becomes "Confirming on {chain}…".
4. Receipt: `done`.

Keep the 3 s settle delay, but show it as part of the confirm step ("Finalizing").

**Wire each flow.** Every action below produces the listed steps, and each step's title and description are specific: they include amounts, token symbols and chain names.

| Flow | Steps |
| --- | --- |
| `create-payable` | `prepare` (read Wormhole fee) → `sign` → `confirm` → `description` (save via server; failure is non-fatal: mark `failed` with the message "Description can be added later from the payable page" and still succeed) → `sync` (optional, background: per same-network chain with messaging, poll `payableUpdateNonces` against the nonce from `PayableUpdateBroadcasted` in the receipt; one sub-status per destination chain; timeout after 10 min with a calm message) |
| `pay` (same chain) | `balance` → `allowance` (skipped for native) → `approve` (skipped if the allowance is enough) → `sign` → `confirm` |
| `pay-cross-chain` | `available` (the payable is synced to the payer's chain; `getForeignPayable`) → `fee` (CCTP fast-transfer fee + Wormhole fee) → `balance` → `allowance` → `approve` → `sign` (burn) → `confirm` (on the source chain) → `relay` (**waiting**, background-capable: polls `consumedPaymentNonces` on the payable chain; hints explain Circle attestation and relayer delivery; typical 1–3 min) → `received` (locates the PayablePayment on the destination via `payableChainPaymentIdsPaginated` + `payerPaymentId`) |
| `withdraw` | `sign` → `confirm`. The flow title includes the net amount after the 2% fee (fee bps from `getConfig`, capped by `maxWithdrawalFees`). |
| `close-payable` / `reopen-payable` / `update-payable-tokens` | `prepare` (Wormhole fee) → `sign` → `confirm` → `sync` (as for create) |
| `update-payable-auto-withdraw` | `sign` → `confirm`. The description states that this setting stays on the home chain. |
| `update-payable-description` | `save` (server). The host must be connected on the payable's chain. |

### 6. Host-control writes (`stores/evm.ts` + `stores/payable.ts`)

- In `evm.ts`, add `closePayable(id)`, `reopenPayable(id)`, `updatePayableAllowedTokensAndAmounts(id, taas)` and `updatePayableAutoWithdraw(id, bool)`, each with an exact `msg.value` per reference §4.
- In `payable.ts`, add `close`, `reopen`, `updateTokens`, `setAutoWithdraw` and `updateDescription`. Each:
  - checks that the connected wallet is the host,
  - checks that the connected chain is the payable's chain (otherwise it returns a typed error the UI can use to prompt a chain switch),
  - runs its tx flow,
  - refreshes the payable,
  - records analytics (`closed_payable`, `reopened_payable`, `updated_payable_tokens`, `updated_payable_auto_withdraw`, `updated_payable_description`).
- `createPayable` accepts `isAutoWithdraw` instead of hard-coding `false`.

### 7. Cross-chain pollers (`composables/usePoller.ts` + store functions)

- `usePoller(fn, { intervalMs, backoffAfterMs, maxIntervalMs, until })` is a generic visibility-aware polling composable. It pauses while `document.hidden`, stops on success or unmount, and exposes `{ status, attempts, lastCheckedAt, stop, checkNow }`.
- `payment.trackArrival(userPayment)` polls `consumedPaymentNonces` on the payable's chain, then resolves the PayablePayment. It returns `{ arrived: boolean, payablePayment? }`. It works standalone, so the receipt page can call it on load for any cross-chain UserPayment.
- `payable.trackSync(payableId, homeChain, nonce?)` returns per-chain sync status. With `nonce` it compares against `payableUpdateNonces`. Without `nonce` it compares `getForeignPayable` against home state (`isClosed`, `allowedTokensAndAmountsCount`).
- `payable.availability(payable)` lists every EVM chain in the same network and reports whether it can pay this payable:
  - home chain: always,
  - other chains: a synced foreign payable **and** a USDC route when the payable restricts tokens, or USDC available on both chains when it accepts any token.
  - It returns reasons for unavailable chains, for example "Not synced yet" or "USDC not supported".

### 8. Correctness fixes

- **Amounts:** replace every `number * 10 ** decimals` and `Number(bigint)` amount conversion in stores and schemas with `parseUnits` / `formatUnits` and bigint. `TokenAndAmount.amount` becomes `bigint`. Update display helpers accordingly, and the views that construct `TokenAndAmount` (minimal edits in `CreatePayableView`, `PayView`, `PayableDetailView`).
- **Allowance comparisons** use bigint (`Number(allowance) < amount` loses precision).
- **`PayView`:** fix `balanceError.value == ''`, which should be an assignment. Also remove the leaking `visibilitychange` and `focus` listeners in `PayView` and `PayableDetailView`, or add their removal in `onUnmounted`.
- **`TransactionsTable`:** sorting must not mutate the `receipts` prop. Copy it before sorting.
- **Explorer URLs:** `getWalletUrl` and `getTxUrl` must use the same explorer for MegaETH. Use the Blockscout instance for both.

### 9. Documentation

- Every new file gets a header comment and full TSDoc, following README §3.1–3.2.
- Add `src/stores/README.md`, which describes every store, its public API and its contract calls.
- Add `src/composables/README.md`.
- Update `frontend/CLAUDE.md`: stores, data rules, chain discovery, activity model, the tx-flow engine and the pollers. Remove statements that no longer hold, for example "`GET /payable/:id` — chain discovery" and "user doesn't wait on-page for relay completion".

### 10. Self-test page (dev only)

Add a `/_data` dev route (`src/views/DataDebugView.vue`, registered only when `import.meta.env.DEV`). It is unstyled and uses plain HTML. It:

- lets you enter a payable id, address or chain,
- dumps `payable.get`, `activity.getForPayable/User/Chain`, `stats.getNetworkStats('testnet')` and `payable.availability` results as JSON,
- has a button that runs a fake tx flow with timed steps, to exercise the engine.

Use it to verify reads against the live testnets. Note in the completion report a few real payable ids and addresses you found through `chainPayableIdsPaginated`, so later briefs can use them for screenshots.

## Out of scope

- Visual components and page layouts (briefs 02–06).
- Solana feature work. Keep Solana paths compiling; for unsupported operations, return `null` with a toast "Coming soon on Solana".

## Acceptance criteria

- [ ] Payables, payments, withdrawals and activities load **without a connected wallet** and without the server (with `VITE_SERVER_URL` empty, descriptions are empty and nothing else breaks).
- [ ] Activity lists are newest first, paginate correctly, resolve their entities, and support the cross-chain k-way merge with cursors.
- [ ] Network stats aggregate correctly and never mix mainnet with testnet, or one token with another.
- [ ] The tx-flow store emits correct step transitions for every flow in §5. The `/_data` fake flow demonstrates them.
- [ ] Host-control writes exist with exact Wormhole fee handling.
- [ ] `trackArrival`, `trackSync` and `availability` work against live testnet data, where data exists.
- [ ] Amounts are bigint end to end, and the precision fixes are in.
- [ ] Documentation per §9 is complete.
- [ ] `npm run type-check` and `npm run build` pass.
