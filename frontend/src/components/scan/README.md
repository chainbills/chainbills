# `src/components/scan/`

The Chainbills Scan UI component library. Every component here is specific
to the `/scan` and `/scan/address/:address` pages. They are consumed by
`views/scan/ScanView.vue` and `views/scan/ScanAddressView.vue`. All data is
fetched from the on-chain contract via `stores/scan.ts` (no Firestore, no
relayer); every component works without a connected wallet.

Import from individual files (no barrel these are page-specific components):
```typescript
import ScanHeader from '@/components/scan/ScanHeader.vue';
import ScanStats from '@/components/scan/ScanStats.vue';
// etc.
```

---

## Components

### `ScanHeader.vue`

The top section of the Scan page. Contains the display-font title with an
accent tail, a Mainnet/Testnet `SegmentedTabs` switch, a chain-filter chip
row (one `ChainBadge`-labelled chip per chain in the network plus "All
chains"), and a large `SearchInput`.

**Props:** `network`, `chain`, `networkChains`, `modelValue` (search string).
**Emits:** `update:network`, `update:chain`, `update:modelValue`.

The chain chips carry each chain's `brandColor` as a tint, per the design
system rule that chain colours are used for identity (badges, rails) but
never as UI accent.

---

### `ScanStats.vue`

The stats strip below the header. Shows one `StatTile` per entity counter
(payables, payments with "made" hint, withdrawals, users, activities) plus
per-token volume tiles. When `allChains` is true, a `ChainBreakdownBar`
sits beneath each count tile.

**Props:** `stats` (`ChainStatsSummary | NetworkStats | null`), `tokenVolumes`,
`loading`, `allChains`, `chains`.

`stats` is a union of two types that share the same count field names, so the
template reads them uniformly with the `get(field)` helper.

---

### `ChainBreakdownBar.vue`

A slim horizontal proportional bar used under each `StatTile` in the
all-chains view. Each segment's width is `values[chain.name] / total`,
filled with the chain's `brandColor` at 60% opacity. A `title` attribute on
each segment acts as a tooltip.

**Props:** `chains: Chain[]`, `values: Partial<Record<ChainName, number>>`,
`total: number`.

---

### `ScanSearch.vue`

The self-contained search component used inside `ScanHeader`. Debounces
input 300 ms, cancels stale in-flight probes via `AbortController`, and
delegates detection to `useScanStore().search`. When the store returns a
multi-match `entity` result, a glass-card popover lists each match with its
type pill, `ChainBadge` and navigation link. Single matches and all other
result kinds are emitted immediately as a `result` event.

**Props:** `modelValue: string`, `networkType: ChainNetworkType`.
**Emits:** `update:modelValue`, `result(SearchResult)`.

---

### `ScanEntityTable.vue`

The generic glass-dense table shell shared by all five entity tabs. Renders
a sticky header, data rows, expandable detail panels (desktop: inline
`KeyValueList`; mobile: `Dialog` bottom-sheet), skeleton rows while loading,
empty and error states.

**Props:** `columns: ColumnDef[]`, `rows`, `loading`, `total`, `page`,
`pageSize`, `allChains`, `hasMore`, `filterNote`, `error`.
**Emits:** `update:page`, `loadMore`, `retry`.
**Slots:** `cell-{column.slotName}({ row })` for custom cell rendering;
`row-detail({ row })` for the expanded-row content.

The `filterNote` prop is the "honest window" label, e.g. "Filtering the
latest 200 payments". Callers supply it when the displayed data is a loaded
window rather than a complete server-filtered result.

---

### `ScanPayablesTable.vue`

Wraps `ScanEntityTable` for payables. Fetches via
`scan.getChainPayables` (single chain, numbered pages) or
`scan.getNetworkPayables` (all chains, "Load more"). Adds an Open/Closed
status filter chip row.

**Columns:** avatar + id, chain, host, status pill, rules summary (token
count or "Any"), payments count, created date.

---

### `ScanPaymentsTable.vue`

Wraps `ScanEntityTable` for payments, with a `SegmentedTabs` sub-toggle:
- **Received:** payable-side payments (`chainPayablePaymentIdsPaginated`).
- **Made:** user-side payments (`chainUserPaymentIdsPaginated`).

Adds a Same-chain/Cross-chain direction filter applied to the loaded window
using the `payerChainId` vs the destination chain's `cbChainId`.

**Columns (received):** amount, route (source to destination `ChainBadge`),
payable, payer, time, receipt link.
**Columns (made):** amount, payable, destination chain, time.

---

### `ScanWithdrawalsTable.vue`

Wraps `ScanEntityTable` for withdrawals. The on-chain record stores only the
net amount; gross and fee are reconstructed from the `withdrawalFeePercentage`
config (basis points) and labelled "est." so users understand these are
derived values, not stored ones.

**Columns:** net amount, fee (est.), gross (est.), payable, host, time, receipt link.

---

### `ScanUsersTable.vue`

Wraps `ScanEntityTable` for users. In all-chains mode, rows are grouped by
chain (no per-user timestamp exists on-chain, so ordering is by chain list
order the UI labels this "grouped by chain"). Each row links to
`/scan/address/:address`.

**Columns:** address, chain, payables count, payments count, withdrawals
count, activities count.

---

## How the pieces relate

```
ScanView.vue
  ScanHeader.vue          ← title, network switch, chain chips, search
    SearchInput (ui)
    ChainBadge (ui)
  ScanStats.vue           ← stat tiles + token volumes
    StatTile (ui)
    ChainBreakdownBar.vue ← per-chain proportional bar
  ActivityFeed (activity) ← Activity tab (from components/activity)
  ScanPayablesTable.vue   ← Payables tab
  ScanPaymentsTable.vue   ← Payments tab (Received / Made)
  ScanWithdrawalsTable.vue← Withdrawals tab
  ScanUsersTable.vue      ← Users tab
    ScanEntityTable.vue   ← shared table shell used by all four above

ScanAddressView.vue
  AddressChip (ui)
  NetworkPill (ui)
  ChainBadge (ui)
  per-chain GlassCard presence cards (inline)
  ActivityFeed (activity)
  ScanPayablesTable.vue
  ScanPaymentsTable.vue
  ScanWithdrawalsTable.vue
```

---

## Usage examples

```vue
<!-- Full scan overview -->
<ScanView />

<!-- Address detail page navigated to from a search or a users table row -->
<ScanAddressView />

<!-- Payables table, all chains merged -->
<ScanPayablesTable :chain-name="null" network-type="testnet" :page="0" :page-size="20" />

<!-- Payables table, single chain numbered pages -->
<ScanPayablesTable chain-name="sepolia" network-type="testnet" :page="page" :page-size="20" @update:page="page = $event" />

<!-- Entity table with custom cell slots -->
<ScanEntityTable :columns="cols" :rows="rows" :loading="loading" :total="total" :page="page" :page-size="20" :all-chains="false">
  <template #cell-id="{ row }"><AddressChip :value="row.id" kind="id" /></template>
  <template #row-detail="{ row }"><dl>...</dl></template>
</ScanEntityTable>
```
