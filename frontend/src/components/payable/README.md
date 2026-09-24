# `src/components/payable/`

Components for the public payable detail page (`/payable/:id`). Import
these from their individual paths rather than a barrel; each component file
is self-contained with its own doc block listing props, emits and a usage
example.

The page is public. Anyone can see it, with or without a connected wallet.
The host additionally sees the balances card and the host controls section.

## Files

| File | Purpose |
| --- | --- |
| `PayableHero.vue` | Full-width hero band: avatar, id, chain badges, status pill, host address, created date, and the actions row (Pay, Copy link, Share, QR, Manage). |
| `PayableSettingsCard.vue` | Side-rail card showing payment rules (any amount or specific options), auto-withdraw status and the withdrawal fee from the chain config. |
| `PayableAvailabilityCard.vue` | Side-rail card listing every EVM chain in the payable's network with its sync status. Polls `usePayableStore().availability` every 12 s while any chain is pending. |
| `PayableBalancesCard.vue` | Host-only main-column card: each non-zero balance with a "Withdraw" button that opens `WithdrawDialog`. Shows an empty state with a copy-link action when no balance exists. |
| `PayableHostControls.vue` | Host-only "Manage payable" section: Close/Reopen with confirmation, payment rules editor dialog, auto-withdraw toggle with confirmation, and an inline description editor. Each action calls the matching `usePayableStore` write action, which drives a `useTxFlowStore` flow shown by `TxFlowDialog` in `App.vue`. |
| `PaymentRulesEditor.vue` | Reusable rule-builder for accepted tokens and amounts. Used by both `PayableHostControls` (editing) and `CreatePayableView` (creating). Emits `update:modelValue` with the parsed `TokenAndAmount[]` and `update:error` with the current validation error. |
| `DescriptionEditor.vue` | Inline textarea editor with a 3 to 3000 character counter, Save and Cancel. Calls `usePayableStore().updateDescription` on save. Used inside `PayableHostControls`. |

## Relationships

```
PayableDetailView
  PayableHero
  [two-column grid]
    left column:
      description card (inline)
      PayableBalancesCard (host only)
      ActivityFeed (from @/components/activity)
    right rail:
      PayableSettingsCard
      PayableAvailabilityCard
      StatTile row (numbers card)
  PayableHostControls (host only)
    DescriptionEditor
    PaymentRulesEditor
```

`PaymentRulesEditor` is also used by `CreatePayableView` to keep the rule
editor consistent across create and edit flows.

## Data sources

All content on this page is on-chain, read through `usePayableStore`,
`useEvmStore` and `useStatsStore`. The payable description is the sole
off-chain exception (Firebase server endpoint), loaded with `ignoreErrors:
true` so a failed description fetch never blocks the rest of the page.
Mainnet and testnet data are never mixed.
