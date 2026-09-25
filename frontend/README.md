# Chainbills Frontend

Vue 3 SPA for Chainbills: create payables, make payments, withdraw, and track activity across all supported chains. Talks to EVM contracts via wagmi/viem, and to the Firebase server for payable descriptions only.

## Table of Contents

- [Stack](#stack)
- [Quick start](#quick-start)
- [File structure](#file-structure)
- [Chain support](#chain-support)
- [Contract addresses](#contract-addresses)
- [Supported tokens](#supported-tokens)
- [Environment variables](#environment-variables)
- [Data architecture](#data-architecture)
- [Key store patterns](#key-store-patterns)
- [Payment UI flow](#payment-ui-flow)
- [Design system](#design-system)

## Stack

Vue 3 + Pinia + Vue Router + Wagmi/viem (EVM) + Solana Wallets Vue + PrimeVue + TailwindCSS + vue-gtag (GA4).

## Quick start

```bash
npm install
npm run dev           # Vite dev server
npm run build         # type-check + vite build
npm run type-check    # vue-tsc --build
npm run lint          # eslint --fix
npm run format        # prettier --write src/
```

## File structure

```
src/
  main.ts              App bootstrap: Wagmi config, Pinia, VueGtag (GA4), global directives
  App.vue              Root: AmbientBackdrop, glass refraction filter, Header/Sidebar/Footer, router-view, Toast
  router/index.ts      Routes: /, /start, /dashboard, /activity, /payable/:id, /pay/:id,
                       /receipt/:id, /scan, /scan/address/:address (plus /_ui and /_data in dev only)
  assets/
    main.css           Design tokens (CSS custom properties, light + dark) and glass surface utility classes
  schemas/             Domain types: Activity, Chain, Token, Payable, Payment, UserPayment,
                       PayablePayment, Withdrawal, User, Receipt — re-exported from schemas/index.ts
  composables/
    usePoller.ts       Visibility-aware polling loop; backs off from 6s to 20s after 3 minutes
  directives/
    reveal.ts          v-reveal: scroll-entrance animation directive, registered globally in main.ts
  stores/
    auth.ts            Wallet connect/disconnect, signature, currentUser
    evm.ts             All EVM contract reads + writes (wagmi/viem)
    solana.ts          Solana reads + writes (Anchor) — inactive, do not extend
    payable.ts         Chain discovery, create/get payable, host-control writes
    payment.ts         Execute payment (same-chain/cross-chain routing), trackArrival
    withdrawal.ts      Withdraw, get withdrawals
    activity.ts        Unified activity feeds, entity resolution, cross-chain k-way merge
    scan.ts            Scan paginators, search, address-page lookups
    stats.ts           Chain/network statistics, 30s memoized
    tx-flow.ts         Transaction-flow step engine
    server.ts          Firebase server calls (descriptions only)
    cache.ts           IndexedDB-backed cache for immutable entities
    paginators.ts      Shared rowsPerPage state
    analytics.ts       GA4 event recording via vue-gtag
    encoding.ts        hex/b58/bignum/bytes encode and decode utilities
    idl.ts             Solana Anchor IDL — stale, do not extend
    sidebar.ts         Sidebar open/close state
    theme.ts           Light/dark theme toggle
    time.ts            Timestamp formatting helpers
  views/
    HomeView.vue          Landing page
    CreatePayableView.vue Two-column create form with live preview card; drives the create-payable tx-flow
    DashboardView.vue     Host dashboard: stats row, payable grid, pagination
    UserActivityView.vue  User payment + withdrawal history
    PayableDetailView.vue Public payable detail; host sees balances + controls, non-hosts see description + activity
    PayView.vue           Payment UI: same-chain, cross-chain, mainnet/testnet mismatch, and unsupported routes
    ReceiptView.vue       Payment/withdrawal receipt; cross-chain receipts show a live delivery tracker
    scan/
      ScanView.vue        Scan overview: chain selector, stats, entity tabs, search (/scan)
      ScanAddressView.vue Address detail: per-chain presence cards, merged activity, entity tabs (/scan/address/:address)
    NotFoundView.vue      404 built from EmptyState
    UiGalleryView.vue     Dev-only gallery of every UI primitive (/_ui, import.meta.env.DEV only)
    DataDebugView.vue     Dev-only data-layer self-test + fake tx-flow staging (/_data)
  components/
    activity/    ActivityFeed (smart container), ActivityTable/ActivityList (desktop/mobile), shared row and icon primitives
    ui/          Glass primitive library: GlassCard, SectionHeader, StatTile, ChainBadge, NetworkPill,
                 TokenAmount, AddressChip, StatusPill, IconChip, FilterChips, SegmentedTabs, SearchInput,
                 EmptyState, ErrorState, Skeleton, PayableAvatar, Stepper, InFlightIndicator,
                 KeyValueList, QrCode, AmbientBackdrop — import from the barrel (@/components/ui)
    tx/          TxFlowDialog, TxBackgroundTray, ApprovalGate, CrossChainRoute, WithdrawDialog
    payable/     Hero band, settings card, availability card, balances card, host controls,
                 payment rules editor (PaymentRulesEditor), description editor
    scan/        ScanHeader, ScanStats, ScanEntityTable, entity table wrappers, ScanSearch, ChainBreakdownBar
  icons/         SVG chain and token icon components (IconArc, IconEthereum, IconMegaETH, etc.)
```

## Chain support

| ChainName      | Type   | Network | cbChainId   |
| -------------- | ------ | ------- | ----------- |
| `megaeth`      | EVM    | mainnet | `0x78b4...` |
| `arctestnet`   | EVM    | testnet | `0xfcfa...` |
| `sepolia`      | EVM    | testnet | `0xafa9...` |
| `solanadevnet` | Solana | testnet | inactive    |

`chainNamesEvm = ['megaeth', 'arctestnet', 'sepolia']`

Each chain carries a `brandColor` (hex) used only for chain badges and cross-chain rail accents. It never doubles as a button or text accent color.

## Contract addresses

Defined in `src/schemas/tokens.ts` under `contracts`. CbGetters addresses are in `src/stores/evm.ts`.

```
arctestnet: 0x0bA837eF7358981967FB2cFcB79bf649b7cACbf4
megaeth:    0xc38d1681d34DA821E46508C084D673477E455570
sepolia:    0x48353Ab7662Bc8218811Fbbdf247cCc8602fba8A
```

## Supported tokens

```
USDC: arctestnet = 0x3600..., sepolia = 0x1c7D...  (6 decimals)
ETH:  megaeth = address(this), sepolia = address(this)  (18 decimals)
SOL:  solanadevnet only  (9 decimals, inactive)
```

Native token is represented as the contract's own address (`address(this)`).

## Environment variables

```
VITE_SERVER_URL=https://...      Firebase Cloud Function base URL (descriptions endpoint)
VITE_WC_PROJECT_ID=...           WalletConnect project ID (Wagmi/Reown AppKit)
```

## Data architecture

All lists, counts, statuses, balances, settings, and statistics come from the Chainbills contracts directly. Firestore, the relayer, and external indexers are never read from the frontend.

The one off-chain exception is a payable's description, fetched from the Firebase server via `server.getPayable`. A missing or failed fetch never blocks page rendering.

Chain discovery is fully on-chain. `payable.resolveChain(id)` calls every EVM chain in parallel and takes the first success. There is no central registry mapping entity IDs to chains.

Amounts are `bigint` end-to-end. `TokenAndAmount.amount` is always a `bigint`; conversions go through `parseTokenAmount` / `formatTokenAmount` (viem's `parseUnits` / `formatUnits` under the hood). Never `Number(bigint)` or `amount * 10 ** decimals`.

Reads work without a connected wallet. Every EVM read uses a cached, wallet-less viem `PublicClient` per chain (`evm.publicClientFor`). Only writes require a connected wallet.

Mainnet and testnet data are never mixed in one list, total, or chart. Stats aggregators take an explicit network type.

## Key store patterns

### Auth (`stores/auth.ts`)

Wallet connect triggers `updateCurrentUser`, which fetches on-chain user data via `evm.getCurrentUser()`, then requests a wallet signature of `"Authentication"` and saves it to localStorage. `currentUser` is `User | null`. All other stores check this before performing writes. Public reads (payable pages, receipt pages, scan) work without a signed-in user.

### EVM (`stores/evm.ts`)

All reads go to `CbGetters` (`readGetter`) or the proxy's public mappings (`readMain`). `writeContract()` reports its phases (simulate, wallet prompt, hash received, receipt confirmed) onto the `TxStepHandle`s it is given, then does `simulateContract` -> `writeContract` -> `waitForTransactionReceipt` -> 3s settle wait.

`estimateCctpFee(sourceChainName, destChainName, amount)` reads Circle's Iris API for the fast-transfer max fee with a 20% buffer. `payForeignViaCctp()` calls it before burning; `PayView.vue` calls it directly to show the fee before the payer clicks Pay.

### Payment routing (`stores/payment.ts -> exec()`)

```
userChain == payableChain, EVM  -> evm.pay()               (tx-flow 'pay')
userChain != payableChain, EVM  -> evm.payForeignViaCctp()  (tx-flow 'pay-cross-chain')
Solana                          -> solana.pay() / solana.payForeignViaCctp()  (inactive)
```

### Tx-flow engine (`stores/tx-flow.ts`)

Every multi-step write (create/close/reopen/update a payable, pay, withdraw) is a `TxFlow`: an ordered list of `TxStep`s, each with a status (upcoming -> active/waiting -> done, or skipped/failed). A store action calls `txFlow.start(kind, title, steps)`, gets back a `TxFlowHandle`, and drives each step through `flow.step(key)`.

`txFlow.current` is what `TxFlowDialog` (mounted once in `App.vue`) renders. `txFlow.background` lists flows that succeeded but are still waiting on relay or cross-chain sync. `TxBackgroundTray` (mounted once in `Header.vue`) surfaces those as a pill and raises a toast when one finishes. `txFlow.moveToBackground(id)` lets the dialog's "Continue in background" button hand off without cancelling the flow.

### Activity model (`stores/activity.ts`)

Every on-chain `ActivityRecord` becomes an `Activity` with its concrete entity (`Payable`, `UserPayment`, `PayablePayment`, `Withdrawal`, `User`) resolved by `activity.resolveEntities`. `getForPayable` / `getForUser` / `getForChain` return one chain's newest-first feed. `getForUserAcrossChains` / `getForNetwork` k-way-merge several chains' feeds into one via a cursor that survives "load more" calls without duplicates.

### Scan store (`stores/scan.ts`)

Single-chain paginators use reverse-offset maths for newest-first pages. Network-wide functions k-way-merge each chain's own stream using a `ScanMultiChainCursor`. `search(q, networkType, signal?)` detects the query kind (EVM address, 32-byte ID, chain/token name, free text) and returns a typed `SearchResult`.

### Cache (`stores/cache.ts`)

IndexedDB-backed. Keys: `{chainName}::payable::{id}::payment::{count}` etc. Immutable entities (payments, withdrawals, activity records, chain-discovery results) are cached. Payables are never cached because their state changes.

## Payment UI flow

### Create (`/start`, `views/CreatePayableView.vue`)

Two-column layout: the form (description, payment rules via `SegmentedTabs`, auto-withdraw toggle) on the left, a live preview card on the right. On success, `TxFlowDialog` offers "Open payable" and "Copy payment link"; the form resets so another payable can be created while the first one's sync step continues in the background.

### Pay (`/pay/:id`, `views/PayView.vue`)

1. Load the payable via `payable.get(id)`. Chain discovery is on-chain, not via the server.
2. Classify the pairing into a route: same chain, cross-chain (same network, both EVM, gated on `evm.fetchForeignPayable` having synced with a visible recheck countdown), mainnet/testnet mismatch (shows which chains can pay), or unsupported Solana.
3. `ApprovalGate` renders in the summary whenever the selected token is not the chain's native token.
4. `payment.exec(...)` routes same-chain vs. cross-chain and drives the matching tx-flow.
5. On success: redirect to `/receipt/:paymentId`. A cross-chain payment's relay tracking (`payment.trackArrival`) continues in the background; the receipt page also calls it directly on load.

### Receipt (`/receipt/:id`, `views/ReceiptView.vue`)

A cross-chain `UserPayment` receipt awaits `payment.trackArrival` and renders a two-step mini Stepper ("Burned on source" done, "Delivered to destination" waiting) that flips once delivery is confirmed. A `Withdrawal` receipt shows gross/fee/net; only the net is stored on-chain, so gross and fee are reconstructed from the chain's current withdrawal-fee config and labelled as estimates.

## Design system

The "liquid glass" design language. Full visual spec: `docs/redesign/reference/design-language.md`.

### Tokens (`src/assets/main.css`)

CSS custom properties defined for light (`:root`) and dark (`html.dark`, toggled by `stores/theme.ts`):

```
--bg, --fg, --muted                   page background, primary text, secondary text
--accent, --accent-fg, --accent-2     brand blue, text-on-accent, secondary glow
--glass-tint, --glass-border,         glass fill, hairline border, top-highlight gradient
--glass-sheen, --popover-bg           popover-bg is a heavier near-opaque fill for menus/dialogs/toasts
--shadow-glass                        elevation shadow for glass-popover
--success, --warning, --danger, --info  status tones (emerald/amber/rose/sky)
--ease-out-expo, --ease-spring        motion easing curves
```

Each colour with alpha has a `-rgb` twin. `tailwind.config.js` maps these into Tailwind `rgb(var(--x-rgb) / <alpha-value>)` colours so opacity modifiers work (`bg-fg/5`, `text-accent/80`).

### Glass surfaces

Utility classes in `main.css` (`@layer tailwind-utilities`): `.glass-surface` (base fill + hairline border) combined with one of `.glass-frost` (default card blur), `.glass-refract` (focal panels, adds the `#glass-displace` SVG filter mounted once in `App.vue`), or `.glass-dense` (tables/long lists). `.glass-sheen` is the top-highlight overlay. `GlassCard.vue` wraps the standard structure so most code never writes these classes directly.

### Typography and motion

Body text: Inter var. Headings and big numerals: Space Grotesk Variable (`font-display`). Fluid sizes `text-display-xl/lg/md` via Tailwind.

`v-reveal` is a scroll-entrance directive that replaces the removed AOS dependency. Theme switches cross-fade via `document.startViewTransition` when the browser supports it. Both no-op under `prefers-reduced-motion: reduce`.

### PrimeVue preset (`main.ts`)

`definePreset(Aura, {...})` restyles the Aura theme: border-radius scale (md 12px / lg 16px / xl 24px), brand-derived primary palette, glass form fields, `--popover-bg`-filled overlays (Select/Dialog/Drawer/Menu/Toast), a transparent DataTable for `.glass-dense` wrappers, Tabs restyled as segmented pill controls, and fully-rounded buttons.

### Dev gallery

`/_ui` (`src/views/UiGalleryView.vue`, dev-only) renders every primitive above in every state plus a sample of restyled PrimeVue components. The route is only registered when `import.meta.env.DEV` is true. Open it after touching anything in `components/ui/` or the PrimeVue preset.
