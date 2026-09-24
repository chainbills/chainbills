# Chainbills Frontend — CLAUDE.md

## Overview

Vue 3 SPA. Stack: Vue 3 + Pinia + Vue Router + Wagmi/viem (EVM) + Solana Wallets Vue + PrimeVue + TailwindCSS + Firebase. Talks to: EVM contracts (via wagmi/viem), Solana program (via Anchor), the Firebase server (descriptions + FCM tokens only). All lists, counts, statuses, balances, settings and statistics are read from the Chainbills contracts — see **Data rules** below.

## File Map

```
src/
  main.ts              App bootstrap: Wagmi config (incl. the "liquid glass" PrimeVue preset), Pinia, Firebase init
  App.vue              Root: AmbientBackdrop, glass refraction filter, Header/Sidebar/Footer, router-view, Toast
  router/index.ts      Routes: /, /start, /dashboard, /activity, /payable/:id, /pay/:id, /receipt/:id, (+ /_ui in dev only)
  directives/
    reveal.ts          v-reveal — scroll-entrance directive, registered globally in main.ts
    README.md          Directive usage reference
  assets/
    main.css           Design tokens (light/dark CSS vars) + glass surface utility classes — see "Design System" below
  schemas/
    activity.ts        ActivityType enum + display metadata, Activity class
    chain.ts           Chain type, ChainName, chain constants, explorer URL helpers, OnChainSuccess
    tokens.ts          Token type, tokens array (USDC/ETH/SOL), TokenAndAmount (bigint amounts), format/parse helpers
    payable.ts         Payable class
    payment.ts         Payment interface
    user-payment.ts    UserPayment class
    payable-payment.ts PayablePayment class
    withdrawal.ts      Withdrawal class
    user.ts            User class
    receipt.ts         Receipt interface (shared by UserPayment/PayablePayment/Withdrawal)
    index.ts           Re-exports all schemas
  composables/
    usePoller.ts       Generic visibility-aware polling loop (see composables/README.md)
  stores/              See stores/README.md for the full store-by-store breakdown.
    auth.ts            useAuthStore — wallet connect/disconnect, signature, currentUser
    evm.ts             useEvmStore — all EVM contract reads + writes (wagmi/viem)
    solana.ts          useSolanaStore — Solana reads + writes (Anchor) — inactive this round
    payable.ts         usePayableStore — chain discovery, create/get, host-control writes
    payment.ts         usePaymentStore — exec payment (routes same/cross-chain), get payments, trackArrival
    withdrawal.ts       useWithdrawalStore — withdraw, get withdrawals
    activity.ts        useActivityStore — unified activity feeds, entity resolution, cross-chain k-way merge
    stats.ts           useStatsStore — chain/network statistics, 30s memoized
    tx-flow.ts         useTxFlowStore — the transaction-flow step engine
    server.ts          useServerStore — calls Firebase server (descriptions, notifications)
    cache.ts           useCacheStore — IndexedDB-backed cache for immutable entities
    paginators.ts      usePaginatorsStore — shared rowsPerPage state
    abis.ts            mainAbi (Chainbills proxy) + gettersAbi (CbGetters) + erc20Abi
    analytics.ts       useAnalyticsStore — Firebase Analytics event recording
    notifications.ts   usePaginatorsStore — FCM notification token setup
    encoding.ts        hex/b58/bignum/bytes encode/decode utilities
    idl.ts             Solana IDL (Anchor)
    sidebar.ts         Sidebar open/close state
    theme.ts           Light/dark theme toggle
    time.ts            Timestamp formatting helpers
    index.ts           Re-exports all stores
  views/
    HomeView.vue          Landing page
    CreatePayableView.vue  Create payable form
    DashboardView.vue      Host dashboard: list payables, balances, withdraw
    UserActivityView.vue   User's payment + withdrawal history
    PayableDetailView.vue  Payable detail: payments received, host controls
    PayView.vue            Payer's payment UI
    ReceiptView.vue        Payment receipt (public)
    NotFoundView.vue       404, built from the `EmptyState` primitive
    UiGalleryView.vue      Dev-only (`/_ui`) showcase of every component in `components/ui/`
  components/
    Header.vue, Footer.vue, Sidebar.vue    App shell — see "Design System" below
    PayableInfoCard.vue
    TransactionsTable.vue
    MakePaymentLoader.vue, PayableDetailLoader.vue, ReceiptLoader.vue, TableLoader.vue
    Shimmer.vue              Pre-redesign shimmer loader (vue3-loading-shimmer); new code uses `ui/Skeleton.vue` instead
    SignInButton.vue
    ThemeMenu.vue
    ui/                      The "liquid glass" primitive library — see `components/ui/README.md` and "Design System" below
  icons/                   SVG icon components (IconArc, IconEthereum, IconMegaETH, etc.)
```

