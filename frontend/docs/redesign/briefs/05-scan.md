# Brief 05 — Chainbills Scan (On-Chain Explorer)

**Wave:** 3 (runs in parallel with 04) · **Depends on:** 00, 01, 02 and 03 merged

## Read first

1. `frontend/docs/redesign/README.md`: the global rules.
2. `frontend/docs/redesign/reference/design-language.md`.
3. `frontend/docs/redesign/reference/onchain-data.md`: all of it, especially §2 (paginators) and §5.3 (probing).
4. The READMEs in `src/components/{ui,activity}/` and `src/stores/`.

## Goal

Build a public, **purely on-chain** explorer for Chainbills. It shows the protocol working across chains:

- per-chain views,
- "all chains" views,
- entity lists,
- search,
- filters.

**Mainnet and testnet are always separate.** No list, total or chart ever mixes them.

## Routes

| Route | View | Purpose |
| --- | --- | --- |
| `/scan` | `views/scan/ScanView.vue` | Network overview and entity tabs |
| `/scan/address/:address` | `views/scan/ScanAddressView.vue` | A wallet across every chain of its network |
| `/payable/:id`, `/receipt/:id` | existing pages | Entity detail pages. Scan links to them. |

**Query parameters** (kept in sync with the UI so any view can be shared as a link):

| Parameter | Values | Default |
| --- | --- | --- |
| `network` | `mainnet` or `testnet` | `testnet` while mainnet activity is sparse; the default lives in one constant |
| `chain` | `all` or a chain name within the network | `all` |
| `tab` | `activity`, `payables`, `payments`, `withdrawals` or `users` | `activity` |
| `q` | search text | empty |
| `types` | comma-separated activity types | none |
| `page` | page number (single-chain views only) | first page |

## Overview page (`/scan`)

### Header

- The title "Chainbills Scan" with the accent tail "Every payment. Every chain.".
- A network switch, `SegmentedTabs`: Mainnet / Testnet.
- A chain selector, `FilterChips`: "All chains" plus each chain in the network, each with its `ChainBadge` and brand tint.
- A large `SearchInput`, with `/` to focus.

### Stats strip

`StatTile`s from `stats.getNetworkStats(network)`, or `getChainStats(chain)` when a single chain is selected:

- payables;
- payments;
  - the payments tile shows "made" and "received" as separate hints, because cross-chain payments count on both sides;
- withdrawals;
- users;
- activities;
- per-token volume: `totalPayableReceived` per token, shown as `TokenAmount`s. Never sum different tokens.

A small per-chain breakdown bar (chain brand colours) sits under each count when "All chains" is selected.

### Cross-chain highlight

A slim band shows:

- how many payments on the selected chain(s) came from another chain: `PayablePayment.payerChainId != chain` among the loaded window;
- plus `foreignPayablesCount` ("payables synced from other chains").

Label these numbers honestly, for example "in the latest 100 payments".

### Tabs

`SegmentedTabs` with counts. Each tab is an explorer table.

| Tab | Source | Columns |
| --- | --- | --- |
| Activity | `ActivityFeed` with source `chain` or `network` (brief 02) | as in brief 02 |
| Payables | `chainPayableIdsPaginated` → `getPayablesBulk` + ATAA/balances | avatar + id, chain, host, status, rules summary, payments count, balances, created |
| Payments | `chainPayablePaymentIdsPaginated` (received on this chain) → `getPayablePaymentsBulk`. A sub-toggle "Received / Made" switches to `chainUserPaymentIdsPaginated` → `getUserPaymentsBulk`. | amount, route (source → destination), payable, payer, time, receipt link |
| Withdrawals | `chainWithdrawalIdsPaginated` → `getWithdrawalsBulk` | amount (gross, fee, net), payable, host, time, receipt link |
| Users | `chainUserAddressesPaginated` → `getUsersBulk` | address, chain, payables, payments, withdrawals, activities (link to the address page) |

Put the table logic in `src/components/scan/ScanEntityTable.vue`, generic over a column config, plus one small wrapper per tab. Reuse the activity table styling: glass-dense surface, sticky header, expandable rows with `KeyValueList`, and a mobile stacked list.

### Pagination and merging

