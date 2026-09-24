# stores/

Every Pinia store in the app, in setup-store form (`defineStore('name', () =>
{...})`). This file describes each store's job, its public API, and which
contract calls or endpoints it touches. See `frontend/CLAUDE.md` for the
cross-store data rules (on-chain only, bigint amounts, no mixing mainnet and
testnet) that every store here follows.

## Data layer

### `evm.ts` — `useEvmStore`

The EVM read/write gateway. Every on-chain call to MegaETH, Arc Testnet or
Sepolia goes through here.

- **Reads never need a connected wallet.** `publicClientFor(chainName)`
  hands out one cached viem `PublicClient` per chain. `readGetter(chainName,
  fn, args, opts)` reads `CbGetters` (`gettersAbi`); `readMain(chainName, fn,
  args, opts)` reads the Chainbills proxy's own public state (`mainAbi`) —
  used only for `consumedPaymentNonces`, `payableUpdateNonces` and
  `getWormholeMessageFee`.
- `fetchPayable(id, chainName)` batches `getPayable` + `getAllowedTokensAndAmounts`
  + `getBalances` via `client.multicall` (falls back to three parallel reads
  when multicall3 is unavailable or the payable does not exist).
- `probeEntityChain(getterFn, id)` calls one single-entity getter
  (`getPayable`/`getUserPayment`/`getPayablePayment`/`getWithdrawal`/
  `getActivityRecord`) on every EVM chain **in parallel**, relying on the
  fact that the getter reverts on every chain but the right one — this is
  how the app finds which chain an id lives on without any off-chain index.
- Bulk getters: `getPayablesBulk`, `getUserPaymentsBulk`,
  `getPayablePaymentsBulk`, `getWithdrawalsBulk`, `getActivityRecordsBulk`,
  `getUsersBulk` — one call reverts if any id is missing; callers fall back
  to per-id reads.
- Paginated id-list wrappers for every `*IdsPaginated` getter (chain-wide,
  user-scoped and payable-scoped), plus `getPayableChainPaymentsCount`/
  `getPayableChainPaymentIdsPaginated` for locating a cross-chain payment's
  destination-side record.
- `getChainStatsOnChain`, `fetchChainConfig`, `getTokenDetailsOnChain` back
  `stores/stats.ts`.
- Writes: `createPayable`, `closePayable`, `reopenPayable`,
  `updatePayableAllowedTokensAndAmounts`, `updatePayableAutoWithdraw`, `pay`,
  `payForeignViaCctp`, `withdraw`. Each sends the exact Wormhole fee where
  the contract requires one (`reference/onchain-data.md` §4) and accepts an
  optional `WriteSteps` (`{ sign?, confirm? }`, plus `approve?` for the two
  payment writes) and `TxFlowHandle` so `writeContract` can report its
  phases onto a `stores/tx-flow.ts` flow. A wallet rejection cancels the
  flow with no error toast; any other failure fails the step and keeps the
  existing toast.
- `writeContract` is the one place a transaction is actually sent:
  simulate → wallet prompt (`sign` step) → hash received → wait for receipt
  → 3s settle delay (`confirm` step, shown as "Finalizing…").
- `consumedPaymentNonce`, `payableUpdateNonce`, `extractBroadcastNonce` are
  the low-level reads/parsers `stores/payment.ts`/`stores/payable.ts` build
  their pollers on top of.
- `balance(token)` returns the connected wallet's **raw** balance (bigint,
  smallest unit) for the connected chain.

### `abis.ts`

`erc20Abi`, `gettersAbi` (CbGetters) and `mainAbi` (the Chainbills proxy) —
no logic, just the ABI arrays `evm.ts` reads/writes against. Each entry
appears exactly once (previously duplicated).

### `payable.ts` — `usePayableStore`

Payable reads, on-chain chain discovery, and host-control writes. Never
requires a connected wallet for reads — payables are public.

- `resolveChain(id)` probes every EVM chain in parallel
  (`evm.probeEntityChain('getPayable', id)`), falling back to a Solana
  lookup, and caches the result.
- `get(id, ignoreErrors?)` resolves the chain, loads the on-chain struct
  (`evm.fetchPayable`/`solana.tryFetchEntity`), and layers the off-chain
  description from the server (`server.getPayable`, `ignoreErrors: true` —
  a missing/failed description never blocks the rest of the page).
- `create(description, tokensAndAmounts, isAutoWithdraw)` drives the
  `'create-payable'` tx-flow (`prepare` → `sign` → `confirm` → `description`
  → background `sync`).
- `close`, `reopen`, `updateTokens`, `setAutoWithdraw`, `updateDescription`
  each check the caller is the payable's host **and** connected on the
  payable's own chain (`requireHostOnChain`, returns a typed
  `PayableActionResult` with `error: 'not-host' | 'wrong-chain'` otherwise),
  then drive the matching tx-flow through `evm.ts` and refresh the payable.
- `trackSync(payableId, homeChain, nonce?)` — per-chain sync status: exact
  (`payableUpdateNonces >= nonce`) when a nonce is known, presence-only
  (`getForeignPayable` succeeds) otherwise.
- `availability(payable)` — which EVM chains of the payable's network can
  pay it right now, and why not when they can't (not synced yet / USDC not
  supported).
- `getPaymentId`/`getWithdrawalId` — single entity-by-count lookup, used
  only by the Solana-only pagination fallback in `payment.ts`/`withdrawal.ts`.