## Chain Support

| ChainName      | Type   | networkType | cbChainId                       |
| -------------- | ------ | ----------- | -------------------------------- |
| `megaeth`      | EVM    | mainnet     | `0x78b4...`                     |
| `arctestnet`   | EVM    | testnet     | `0xfcfa...`                     |
| `sepolia`      | EVM    | testnet     | `0xafa9...`                     |
| `solanadevnet` | Solana | testnet     | placeholder — Solana not active |

`chainNamesEvm = ['megaeth', 'arctestnet', 'sepolia']`

Each `Chain` also carries a `brandColor` (hex). It is identity-only — chain
badges, cross-chain rails and chain-scoped stat accents — and never doubles
as a button or text accent, which always stays the app's own `--accent`.

## Contract Addresses (frontend)

Defined in `src/schemas/tokens.ts → contracts`:

```
arctestnet: '0x0bA837eF7358981967FB2cFcB79bf649b7cACbf4'
megaeth:    '0xc38d1681d34DA821E46508C084D673477E455570'
sepolia:    '0x48353Ab7662Bc8218811Fbbdf247cCc8602fba8A'
```

CbGetters addresses in `src/stores/evm.ts → getters` map.

## Supported Tokens

```
USDC: arctestnet=0x3600...., sepolia=0x1c7D...  (6 decimals)
ETH:  megaeth=address(this), sepolia=address(this)  (18 decimals)
SOL:  solanadevnet only  (9 decimals — Solana inactive)
```

Native token = contract address itself (`address(this)`).

## Data rules

