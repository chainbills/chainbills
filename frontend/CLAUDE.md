# Chainbills Frontend — CLAUDE.md

## Overview

Vue 3 SPA. Stack: Vue 3 + Pinia + Vue Router + Wagmi/viem (EVM) + Solana Wallets Vue + PrimeVue + TailwindCSS + Firebase. Talks to: EVM contracts (via wagmi/viem), Solana program (via Anchor), Firebase server, Firestore.

## File Map

```
src/
  main.ts              App bootstrap: Wagmi config, PrimeVue, Pinia, Firebase init
  App.vue              Root: ToastService, ConfirmDialog, router-view
  router/index.ts      Routes: /, /start, /dashboard, /activity, /payable/:id, /pay/:id, /receipt/:id
  schemas/
    chain.ts           Chain type, ChainName, chain constants (megaeth/arctestnet/sepolia/solanadevnet)
    tokens.ts          Token type, tokens array (USDC/ETH/SOL), TokenAndAmount class, contracts map
    payable.ts         Payable class
    payment.ts         Payment interface
    user-payment.ts    UserPayment class
    payable-payment.ts PayablePayment class
    withdrawal.ts      Withdrawal class
    user.ts            User class
    receipt.ts         Receipt helpers
    index.ts           Re-exports all schemas
  stores/
    auth.ts            useAuthStore — wallet connect/disconnect, signature, currentUser
    evm.ts             useEvmStore — all EVM contract reads + writes (wagmi/viem)
    solana.ts          useSolanaStore — Solana reads + writes (Anchor)
    payable.ts         usePayableStore — create/get payable, paginated IDs
    payment.ts         usePaymentStore — exec payment (routes same/cross-chain), get payments
    withdrawal.ts      useWithdrawalStore — withdraw, get withdrawals
    server.ts          useServerStore — calls Firebase server (descriptions, notifications)
    cache.ts           useCacheStore — in-memory cache with localStorage backing
    paginators.ts      usePaginatorsStore — shared rowsPerPage state
    abis.ts            mainAbi (Chainbills proxy) + gettersAbi (CbGetters) + erc20Abi
    analytics.ts       useAnalyticsStore — Firebase Analytics event recording
    notifications.ts   usePaginatorsStore — FCM notification token setup
    encoding.ts        hex/b58 encode/decode utilities
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
    NotFoundView.vue       404
  components/
    Header.vue, Footer.vue, Sidebar.vue
    PayableInfoCard.vue
    TransactionsTable.vue
    MakePaymentLoader.vue, PayableDetailLoader.vue, ReceiptLoader.vue, TableLoader.vue
    Shimmer.vue
    SignInButton.vue
    ThemeMenu.vue
  icons/                   SVG icon components (IconArc, IconEthereum, IconMegaETH, etc.)
```

## Chain Support

| ChainName | Type | networkType | cbChainId |
|-----------|------|-------------|-----------|
| `megaeth` | EVM | mainnet | `0x78b4...` |
| `arctestnet` | EVM | testnet | `0xfcfa...` |
| `sepolia` | EVM | testnet | `0xafa9...` |
| `solanadevnet` | Solana | testnet | placeholder — Solana not active |

`chainNamesEvm = ['megaeth', 'arctestnet', 'sepolia']`

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

## Key Store Patterns

### Auth flow (`stores/auth.ts`)
1. `useAccount()` (wagmi) or `useAnchorWallet()` (Solana) change triggers `updateCurrentUser`.
2. Fetches on-chain user data via `evm.getCurrentUser()` or `solana.getCurrentUser()`.
3. Requests wallet signature of `"Authentication"` message; saves to localStorage.
4. `currentUser` is `User | null`. All other stores check this before acting.

### EVM store (`stores/evm.ts`)
- All reads go to **CbGetters** contract (not the main proxy).
- `writeContract()` = simulateContract → writeContract → waitForTransactionReceipt → 3s wait.
- `readContract()` = rawReadContract via wagmi.
- `payForeignViaCctp()`: fetches Circle Iris API for fast-transfer fee before calling contract.
- Error handling strips `abi` field from viem errors to avoid console floods.

### Payment routing (`stores/payment.ts → exec()`)
```
userChain == payableChain && isEvm  → evm.pay()
userChain != payableChain && isEvm  → evm.payForeignViaCctp()
isSolana                            → solana.pay()
```

### Server store (`stores/server.ts`)
Sends `chain-name`, `wallet-address`, `signature` headers on every call.
- `POST /payable` — upserts description after on-chain creation
- `GET /payable/:id` — chain discovery (returns `{ chainName, description }`)
- `POST /notifications` — saves FCM token

### Cache (`stores/cache.ts`)
Keys: `{chainName}::payable::{id}::payment::{count}`, etc. Used to avoid re-fetching on navigation.

## Payment UI Flow (`views/PayView.vue`)

1. Load payable via `server.getPayable(id)` → get chainName.
2. Fetch on-chain payable data → check `isClosed`, allowedTokensAndAmounts.
3. If same-chain: `evm.pay()`. If cross-chain EVM: `evm.payForeignViaCctp()`.
4. Success → redirect to `/receipt/:paymentId`.

## Environment Variables

```
VITE_SERVER_URL=https://...      Firebase Cloud Function base URL
VITE_REOWN_PROJECT_ID=...        WalletConnect project ID (for Wagmi/Reown AppKit)
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

## Important Notes

- Solana store (`stores/solana.ts`) and `solanadevnet` chain exist in code but Solana is **not active** — needs rebuilding. Don't extend Solana functionality.
- `stores/idl.ts` contains Solana Anchor IDL — also stale.
- PrimeVue toast: `severity: 'error'` for all errors, `life: 12000ms`.
- `3000ms` artificial delay after `waitForTransactionReceipt` in `evm.writeContract` — intentional, lets block propagate.
- Cross-chain payment UX: toast says "Funds will arrive after relaying" — user doesn't wait on-page for relay completion.