- **Single chain:** numbered pages, newest first. The offset maths is in reference §2.
- **All chains:** a k-way merge by timestamp across the network's chains, with cursor "Load more". Build it the same way as `activity.getForNetwork`: generalise that helper in the store, or add an entity-specific equivalent to `stores/scan.ts`.
  - Payables merge by `createdAt`.
  - Users have no timestamp, so they merge by chain order. State this in the UI with the note "grouped by chain".

### Filters

- Activity types: chips.
- Token: chips for the tokens present on the selected chain(s).
- Status (payables): Open / Closed.
- Direction (payments): Same-chain / Cross-chain.

Filters apply to the loaded window, with `loadUntil` behaviour (brief 01 §3). The UI says so, for example "Filtering the latest 200 payments · Load more".

## Search

Search runs entirely on-chain. It lives in `stores/scan.ts` as `search(q, network)` and returns typed results.

| Input | Detection | Resolution |
| --- | --- | --- |
| EVM address (`0x` + 40 hex) | regex | route to `/scan/address/:address` |
| 32-byte id (`0x` + 64 hex) | regex | probe in parallel on each chain of the network (**and** the other network, shown as a secondary result): `getPayable`, `getUserPayment`, `getPayablePayment`, `getWithdrawal`, `getActivityRecord` |
| Chain name or alias ("sepolia", "arc", "mega") | fuzzy match against `displayName` / `name` | set the `chain` filter |
| Token symbol ("usdc", "eth") | match `tokens` | set the token filter |
| Anything else | — | filter the loaded rows (substring match on ids and addresses) and show "No exact on-chain match" |

For 32-byte id probes:

- A single match navigates straight away.
- Several matches (for example a same-id payable and payment are impossible, but a payment exists on both sides) show a results popover. Each result shows a type pill, a chain badge and a link.
- A payment id found as a UserPayment links to `/receipt/:id`. A payable id links to `/payable/:id`.

The header search box (brief 00 shell) is out of scope. The scan page owns its own search.

## Address page (`/scan/address/:address`)

### Header

- `AddressChip` (large).
- A network switch.
- Explorer links per chain where the user exists.
- A "This is you" badge when the address is connected.

### Per-chain presence cards

For every chain in the network, show `getUser` counts, or "No activity on {chain}".

### Tabs

**Activity** (`ActivityFeed` with source `user`, merged across the network, and a chain chip filter) · **Payables** · **Payments** · **Withdrawals**. The last three use the user-scoped paginators, merged across chains.

### Empty state

When the address never interacted on any chain of the network, say so, and link to the other network.

## Components and stores

- `src/components/scan/`:
  - `ScanHeader.vue`
  - `ScanStats.vue`
  - `ScanEntityTable.vue`
  - `ScanPayablesTable.vue`
  - `ScanPaymentsTable.vue`
  - `ScanWithdrawalsTable.vue`
  - `ScanUsersTable.vue`
  - `ScanSearch.vue`
  - `ChainBreakdownBar.vue`
  - `README.md`
- `src/stores/scan.ts`: entity paginators per chain and network, merges, search. Fully documented.
- Router: add the two routes (lazy loaded) and `meta.title`s.

## Performance

- Batch bulk reads per page. Never do one RPC call per row.
- Memoise resolved immutable entities through `cache.ts`.
- Debounce search input by 300 ms. Cancel stale probes with an abort flag.
- Show skeleton rows while loading, and keep the previous rows visible while the next page loads.

## Documentation

- Follow README §3.1–3.2.
- Add `src/components/scan/README.md`.
- Update `src/stores/README.md` for `scan.ts`.
- Update `frontend/CLAUDE.md` with the routes and the scan data model.

## Acceptance criteria

- [ ] `/scan` works without a wallet, for both networks and for every chain selection. It never mixes networks.
- [ ] The stats strip, all five tabs, the filters and pagination (numbered and merged "Load more") work against live data.
- [ ] Search resolves addresses, ids (with multi-chain probing), chain names and token symbols. The URL reflects the state.
- [ ] The address page shows per-chain presence and merged tabs.
- [ ] The UI stays honest about loaded-window filtering.
- [ ] The header "Scan" link lands here.
- [ ] Documentation is complete. Type-check and build pass.
