# Chainbills — Planned Features

Two upcoming product features: **Host Subscriptions** and **Embeddable Payment Components**. This document covers architecture, data flow, and implementation scope for each.

---

## Table of Contents

- [Host Subscriptions](#host-subscriptions)
  - [Approach: Pre-funded Vault](#approach-pre-funded-vault)
  - [Data Structure](#data-structure)
  - [Contract Methods](#contract-methods)
  - [Relayer Changes](#relayer-changes-subscriptions)
- [Embeddable Payment Components](#embeddable-payment-components)
  - [The Wallet Problem](#the-wallet-problem)
  - [Full Flow](#full-flow)
  - [Stack Impact](#stack-impact)
  - [Host Integration API](#host-integration-api)
  - [Cross-Chain UX in Popup](#cross-chain-ux-in-popup)
  - [Build Order](#build-order)

---

## Host Subscriptions

Hosts create payables that charge subscribers on a recurring basis. Crypto wallets have no native pull mechanism — wallets cannot be debited without user action. Subscriptions solve this with a **pre-funded vault**.

### Approach: Pre-funded Vault

Subscriber calls `createSubscription(payableId, token, amount, interval)`. Funds go into a per-subscription vault PDA (Solana) or escrow mapping (EVM). The relayer watches for subscriptions where `nextDue <= now` and calls `chargeSubscription(subscriptionId)`. The contract drains from the vault into the payable's balance — identical execution path to a normal `pay()`. Same `UserPayment` + `PayablePayment` records are created. Same 2% fee on withdrawal applies.

Subscriber can top up the vault at any time. If the vault balance is insufficient at charge time, the charge skips and the subscription goes inactive.

No new trust surface. The contract only spends from the vault the subscriber explicitly funded.

### Data Structure

```
Subscription:
  subscriber          wallet      Address of the subscribing user
  payableId           bytes32     Target payable
  token               token       Token being charged
  amount              number      Amount per period
  interval            number      Period length in seconds (e.g. 2592000 = 30 days)
  vaultBalance        number      Pre-funded balance available for future charges
  nextDue             number      Unix timestamp of next scheduled charge
  isActive            bool        False if vault ran dry or subscriber cancelled
  paymentsCount       number      Total number of successful charges
  createdAt           number      Timestamp of subscription creation
```

### Contract Methods

| Method                    | Caller       | Description                                                                 |
| ------------------------- | ------------ | --------------------------------------------------------------------------- |
| `createSubscription`      | subscriber   | Creates subscription, makes first payment, sets `nextDue = now + interval` |
| `cancelSubscription`      | subscriber   | Sets `isActive = false`, returns remaining vault balance to subscriber      |
| `topUpSubscription`       | subscriber   | Adds funds to vault balance                                                 |
| `chargeSubscription`      | relayer      | Pulls `amount` from vault, executes `pay()` internally, updates `nextDue`  |

New events emitted: `SubscriptionCreated`, `SubscriptionCharged`, `SubscriptionCancelled`, `SubscriptionDrained` (vault empty).

### Relayer Changes (Subscriptions)

New watcher queries subscriptions where `nextDue <= now && isActive == true`. Creates a new job type:

| Job Type             | Trigger                          | Action                                              |
| -------------------- | -------------------------------- | --------------------------------------------------- |
| `CHARGE_SUBSCRIPTION` | `nextDue <= now` for active sub | `chargeSubscription(subId)` on the subscription's chain |

Firestore paths added:

```
/subscriptions/{subscriptionId}    — indexed subscription record
```

No changes to the existing payment indexing pipeline — `chargeSubscription` emits the same `UserPaid` + `PayableReceived` events as a manual payment.

---

## Embeddable Payment Components

Hosts embed a Chainbills payment widget on their own website. Payers pay without leaving the host site.

### The Wallet Problem

Injected wallets (MetaMask, Phantom, Rainbow) attach to `window.ethereum` / `window.solana` on the **top-level page only** — browsers block injection into `<iframe>` by design. WalletConnect works anywhere via QR/deeplink.

Consequence: an iFrame-only embed limits payers to WalletConnect. A **popup window** on the `chainbills.app` domain is first-party context — all wallets inject normally.

**Architecture: JS widget that opens a popup.**

### Full Flow

```
Host website                       Chainbills popup (/pay-embed/:id)       Chain + Relayer
     │                                        │
     │  <script src="chainbills.app/embed.js">│
     │  <cb-pay payable="0xabc">              │
     │                                        │
     │  [payer clicks Pay button]             │
     │  window.open("/pay-embed/0xabc") ─────>│
     │                                        │  wallet.connect()
     │                                        │  user picks token + amount
     │                                        │  evm.pay() / payForeignViaCctp()
     │                                        │──────────────────────────────> on-chain tx
     │                                        │<── txHash ──────────────────
     │                                        │
     │<── postMessage({                       │  (popup shows inline receipt)
     │     status: 'success',                 │
     │     paymentId: '0xdef...',             │
     │     txHash: '0x...',                   │
     │     amount: '10',                      │
     │     token: 'USDC'                      │
     │    }) ─────────────────────────────────│
     │                                        │
     │  [on-success callback fires]           │
     │                                        │
                                              │  (relayer running independently)
                                              │  UserPaid event detected
                                              │  indexUserPayment() → Firestore
                                              │  if cross-chain: relay job created
                                              │     → receiveForeignPaymentViaCctp()
                                              │  PayableReceived indexed
                                              │  FCM push → host's registered device
```

### Stack Impact

| Layer        | Changes Required                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| **Contracts**  | None. Payment path identical. Same `UserPaid` + `PayableReceived` events.                               |
| **Relayer**    | None. Already watches events. Indexes same records. Sends same FCM push.                                |
| **Firestore**  | None. Same document paths and merge strategy. Optional: add `source: 'embed'` field to `userPayments` for analytics (set by popup frontend via server endpoint post-payment). |
| **Server**     | None structural. Firebase Functions already allow cross-origin. Optionally add `POST /payment/tag` to write the `source` field. |
| **Frontend**   | Two additions (see below).                                                                              |

**Frontend addition 1 — `/pay-embed/:payableId` route:**

- Same logic as `PayView.vue`, reusing `usePaymentStore`, `useAuthStore`, etc.
- Router wraps it in a layout-less shell (no `<Header>`, `<Footer>`, `<Sidebar>`).
- Accepts query params: `?theme=light|dark|auto&primaryColor=%236366f1` for customization.
- On payment success: calls `window.opener?.postMessage({status:'success', ...}, 'https://chainbills.app')` then shows inline receipt. Does not close the popup — user closes manually.
- If `window.opener` is null (direct URL navigation), behaves as normal `PayView`.

**Frontend addition 2 — `public/embed.js`:**

- ~150 lines of vanilla JS, no framework dependency.
- Registers `<chainbills-pay>` as a custom element (Web Component).
- Renders a styled Pay button in shadow DOM.
- On click: `window.open('/pay-embed/{payableId}?...', '_blank', 'popup,width=480,height=700')`.
- Adds `window.addEventListener('message', handler)` — validates `event.origin === 'https://chainbills.app'` before acting.
- Dispatches a `cb-success` or `cb-error` custom DOM event on the `<chainbills-pay>` element for host JS to consume.

### Host Integration API

```html
<!-- Drop anywhere on a page -->
<script src="https://chainbills.app/embed.js"></script>

<chainbills-pay
  payable-id="0xabc123..."
  label="Buy Now"
  theme="auto"
  primary-color="#6366f1"
></chainbills-pay>

<script>
  document.querySelector('chainbills-pay').addEventListener('cb-success', (e) => {
    console.log('paid!', e.detail.paymentId, e.detail.amount, e.detail.token);
    unlockContent();
  });
  document.querySelector('chainbills-pay').addEventListener('cb-error', (e) => {
    console.error('payment failed', e.detail.message);
  });
</script>
```

**Supported attributes on `<chainbills-pay>`:**

| Attribute       | Default    | Description                                         |
| --------------- | ---------- | --------------------------------------------------- |
| `payable-id`    | (required) | The target payable ID (hex or base58)               |
| `label`         | `Pay Now`  | Button label text                                   |
| `theme`         | `auto`     | `light`, `dark`, or `auto` (matches host page)      |
| `primary-color` | `#6366f1`  | Accent color for button and highlights              |

**postMessage payload (popup → parent):**

```ts
{
  status: 'success' | 'error';
  paymentId?: string;   // UserPayment ID on payer's chain
  txHash?: string;
  amount?: string;
  token?: string;
  message?: string;     // populated on error
}
```

### Cross-Chain UX in Popup

`PayView`'s existing "relayer is bridging..." progress bar and 15s polling loop work unchanged inside the popup window. No modifications needed. User waits in the popup if cross-chain, same as on the main site.

### Build Order

1. New `/pay-embed/:payableId` route with layout-less shell — reuses ~90% of `PayView.vue`
2. `postMessage` emission on success + inline receipt (no redirect)
3. `public/embed.js` — custom element, popup launcher, message listener
4. (Optional) Server `POST /payment/tag` endpoint to write `source: 'embed'` to Firestore for analytics

Estimated new code: ~300 lines frontend. Zero contract, relayer, or Firestore schema changes.
