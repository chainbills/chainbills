# Brief 03 — Transaction Progress UI, Create, Pay (Cross-Chain), Receipt, Withdraw, Dashboard

**Wave:** 2 (runs in parallel with 02 and 06) · **Depends on:** 00 and 01 merged

## Read first

1. `frontend/docs/redesign/README.md` — the global rules.
2. `frontend/docs/redesign/reference/design-language.md` — §7.5 Progress, §7.6 Overlays, §9 Voice.
3. `frontend/docs/redesign/reference/onchain-data.md` — §4 and §5.
4. `src/stores/README.md`, `src/stores/tx-flow.ts`, `src/composables/usePoller.ts`, `src/components/ui/README.md`.
5. The current views: `CreatePayableView.vue`, `PayView.vue`, `ReceiptView.vue`, `DashboardView.vue`, `PayableInfoCard.vue`, and the loaders (`MakePaymentLoader.vue`, `ReceiptLoader.vue`).

## Goal

Every write in the app shows a clear, named, step-by-step progress experience. The cross-chain payment experience in particular becomes transparent from the first click until the funds land on the destination chain. This brief also rebuilds the pages where those writes start.

## 1. Transaction progress UI (`src/components/tx/`)

### `TxFlowDialog.vue`

Renders `useTxFlowStore().current`. Mount it once in `App.vue` (a single additive line).

- **Layout:** a glass dialog, shown as a bottom sheet on mobile.
- **Header:** the flow title and subtitle, for example "Pay 25 USDC · Sepolia → Arc Testnet".
- **Body:** the vertical `Stepper` bound to the flow steps. Each step shows:
  - its title and description,
  - an in-flight indicator while it is active or waiting,
  - rotating `hints`,
  - a tx hash `AddressChip` and explorer link once one exists,
  - the chain badge.
- **Footer by state:**
  - **running:** "Keep this window open", or, when the current step is `waiting` and `canRunInBackground`, a "Continue in background" button;
  - **succeeded:** a success header, a summary card, and primary actions (for example "View receipt" or "Open payable") plus "Close";
  - **failed:** the error in plain language, "Try again" (restarts the flow) and "Close";
  - **cancelled:** "You cancelled in your wallet." plus a "Try again" button.
- **Closing:** the dialog cannot be dismissed by clicking the backdrop while a signature is pending.

### `TxBackgroundTray.vue`

A small header indicator (a pill with a ping dot and a count) listing flows that are still waiting in the background, such as relay and sync. Clicking an entry reopens its dialog.

- Mount it in `Header.vue`. This is one small additive change.
- Succeeded background flows raise a toast with an action link.

### `ApprovalGate.vue`

An explainer row shown **before** any ERC-20 approval step. It states:

- the token and exact amount (including the CCTP fee buffer on cross-chain payments),
- the spender (the Chainbills contract, as an `AddressChip`),
- why the approval is needed,
- that approval and payment are two separate wallet prompts.

### `CrossChainRoute.vue`

A visual strip: source `ChainBadge` → an animated rail with a travelling packet → destination `ChainBadge`. Underneath it shows:

- the bridge ("Circle CCTP"),
- the estimated time ("usually 1–3 min"),
- the fees (CCTP fast-transfer max fee in USDC, Wormhole message fee in the native token).

It is reused by the pay page, the receipt page and the landing page.

### `README.md`

Documents the flow → UI mapping, with screenshots or descriptions of each state.

## 2. Create Payable (`CreatePayableView.vue`, `/start`)

A two-column glass layout: the form on the left and a **live preview card** on the right showing how the payable page will look.

- **Description:** a textarea with a character counter (3–3000). It explains that the description is stored off-chain and is editable later.
- **Payment rules:** a `SegmentedTabs` with two options:
  - "Any token, any amount";
  - "Specific tokens and amounts". This shows repeatable rows: token `Select` with logos, amount input, remove button, "Add option". It validates duplicates and non-zero amounts using bigint parsing.
- **Auto-withdraw:** a toggle with an explanation. Funds go straight to the host wallet on every payment, minus the 2% fee.
- **Home chain:** the connected chain badge, with an explanation that the payable is synced to the other chains of the same network. Show which chains, using `payable.availability` logic for a hypothetical payable (same network, messaging available).
- **Submit:** starts the `create-payable` flow. On success the dialog offers "Open payable" (`/payable/:id`) and "Copy payment link". The `sync` step continues in the background.
- **Not connected:** show the form disabled, with a connect CTA overlay.

## 3. Pay (`PayView.vue`, `/pay/:id`)

A glass, focal layout.