### `payment.ts` — `usePaymentStore`

- `exec(payableId, details, payableChain)` routes to `evm.pay`,
  `evm.payForeignViaCctp`, `solana.pay` or `solana.payForeignViaCctp`, and
  drives the `'pay'` or `'pay-cross-chain'` tx-flow (the latter runs its
  `relay`/`received` tail in the background via `trackArrival`).
- `get(id)` / `getForUser(id, chain)` / `getForPayable(id, chain)` resolve a
  payment without knowing its chain up front, probing every EVM chain in
  parallel via `evm.probeEntityChain`.
- `trackArrival(userPayment)` polls `consumedPaymentNonces` on the
  payable's chain until the relayer has delivered a cross-chain payment,
  then locates the destination-side `PayablePayment` via
  `getPayableChainPaymentIdsPaginated` + `getPayablePaymentsBulk`, matching
  on `payerPaymentId`. Standalone — usable from the receipt page directly.
- `getManyForCurrentUser`/`getManyForPayable` — paginated payment history,
  cache-first with a bulk-getter fallback for cache misses.

### `withdrawal.ts` — `useWithdrawalStore`

Same shape as `payment.ts` but for withdrawals: `exec` drives the
`'withdraw'` tx-flow (`sign` → `confirm`, never cross-chain); `get` probes
every EVM chain in parallel when the chain is not known; `getManyForCurrentUser`/
`getManyForPayable` page withdrawal history.

### `activity.ts` — `useActivityStore`

Builds the unified activity feed from raw `ActivityRecord`s.

- `getForPayable`/`getForUser`/`getForChain` — one chain's own feed, newest
  first (see `pageOffsetAndLimit` for the oldest-first-storage → newest-first
  reverse-offset maths, documented in `reference/onchain-data.md` §2).
- `resolveEntities(activities)` fills in each `Activity`'s concrete entity,
  grouping by `(chain, type)` so each group costs one bulk getter call
  (falling back to per-id reads on a revert). Resolved payments and
  withdrawals are cached (immutable); payables never are (their state
  keeps changing).
- `getForUserAcrossChains`/`getForNetwork` — k-way merge each EVM chain's
  own newest-first stream into one, via a `MultiChainCursor` that survives
  across "load more" calls with no duplicates and no gaps (see the doc
  comment on `mergeChainStreams` for the guarantee's proof sketch).
- `byCategory`/`byTypes`/`loadUntil` — client-side filtering helpers, since
  there is no server-side filter on-chain.

### `stats.ts` — `useStatsStore`

`getChainStats(chain)` (`getChainStats()` + `getConfig()`),
`getTokenVolumes(chain)` (`getTokenDetails()` per known token),
`getNetworkStats(networkType)` (aggregates the above across a network's
chains — mainnet and testnet, and different tokens, are never mixed).
Results are memoized in-process for 30 seconds.

### `tx-flow.ts` — `useTxFlowStore`

The transaction-flow engine: `start(kind, title, steps)` returns a
`TxFlowHandle` (`step(key)`, `finish`, `cancel`, `fail`,
`moveToBackground`); each `TxStepHandle` exposes `activate`/`wait`/
`progress`/`done`/`skip`/`fail`. `current` is the flow the UI's modal shows;
`background` lists flows still waiting (relay/sync) that the app shell can
surface separately. No contract calls of its own — `evm.writeContract` (and
the store actions that call it) drive the steps.

## Supporting stores

### `cache.ts` — `useCacheStore`

`retrieve(key)`/`save(key, value)` over an IndexedDB object store
(`chainbills` DB, `cache-v2` store). Used for immutable-data caching
(resolved payments, withdrawals, activity records, chain-discovery results)
— never for a payable, whose state changes.

### `auth.ts` — `useAuthStore`

Wallet connect/disconnect (EVM via wagmi, Solana via `solana-wallets-vue`),
the `"Authentication"` signature flow, and `currentUser: User | null`.
Delegates chain-specific reads to `evm.ts`/`solana.ts` via `getChainStore`.

### `server.ts` — `useServerStore`

Calls the Firebase Cloud Function server: `POST /payable` (upsert
description), `GET /payable/:id` (description lookup **only** — never used
for chain discovery, which is on-chain per `payable.resolveChain`),
`POST /notifications`. Every call sends `chain-name`/`wallet-address`/
`signature` headers when signed in.

### `analytics.ts` — `useAnalyticsStore`

Thin wrapper over Firebase Analytics: `recordEvent(name, params)`,
`recordNavigation(path, name)`.

### `abis.ts`, `idl.ts`, `chainbills-idl.json`

Static contract interfaces: EVM ABIs (`abis.ts`) and the Solana Anchor IDL
(`idl.ts`, generated from `chainbills-idl.json`).

### `notifications.ts`, `paginators.ts`, `sidebar.ts`, `theme.ts`, `time.ts`, `encoding.ts`

Small, focused stores/utilities: FCM token registration, the shared
rows-per-page setting, sidebar open/close state, light/dark theme, relative
timestamp formatting, and hex/base58/base64/bigint byte encoding helpers
used when normalizing addresses across EVM and Solana.

### `solana.ts` — `useSolanaStore`

Solana reads/writes via Anchor. **Inactive this round** — kept compiling
and functional at the store level, but no new feature work targets it; the
UI degrades to "coming soon on Solana" for anything not already wired.
