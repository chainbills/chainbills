# Brief 04: Public Payable Page with Host Controls

**Wave:** 3 (runs in parallel with 05) · **Depends on:** 00, 01, 02, 03 merged

## Read first

1. `frontend/docs/redesign/README.md`, for the global rules.
2. `frontend/docs/redesign/reference/design-language.md`.
3. `frontend/docs/redesign/reference/onchain-data.md`, sections §4 (host writes) and §5.2 (sync).
4. The READMEs in `src/components/{ui,activity,tx}/` and `src/stores/`.
5. The current `src/views/PayableDetailView.vue` and `src/components/PayableDetailLoader.vue`.

## Goal

Rebuild `/payable/:id` as a **public** page.

- **Everyone** sees the payable's identity, status, configuration, description, cross-chain availability, counts and full on-chain activity.
- **The host** also sees balances, withdrawals and every host control.
- The page works without a connected wallet.

## Layout

Desktop is two columns: main content on the left (about 2/3), a sticky side rail on the right (about 1/3). Mobile stacks everything in the order listed below.

### Hero band (full width, `GlassCard variant="refract"`)

- `PayableAvatar`, the short id with a copy button, and the full id on expand.
- Home `ChainBadge` and `NetworkPill`.
- `StatusPill`: Open (success, pulsing) or Closed (danger).
- If `isAutoWithdraw` is set, an "Auto-withdraw" badge.
- Host `AddressChip`, linking to `/scan/address/:host`.
- Created date (absolute, with relative time on hover).
- Actions:
  - Primary: "Pay this payable" → `/pay/:id`. Hidden for the host; disabled with a reason when the payable is closed.
  - Secondary: "Copy link", "Share", "Show QR" (a `QrCode` dialog).
  - Host only: "Manage" (scrolls to host controls).

### Side rail

**Settings card**, titled "How this payable accepts payments":

- **Any token, any amount:** a short explanation, plus the list of tokens supported on the home chain (tokens in `schemas/tokens.ts` with details on that chain).
- **Specific options:** a list of `TokenAmount` rows ("Pay exactly 25 USDC", "or 0.01 ETH").
- **Auto-withdraw:** On or Off, with a one-line explanation.
- **Withdrawal fee:** the chain's fee percentage (from `getConfig`).

**Cross-chain availability card:** every EVM chain in the same network with a status, taken from `payable.availability` / `payable.trackSync`:

- "Home chain"
- "Synced · accepts USDC via CCTP"
- "Sync pending" (with an in-flight indicator and polling)
- "Not available: reason"

Mainnet and testnet are never mixed here.

**Numbers card:** `StatTile`s for payments received, withdrawals and activities (on-chain counts).

### Main column

**Description card:**
- The description rendered with line breaks preserved (sanitised).
- An empty description shows a muted placeholder.
- The host sees an "Edit" button (see host controls).

**Balances card (host only):**
- Every balance (from `getBalsDisplay`) as a large `TokenAmount`, each with a "Withdraw" button that opens `WithdrawDialog`.
- An empty state that explains how to get paid, with a copy-link action.
- Non-hosts do not see this card.

**Activity:**
- `ActivityFeed` with `source: { kind: 'payable', payable }`, the toolbar enabled, and the tabs `All · Payments · Withdrawals · Settings`.
- `persistKey` is set per payable.
- The Actor column shows payers.

### Host controls (host only)

A "Manage payable" `GlassCard` section. Each control runs its brief 01 flow through `TxFlowDialog`. If the host is connected on a different chain than the payable's, each control is disabled and shows "Switch to {chain} to manage this payable" with a switch action.

| Control | UI | Flow |
| --- | --- | --- |
| Close / Reopen | A danger "Close payable" button that asks for confirmation. The dialog explains that payers everywhere will be blocked once the close syncs. "Reopen payable" is a success button. | `close-payable` / `reopen-payable` (with per-chain sync steps) |
| Accepted tokens & amounts | An "Edit payment rules" dialog reusing the rule editor from Create Payable. Extract that editor into `src/components/payable/PaymentRulesEditor.vue` and use it in both places (a minimal edit in `CreatePayableView`). Shows a diff preview: current vs new. | `update-payable-tokens` |
| Auto-withdraw | A `ToggleSwitch` with a confirmation dialog that explains the effect and that the setting stays on the home chain. | `update-payable-auto-withdraw` |
| Description | An inline editor (textarea with a 3–3000 counter), with Save and Cancel. | `update-payable-description` |

After each flow succeeds, refresh the payable and prepend the new activity row. The settings card updates straight away.

### Visitor-specific touches

- If the connected wallet has paid this payable, show a "You've paid this payable N times" note linking to the activity feed filtered to their address.
- A visitor who is not connected sees everything; only the pay CTA leads to a wallet connection.

### States

- **Loading:** a skeleton that mirrors the layout. Rebuild `PayableDetailLoader.vue` with `Skeleton`.
- **Not found:** `EmptyState` with the text "No payable with this id exists on any supported chain." and a search input that routes to `/scan?q=`.
- **Description failed to load:** the page still renders, and the description card shows a muted placeholder.

## Components (`src/components/payable/`)

Create these components:

- `PayableHero.vue`
- `PayableSettingsCard.vue`
- `PayableAvailabilityCard.vue`
- `PayableBalancesCard.vue`
- `PayableHostControls.vue`
- `PaymentRulesEditor.vue`
- `DescriptionEditor.vue`
- `README.md`

## Routing

Keep `/payable/:id`. Remove the host-only guard, which the "Unauthorized" block currently enforces. `/pay/:id` stays the payment page. The dashboard links here unchanged.

## Documentation

Follow README §3.1–3.2. Add `src/components/payable/README.md` and update `frontend/CLAUDE.md` (routes, public vs host behaviour).

## Acceptance criteria

- [ ] The page is public and works without a wallet. The host sees balances, withdraw and controls; non-hosts do not.
- [ ] The settings, availability and numbers cards show correct on-chain data. Mainnet and testnet are never mixed.
- [ ] Close, reopen, edit rules, auto-withdraw and description each work end to end through `TxFlowDialog`, including the wrong-chain prompt.
- [ ] `PaymentRulesEditor` is shared with Create Payable.
- [ ] The activity feed shows the All, Payments, Withdrawals and Settings tabs.
- [ ] Loading, not-found and missing-description states are handled. The page is responsive and themed.
- [ ] Documentation is complete. Type-check and build pass.