**Left column: payable summary**
- `PayableAvatar` and short id;
- home `ChainBadge`;
- status pill (Open / Closed);
- description;
- accepted payment rules as `TokenAmount` chips, or "Any amount";
- host `AddressChip`;
- link "View payable" → `/payable/:id`.

**Right column: the pay widget** (`glass-refract`)

- **Rules picker:**
  - one option: shown large;
  - several options: selectable cards;
  - "any amount": amount input + token select with balances.
  - Balances show next to each option for the connected wallet.
- **Route panel:**
  - **Same chain:** "Direct payment on {chain}".
  - **Cross-chain (same network, both EVM):** `CrossChainRoute` with fees, plus an availability check. If the payable is not yet synced to the payer's chain, show the `available` step inline as a waiting state with hints and an auto-refresh countdown (uses `usePoller`). Do not show an indefinite spinner.
  - **Network mismatch** (mainnet vs testnet): an explanation plus a list of the chains that can pay this payable (`payable.availability`), each with a switch-chain action.
  - **Unsupported pairing** (Solana): "Coming soon" with a switch-chain action.
- **Summary:** "You pay" amount, fees, "Payable receives", and an estimated arrival time.
- **Primary button:** "Pay 25 USDC" (same chain) or "Pay 25 USDC via CCTP" (cross-chain). It starts the `pay` or `pay-cross-chain` flow.
- **After confirmation:** the dialog offers "View receipt". The cross-chain `relay` step can continue in the background, and the receipt page shows the same live status.
- **Closed payable:** a disabled state with the reason.

## 4. Receipt (`ReceiptView.vue`, `/receipt/:id`)

- A glass receipt card:
  - type (Payment made / Payment received / Withdrawal);
  - amount (`TokenAmount`, large);
  - status pill;
  - `KeyValueList` of every on-chain field;
  - payer or host `AddressChip`;
  - payable link;
  - chain badges;
  - timestamp.
- "Copy receipt link" and "Share" (Web Share API where available).
- **Cross-chain UserPayment:** a **live delivery tracker**. It shows `CrossChainRoute` plus a two-step mini stepper: "Burned on {source}" (done) → "Delivered to {destination}" (waiting). It uses `payment.trackArrival` via `usePoller`. When the payment is delivered, it shows the destination payable-payment id linked to its own receipt.
- **Cross-chain PayablePayment:** shows its origin (payer chain and `payerPaymentId`, linked).
- **Withdrawal:** shows gross, fee and net amounts.

## 5. Withdraw dialog

- Extract it as `src/components/tx/WithdrawDialog.vue`. Brief 04 embeds it on the payable page, and the current `PayableDetailView` uses it in the meantime; that swap is a minimal edit.
- Contents: token balance, amount input with Max, bigint validation, and a live breakdown: amount, fee (bps from chain config, capped by `maxWithdrawalFees`), "You receive".
- It starts the `withdraw` flow.

## 6. Dashboard (`DashboardView.vue`, `/dashboard`) and `PayableInfoCard.vue`

- **Header:** "Your payables", a "Create payable" primary button, and the connected chain badge.
- **Stats row:** payables count, total payments received (sum of `paymentsCount`), withdrawals.
- **Grid of `PayableInfoCard`s** redesigned as glass cards. Each card shows:
  - avatar and short id;
  - status pill;
  - rules summary (for example "Any amount" or "3 options");
  - auto-withdraw badge if it is on;
  - balances as `TokenAmount`s;
  - payments count;
  - created time;
  - quick actions: copy link, open.
- Skeleton cards while loading. An empty state with a create CTA.

## 7. Documentation

Follow README §3.1–3.2. Add `src/components/tx/README.md` and update `frontend/CLAUDE.md`, covering the payment UI flow, the create flow and the receipt tracker.

## Acceptance criteria

- [ ] Every flow from brief 01 §5 renders step by step, with specific titles, descriptions and hints, and transaction links as they appear.
- [ ] Wallet rejection results in a calm cancelled state. Failures show a readable error and a retry.
- [ ] A cross-chain payment shows its route, fees and availability before the user pays. While it runs, it shows live relay progress, the flow can continue in the background, and the receipt tracks delivery using on-chain polling only.
- [ ] The approval gate appears whenever an approval is needed, and the step is skipped when the existing allowance is enough.
- [ ] The Create, Pay, Receipt and Dashboard pages and the Withdraw dialog are rebuilt with the primitives, responsive, and correct in both themes.
- [ ] Documentation is complete. Type-check and build pass. Screenshots are attached: each page, plus the flow dialog in its active, waiting, succeeded, failed and cancelled states (use the `/_data` fake flow to stage these).
