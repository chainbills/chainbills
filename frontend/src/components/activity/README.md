# `src/components/activity/`

The reusable activity-feed UI: one unified feed for every `ActivityType`
(payments, withdrawals, payable creation/close/reopen/settings, new-wallet
events), shared by the user activity page (`/activity`), the payable page
(`/payable/:id`, brief 04) and Chainbills Scan (`/scan*`, brief 05). Import
from the barrel: `import { ActivityFeed } from '@/components/activity'`.

Data comes from `stores/activity.ts`; see that file's own doc comment and
`frontend/docs/redesign/reference/onchain-data.md` §2–3 for how the
underlying on-chain reads work. Every component here assumes each
`Activity`'s `entity` has already been resolved (`resolveEntities`) —
`ActivityFeed` does that for you; nothing else in this folder fetches
`entity` on its own.

## `ActivityFeed.vue` — the smart container

The only component pages should reach for directly. Point it at a `source`
and it owns fetching, category tabs, filter chips, search, pagination (or
"Load more" for a merged feed) and the loading/empty/error states.

```vue
<ActivityFeed :source="{ kind: 'payable', payable }" searchable filterable persist-key="payable-activity" />
<ActivityFeed :source="{ kind: 'user', address, networkType: 'testnet' }" searchable filterable />
<ActivityFeed :source="{ kind: 'user', address, networkType: 'testnet', chain: sepolia }" />
<ActivityFeed :source="{ kind: 'chain', chain: sepolia }" :tabs="['all', 'payments']" />
<ActivityFeed :source="{ kind: 'network', networkType: 'mainnet' }" filterable />
```

`source` is a discriminated union (`ActivitySource`, also exported from the
barrel):

| `kind` | Feed | Paging |
| --- | --- | --- |
| `'payable'` | one payable's own activity | numbered pages (`getForPayable`) |
| `'user'` with `chain` | one wallet, one chain | numbered pages (`getForUser`) |
| `'user'` without `chain` | one wallet, merged across every EVM chain of `networkType` | cursor "Load more" (`getForUserAcrossChains`) |
| `'chain'` | a whole chain's activity | numbered pages (`getForChain`) |
| `'network'` | merged across every EVM chain of `networkType` | cursor "Load more" (`getForNetwork`) |

A single-chain source pages with an ordinary page number, since the
contract exposes a real offset/total for it. A merged source has no single
global offset (each chain's own list is paged independently and interleaved
client-side — see `stores/activity.ts`'s `mergeChainStreams`), so it instead
accumulates a growing window and exposes a "Load more" button.

Category tabs (`All`/`Payments`/`Withdrawals`/`Payables`, plus `Settings`
automatically for a payable source) and the type/token/chain filter chips
narrow whatever window is loaded. Because there is no server-side filter
on-chain, a filtered single-chain page is assembled with
`useActivityStore().loadUntil` (keeps loading raw pages until enough
matching items exist), and a filtered merged stream does the equivalent
inline against its own "Load more" batches — a filtered page is never left
short while more matching data is still reachable.

Props: `source`, `tabs?`, `columns?` (forwarded to `ActivityTable`),
`pageSize?` (default 20), `persistKey?` (remembers the active tab/page in
`localStorage`), `searchable?`, `filterable?`. Events: `select(activity)`
(a row was opened), `loaded({ total })` (after every successful fetch).

On window focus, the feed silently re-checks the total; if it grew and the
user is on the first page/batch, the new items are fetched and briefly
highlighted (`ActivityTable`/`ActivityList`'s `highlightIds` prop) rather
than yanking the list around unannounced.

## `ActivityTable.vue` / `ActivityList.vue` — desktop / mobile presentation

`ActivityFeed` renders both at once (`hidden md:block` / `md:hidden`) so
there is no layout flash at the `md` breakpoint; pages should not need to
reach for these directly.

- `ActivityTable.vue`: the `glass-dense` table from design-language.md
  §7.4 — `#`, Activity, Details, Route, Payable, Actor, Time, and an expand
  chevron. Columns are individually hideable via `columns`. Clicking a row
  (or the chevron) expands `ActivityDetailPanel` below it.
- `ActivityList.vue`: stacked `ActivityRow`s; tapping one opens
  `ActivityDetailPanel` in a bottom-sheet `Dialog`.

Both accept a `highlightIds?: Set<string>` prop (set by `ActivityFeed`
after a live refresh) that gives matching rows a brief accent tint.

## Shared building blocks

- **`ActivityIcon.vue`** — the tinted `IconChip` for one `ActivityType`,
  resolved from `schemas/activity.ts`'s `activityTypeMeta` (icon key + tone).
- **`ActivityDetails.vue`** — the "Details" cell/line: a `TokenAmount` for
  payments/withdrawals, or a plain-text current-state summary for a
  payable-settings activity (only using fields `resolveEntities` actually
  populates — see the component's doc comment for why a settings row never
  claims an exact token count).
- **`ActivityRow.vue`** — one stacked row (icon, title + chain badge, mono
  sub-line, amount/time), the building block behind `ActivityList`.
- **`ActivityDetailPanel.vue`** — the full field-by-field `KeyValueList`
  breakdown, shared by `ActivityTable`'s expanded row and `ActivityList`'s
  bottom sheet. Mounting it is what triggers its one lazy check: whether a
  pending cross-chain `UserPaid` has arrived yet (`payment.trackArrival`,
  run once in `onMounted`), and the withdrawal-fee breakdown for a
  `Withdrew` activity (`stats.getChainStats`).

## Adding a new activity type

1. Add the member to `ActivityType` and its entry in `activityTypeMeta`
   (`schemas/activity.ts`) — icon key, tone, category, label.
2. If the icon key is new, add the icon component under `src/icons/` and
   register it in `ActivityIcon.vue`'s `iconComponents` map.
3. Extend `ActivityDetails.vue`'s `settingsSummary` (if it is a
   payable-settings-style activity) and `ActivityDetailPanel.vue`'s `items`
   computed (if it needs its own detail rows).
