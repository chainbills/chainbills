# Brief 02 — Activity Feed Components and User Activity Page

**Wave:** 2 (parallel with 03 and 06) · **Depends on:** 00, 01 merged · **Blocks:** 04, 05

## Read first

1. `frontend/docs/redesign/README.md` (global rules; documentation rules are mandatory).
2. `frontend/docs/redesign/reference/design-language.md` §7.2, §7.4.
3. `frontend/docs/redesign/reference/onchain-data.md` §2–3.
4. `frontend/CLAUDE.md`, `src/components/ui/README.md`, `src/stores/README.md` (both produced by wave 1), `src/stores/activity.ts`, `src/schemas/activity.ts`, `src/views/UserActivityView.vue`, `src/components/TransactionsTable.vue`.

## Goal

Build the reusable activity UI that the payable page (04), the scan (05) and the user activity page all share. Then rebuild the user activity page on top of it.

Every activity type is shown together in one feed. Tabs filter the feed. The feed also handles the payments and withdrawals views.

## Components (`src/components/activity/`)

### `ActivityFeed.vue` — the smart container

- **Props:**
  - `source`: a discriminated union.
    - `{ kind: 'payable', payable }`
    - `{ kind: 'user', address, networkType, chain?: Chain }` — `chain` is optional; without it the feed merges every chain in the network.
    - `{ kind: 'chain', chain }`
    - `{ kind: 'network', networkType }`
  - `tabs?`: which category tabs to show. Default: `All · Payments · Withdrawals · Payables`. A `Settings` tab (close/reopen/update activity types) appears for payable sources.
  - `columns?`: which columns to show.
  - `pageSize?`: default 20.
  - `persistKey?`: localStorage key that remembers the active tab and page per source.
  - `searchable?` and `filterable?`: booleans that turn on the toolbar.
- **Data:** uses `useActivityStore`. Single-chain sources use numbered pagination. Merged sources (user across chains, network) use cursor-based "Load more".
- **Filtering:** category tabs and type chips filter the loaded window. The feed then calls `loadUntil` so a filtered page is never left short while more data exists (see brief 01 §3).
- **Toolbar** (when enabled):
  - `SearchInput` that filters the loaded items by id, address or payable id (case-insensitive substring);
  - `FilterChips` for activity types, token and chain (chain filter only for merged sources);
  - a refresh button that spins while loading;
  - an item count ("Showing 20 of 134").
- **States:** skeleton rows while loading, `EmptyState` with source-specific copy, `ErrorState` with retry.
- **Live refresh:** on window focus, silently re-read the total. If it grew and the user is on the newest page, prepend the new items with a brief highlight.
- **Events:** emits `select(activity)` and `loaded({ total })`.

### `ActivityTable.vue` — desktop presentation (≥ md)

A glass-dense table (see `design-language.md` §7.4). Columns (each can be hidden):

- **#** — the source-relative count.
- **Activity** — icon chip + label + status tone.
- **Details** — `TokenAmount` for payments and withdrawals; for settings activities, the payable's current state summary (e.g. "Now closed", "Accepts 3 token options").
- **Route** — `ChainBadge`. Cross-chain payments show `Sepolia → Arc Testnet`: payer chain to payable chain, with a small animated rail.
- **Payable** — `AddressChip` linking to `/payable/:id`.
- **Actor** — `AddressChip` for the payer or host, linking to `/scan/address/:address` (the route arrives with brief 05; link anyway).
- **Time** — relative time, absolute on hover.
- **Expand chevron.**

**Expanded row:** a `KeyValueList` with every on-chain field of the activity and its entity:

- activity id and entity id;
- chain, user and payable counts;
- block timestamp (absolute);
- for payments: `payerPaymentId` ↔ payable payment id, both linked to `/receipt/:id`, plus the source and destination chains;
- for withdrawals: gross amount, the 2% fee computed from chain config, and the net amount.

**Row accents:**

- Rows for the connected user's own actions get a subtle "You" tag.
- A cross-chain UserPaid row whose delivery is not yet confirmed shows a pending rail. This check is optional and lazy: run `payment.trackArrival` once, only when the row is expanded.

### `ActivityList.vue` — mobile presentation (< md)

- Stacked `ActivityRow` items as defined in `design-language.md` §7.4.
- Tapping a row opens a bottom-sheet dialog showing the same details as the expanded table row.

### `ActivityRow.vue`, `ActivityIcon.vue`, `ActivityDetails.vue`

- These are shared building blocks used by the table, the list and the detail panel.
- `ActivityIcon` maps each `ActivityType` to an icon and a tone:
  - payment → success
  - withdrawal → info
  - created → accent
  - closed → danger
  - reopened → success
  - updated → warning
  - user initialised → neutral
- Add any missing icons to `src/icons/` using the same pattern as the existing icon components.

### `README.md`

Describe each component, its props, the data flow, and usage examples for each source kind.

## User Activity page (`src/views/UserActivityView.vue`, route `/activity`)

**Header:**

- Title: "Your activity".
- The connected wallet's `AddressChip`.
- A `NetworkPill` that follows the connected chain's network.
- A `SegmentedTabs` scope switch:
  - "This chain" — `source.kind = 'user'` with `chain` set;
  - "All {network} chains" — merged across the network.

**Stats row** (`StatTile`s):

- Payments made, payables created, withdrawals, total activities — all from `getUser` on each chain.
- For the merged scope, sum them across the chains of the connected network.

**Feed:** `ActivityFeed` with toolbar, tabs `All · Payments · Withdrawals · Payables`, and `persistKey` set per wallet.

**Not connected:**

- Glass `EmptyState` with a connect CTA.
- Also a "Look up any address" input that routes to `/scan/address/:address`.

**Retire** `TransactionsTable.vue` and `TableLoader.vue` once no view imports them. Views owned by other wave-2 briefs may still import them; if so, leave the files in place and note it in the completion report.

## Out of scope

- Payable page (04).
- Scan pages (05).
- Receipt page (03).

## Acceptance criteria

- [ ] `ActivityFeed` works for all four source kinds (demonstrate the payable, chain and network kinds on the dev gallery `/_ui` or the `/_data` page).
- [ ] Tabs, type chips, search, pagination (numbered and cursor), refresh and live-prepend all work.
- [ ] Rows render every activity type correctly, including cross-chain routes and settings activities.
- [ ] Mobile list and bottom-sheet details work at 360 px.
- [ ] The user activity page is rebuilt with both scopes and stats.
- [ ] Documentation per README §3.1–3.2, including `src/components/activity/README.md` and a `frontend/CLAUDE.md` update.
- [ ] Type-check and build pass; screenshots attached (desktop/mobile × light/dark).
