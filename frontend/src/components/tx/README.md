# `src/components/tx/`

The transaction-progress UI: the pieces that turn a `stores/tx-flow.ts`
`TxFlow` into what the user actually sees while a write is in flight, plus
the widgets that surround a write (the approval explainer, the cross-chain
route strip, the withdraw dialog).

## Files

| File                  | Purpose                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `TxFlowDialog.vue`     | The one modal for every flow. Mounted once, in `App.vue`. Renders `useTxFlowStore().current`.                       |
| `TxBackgroundTray.vue` | Header pill listing flows moved to the background (a relay, a payable sync). Mounted once, in `Header.vue`.          |
| `ApprovalGate.vue`     | Explainer row on the pay page: which token/amount is about to be approved, the spender, and why.                    |
| `CrossChainRoute.vue`  | Source chain → animated rail → destination chain, plus the bridge, ETA and fees. Reused by pay, receipt and landing. |
| `WithdrawDialog.vue`   | The host's withdraw dialog: balance, amount + Max, fee breakdown, drives the `'withdraw'` flow.                      |
| `retry.ts`             | A tiny session-scoped "retry the last flow" handle `TxFlowDialog`'s "Try again" button calls into.                   |
| `flow-actions.ts`      | Maps a succeeded flow's `kind`/`result` to its "next step" actions ("View receipt", "Open payable", …).              |

## Flow → UI mapping

Every multi-step write in the app (see `stores/tx-flow.ts` and its
`TxFlowKind`s) goes through the same dialog. A store action calls
`txFlow.start(kind, title, steps)`, which makes the new flow `current`;
`TxFlowDialog` picks that up reactively — nothing views call has to open
the dialog itself.

```
useTxFlowStore().current  →  TxFlowDialog
  header:  flow.title / flow.subtitle
  body:    <Stepper :steps="flow.steps"> (ui/Stepper.vue — status, hints, in-flight dots)
             meta slot: ChainBadge (step.chain) + AddressChip (step.txHash) + explorer link (step.explorerUrl)
  footer:  flow.status-dependent (see below)
```

### Dialog states

| `flow.status` | What's shown |
| --- | --- |
| `running` | Stepper mid-flight. Footer: "Keep this window open.", or a **Continue in background** button once the active step is `waiting` and `flow.canRunInBackground` (a cross-chain relay, a payable sync). |
| `succeeded` | A success banner, then a small summary (the ids the flow produced, a link to the last transaction), then kind-specific actions (`flow-actions.ts`) — "View receipt", "Open payable", "Copy payment link" — plus "Close". |
| `failed` | The failed step's `error` message in a danger banner, plus "Try again" and "Close". |
| `cancelled` | "You cancelled in your wallet.", plus "Try again". No error banner — a wallet rejection is not a failure. |

The dialog refuses to close on a backdrop click or Escape while any step is
`waiting` (blocked on a wallet prompt), so an in-flight signature request is
never silently dropped. "Try again" calls whatever `useTxRetry().setRetry`
last registered — every view that starts a retryable flow
(`CreatePayableView`, `PayView`, `WithdrawDialog`) registers its own submit
handler right before calling the store action.

### Background flows

A flow with `canRunInBackground` (currently `'create-payable'` and
`'pay-cross-chain'`, whose `sync`/`relay` tail can take minutes) can be
moved out of the dialog while it keeps running. `TxBackgroundTray` lists
those flows as a small pill in the header; clicking one calls
`txFlow.bringToForeground(id)`, which reopens `TxFlowDialog` for it. Once a
backgrounded flow finishes on its own, the tray raises a toast with a link
to what it produced instead of waiting for the user to check back.

### The approval gate

Unlike the rest of this folder, `ApprovalGate.vue` is not driven by the
flow itself — the flow's `TxStep` has no room to carry a token/amount/
spender, only display strings. Instead, `PayView.vue` renders it directly
in the payment summary, before the "Pay" button, whenever the selected
token is not the chain's native token (i.e. whenever an ERC-20 `approve`
could be needed). It states the exact amount, the spender, and that
approval and payment are two separate wallet prompts — so neither prompt
surprises the payer, regardless of whether `evm.pay`/`evm.payForeignViaCctp`
end up skipping the approval because the existing allowance is already
enough (visible instead as the flow's `approve` step showing `skipped` in
the `Stepper`).

### Cross-chain route

`CrossChainRoute.vue` is purely presentational — source chain, rail,
destination chain, bridge name, ETA, fees — and takes those as props. The
pay page uses it in its route panel before a cross-chain payment starts;
the receipt page reuses it above the two-step delivery tracker
(`payment.trackArrival` via `usePoller`) to keep showing the same route
while it waits for the relayer.

## Staging every dialog state without a wallet

`views/DataDebugView.vue` (`/_data`, dev only) has a "run fake tx-flow"
button that drives a `'pay'`-shaped flow through every step transition with
artificial delays and no contract call — useful for visually checking
`TxFlowDialog`'s `active`/`waiting`/`succeeded` states, and for stopping
partway (dismiss + inspect) to see `failed`/`cancelled` by editing the
fake flow's calls locally.