- **On-chain only.** Every list, count, status, balance, setting and statistic is read from the Chainbills contracts (`CbGetters` + the main proxy's public mappings) — never Firestore, a relayer API, or an indexer, from the frontend.
- **The one off-chain exception is a payable's description**, read/written through the server (`server.getPayable`/`server.createPayable`). It is optional decoration: a missing or failed fetch never blocks a page from rendering.
- **Chain discovery is on-chain**, not via the server. `payable.resolveChain(id)` (and the equivalent probing in `payment.ts`/`withdrawal.ts`) finds which chain an id lives on by calling that entity's single-entity getter on every EVM chain **in parallel** and taking whichever one succeeds — ids give no other clue which chain they're on (`reference/onchain-data.md` §5.3).
- **Amounts are `bigint` end to end.** `TokenAndAmount.amount` is a `bigint`; conversions go through `parseTokenAmount`/`formatTokenAmount`/`TokenAndAmount.parse`/`.format()` (viem's `parseUnits`/`formatUnits` under the hood) — never `number * 10 ** decimals` or `Number(bigint)` for anything that feeds a comparison or a transaction.
- **Mainnet and testnet data are never mixed** in one list, total or chart (`stores/stats.ts`'s `getNetworkStats` takes an explicit network type and only aggregates that network's chains).
- Reads work **without a connected wallet** — every EVM read goes through a cached, wallet-less viem `PublicClient` per chain (`evm.publicClientFor`).

## Key Store Patterns

See `src/stores/README.md` for the full store-by-store breakdown (public API, which contract calls each function makes). Summary of the cross-cutting patterns:

### Auth flow (`stores/auth.ts`)

1. `useAccount()` (wagmi) or `useAnchorWallet()` (Solana) change triggers `updateCurrentUser`.
2. Fetches on-chain user data via `evm.getCurrentUser()` or `solana.getCurrentUser()`.
3. Requests wallet signature of `"Authentication"` message; saves to localStorage.
4. `currentUser` is `User | null`. All other stores check this before acting — except the public-data reads in `payable.ts`/`payment.ts`/`withdrawal.ts`/`activity.ts`/`stats.ts`, which work with no signed-in user at all.

### EVM store (`stores/evm.ts`)

- All reads go to **CbGetters** (`readGetter`) or the proxy's public mappings (`readMain`) — never require a connected wallet.
- `writeContract()` reports its phases (simulate → wallet prompt → hash received → receipt confirmed) onto the optional `TxStepHandle`s it is given, then does `simulateContract` → `writeContract` → `waitForTransactionReceipt` → 3s settle wait.
- `payForeignViaCctp()`: fetches Circle Iris API for fast-transfer fee before calling the contract.
- Error handling strips the `abi` field from viem errors to avoid console floods.

### Payment routing (`stores/payment.ts → exec()`)

```
userChain == payableChain && isEvm  → evm.pay()              (tx-flow 'pay')
userChain != payableChain && isEvm  → evm.payForeignViaCctp() (tx-flow 'pay-cross-chain')
isSolana                            → solana.pay() / solana.payForeignViaCctp() (no tx-flow this round)
```

### The transaction-flow engine (`stores/tx-flow.ts`)

Every multi-step write (create/close/reopen/update a payable, pay, withdraw)
is modeled as a `TxFlow`: an ordered list of `TxStep`s, each with a
`status` (`upcoming → active/waiting → done`, or `skipped`/`failed`). A
store action calls `txFlow.start(kind, title, steps)`, gets back a
`TxFlowHandle`, and drives each step through `flow.step(key)` — most often
by handing that step handle straight to `evm.writeContract`, which
understands the `sign`/`confirm` phase split itself. `txFlow.current` is
the flow a modal renders; `txFlow.background` lists flows whose write
already succeeded but are still waiting on a relay or a cross-chain sync —
the app shell can surface those separately instead of blocking navigation
on them. A wallet rejection cancels the flow with no error toast.

### Cross-chain pollers (`composables/usePoller.ts`)

Cross-chain payment arrival and payable-sync status are never pushed to
the browser — they are polled. `payment.trackArrival(userPayment)` polls
`consumedPaymentNonces` on the payable's chain until the relayer has
delivered a cross-chain payment, then locates the resulting
`PayablePayment`; it works standalone, so the receipt page can call it
directly for any cross-chain `UserPayment` regardless of whether a
`'pay-cross-chain'` flow is still tracking it. `payable.trackSync(payableId,
homeChain, nonce?)` reports per-chain sync status for a payable's settings.
Both are built on `usePoller`, which pauses while the tab is hidden and
backs off from a 6s to a 20s interval after 3 minutes (see
`reference/onchain-data.md` §5).

### The activity model (`stores/activity.ts`)

Every on-chain `ActivityRecord` becomes an `Activity` (see
`schemas/activity.ts`), with its concrete entity (`Payable`/`UserPayment`/
`PayablePayment`/`Withdrawal`/`User`) resolved by `activity.resolveEntities`.
`getForPayable`/`getForUser`/`getForChain` return one chain's own
newest-first feed; `getForUserAcrossChains`/`getForNetwork` k-way-merge
several chains' feeds into one, via a cursor that survives "load more"
calls with no duplicates. There is no server-side filter on-chain —
`byCategory`/`byTypes`/`loadUntil` filter whatever window has already been
loaded, loading more pages as needed.

### Server store (`stores/server.ts`)

Sends `chain-name`, `wallet-address`, `signature` headers on every call.

- `POST /payable` — upserts a payable's off-chain **description** (host-verified on-chain by the server)
- `GET /payable/:id` — description lookup only, with `ignoreErrors` — **not** used for chain discovery, which is on-chain (see **Data rules**)
- `POST /notifications` — saves FCM token

### Cache (`stores/cache.ts`)

Keys: `{chainName}::payable::{id}::payment::{count}`, etc. Used to avoid re-fetching immutable entities (payments, withdrawals, activity records, chain-discovery results) on navigation. Payables are never cached — their state changes.

## Payment UI Flow (`views/PayView.vue`)

1. Load the payable via `payable.get(id)` — chain discovery is on-chain, not via the server.
2. Check `isClosed`, `allowedTokensAndAmounts`.
3. `payment.exec(...)` routes same-chain vs. cross-chain automatically and drives the matching tx-flow.
4. Success → redirect to `/receipt/:paymentId`. A cross-chain payment's relay/arrival tracking (`payment.trackArrival`) continues in the background; the receipt page also calls it directly on load.

## Environment Variables

```
VITE_SERVER_URL=https://...      Firebase Cloud Function base URL
VITE_WC_PROJECT_ID=...           WalletConnect project ID (for Wagmi/Reown AppKit)
VITE_FIREBASE_*                  Firebase config for Firestore + Analytics + FCM
```

## Dev Commands

```bash
npm run dev           # Vite dev server
npm run build         # type-check + vite build
npm run type-check    # vue-tsc --build
npm run lint          # eslint --fix
npm run format        # prettier --write src/
```

## Design System ("liquid glass")

The full visual spec lives in `frontend/docs/redesign/reference/design-language.md`;
this section is the pointer to where it's implemented in code.

### Tokens (`src/assets/main.css`)

Every colour is a CSS custom property, defined once for light (`:root`) and
once for dark (`html.dark`, toggled by `stores/theme.ts`):

```
--bg, --fg, --muted                 page background / primary text / secondary text
--accent, --accent-fg, --accent-2   brand blue, text-on-accent, secondary glow (teal/violet)
--glass-tint, --glass-border,       glass fill / hairline border / top-highlight gradient
--glass-sheen, --popover-bg         (popover-bg is a heavier, near-opaque fill for menus/dialogs/toasts)
--shadow-glass                      elevation shadow for glass-popover
--success, --warning, --danger, --info   status tones (emerald/amber/rose/sky)
--ease-out-expo, --ease-spring      motion easing curves
```

`--bg`, `--fg`, `--muted`, `--accent`, `--accent-2` and `--accent-fg` each
have a `-rgb` twin (`--fg-rgb: 11 18 32`, …); `tailwind.config.js` maps those
into `rgb(var(--x-rgb) / <alpha-value>)` Tailwind colours (`bg`, `fg`,
`muted`, `accent`, `accent-2`, `accent-fg`) so opacity modifiers work
(`bg-fg/5`, `text-accent/80`). `glass-tint`/`glass-border`/`popover-bg` map to
plain `var()` references instead, since their tokens already carry their own
alpha. Legacy aliases `--app-bg`, `--text`, `--shadow`, `--primary` still
exist (mirroring `--bg`/`--fg`/`--glass-border`/`--accent`) so pages this
redesign hasn't reached yet keep rendering correctly.
`@media (prefers-reduced-transparency: reduce)` swaps `--glass-tint`/`--popover-bg`
for flat opaque colours.

### Glass surfaces

Utility classes in `main.css` (`@layer tailwind-utilities`): `.glass-surface`
(base fill + hairline border) combined with one of `.glass-frost` (default
card blur), `.glass-refract` (focal panels only — adds the `#glass-displace`
SVG filter mounted once in `App.vue`) or `.glass-dense` (tables/long lists).
`.glass-sheen` is the top-highlight overlay, `.glass-popover` is the
menu/dialog/toast fill, `.glass-hover-lift` adds the 2px hover lift for
clickable cards. `GlassCard.vue` wraps the standard structure (surface +
sheen + padded content) so most code never writes these classes directly.

### Typography and motion

Body text is Inter var; headings and big numerals use the display face
(`font-display` → Space Grotesk Variable, via `@fontsource-variable/space-grotesk`).
Fluid sizes `text-display-xl/lg/md` (Tailwind, `tailwind.config.js`). Numerals
that align or update use `tabular-nums`.

`v-reveal` (`src/directives/reveal.ts`, registered globally in `main.ts`) is a
scroll-entrance directive — `v-reveal` or `v-reveal="{ delay: 120 }"` — that
replaces the removed AOS dependency; see its doc comment for the exact
behaviour. Theme switches (`stores/theme.ts`) cross-fade via
`document.startViewTransition` when the browser supports it. Everything
motion-related no-ops under `prefers-reduced-motion: reduce`.

### PrimeVue preset (`main.ts`)

`definePreset(Aura, {...})` restyles the Aura theme: a primitive border-radius
scale (md 12px / lg 16px / xl 24px), the brand-derived primary palette, glass
form fields (translucent fill, hairline border, accent border on focus),
`--popover-bg`-filled overlays (Select/Dialog/Drawer/Menu/Toast), a
transparent DataTable meant to sit inside a `.glass-surface.glass-dense`
wrapper, Tabs restyled as a segmented pill control (`.p-tablist-tab-list`/
`.p-tab` in `main.css` add the padding/radius tokens can't reach), and fully
rounded (`rounded-full`) buttons everywhere.

### UI primitives (`src/components/ui/`)

The full component library — `GlassCard`, `SectionHeader`, `StatTile`,
`ChainBadge`, `NetworkPill`, `TokenAmount`, `AddressChip`, `StatusPill`,
`IconChip`, `FilterChips`, `SegmentedTabs`, `SearchInput`, `EmptyState`,
`ErrorState`, `Skeleton`, `PayableAvatar`, `Stepper`, `InFlightIndicator`,
`KeyValueList`, `QrCode`, `AmbientBackdrop` — is documented component-by-component
in `src/components/ui/README.md`; import from the barrel
(`import { GlassCard, StatTile } from '@/components/ui'`). Every later brief
builds pages from these rather than hand-rolling cards, badges or skeletons.

### Dev component gallery

`/_ui` (`src/views/UiGalleryView.vue`) renders every primitive above in every
state, plus a sample of the restyled PrimeVue components. The route is only
registered when `import.meta.env.DEV` is true (see `router/index.ts`), so
it's absent from production builds — open it locally after touching anything
in `components/ui/` or the PrimeVue preset.

## Important Notes

- Solana store (`stores/solana.ts`) and `solanadevnet` chain exist in code but Solana is **not active** — needs rebuilding. Don't extend Solana functionality.
- `stores/idl.ts` contains Solana Anchor IDL — also stale. Its generated `IDL` constant is cast `as unknown as Chainbills` rather than a direct `as Chainbills`, working around a TypeScript parser issue on a same-newline `as` after this file's very large object literal; the constant's shape is otherwise untouched.
- AOS is fully removed; scroll-entrance animation is the `v-reveal` directive (see "Design System" above).
- PrimeVue toast: `severity: 'error'` for all errors, `life: 12000ms`. Toasts render as a glass popover with an `IconChip` for severity and a countdown bar (custom template in `App.vue`).
- `3000ms` artificial delay after `waitForTransactionReceipt` in `evm.writeContract` — intentional, lets block propagate.
- Cross-chain payment UX: toast says "Funds will arrive after relaying" — user doesn't wait on-page for relay completion.
