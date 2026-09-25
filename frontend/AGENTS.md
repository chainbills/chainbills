# Chainbills Frontend

Rules for editing this directory. For architecture, file structure, and store documentation, read the README.

## Data rules

- Every list, count, status, balance, setting, and statistic is read from the Chainbills contracts.
- The only off-chain data is a payable's description, fetched via `server.getPayable`. A failed fetch never blocks rendering.
- Chain discovery is on-chain. `payable.resolveChain(id)` calls every EVM chain in parallel and takes the first success. Do not use the server for chain discovery.
- Amounts are `bigint` end-to-end. Use `parseTokenAmount` / `formatTokenAmount` for conversions. Never `Number(bigint)` or `amount * 10 ** decimals` anywhere that feeds a comparison or a transaction.
- Mainnet and testnet data are never mixed in one list, total, or chart. Pass an explicit network type to all stats aggregators.
- Reads work without a connected wallet. Every EVM read goes through the cached, wallet-less `PublicClient` per chain (`evm.publicClientFor`).

## Code conventions

- Toast: always `severity: 'error'` for errors, `life: 12000`. Use the custom template in `App.vue`.
- The 3000ms settle wait in `evm.writeContract` after `waitForTransactionReceipt` is intentional. It lets the block propagate before the UI re-reads state.
- Cross-chain payments: toast says "Funds will arrive after relaying". Do not block the user on-page waiting for relay confirmation.
- Payables are never cached. Payments, withdrawals, activities, and chain-discovery results are cached via `stores/cache.ts` (IndexedDB-backed).

## Do not extend

- `stores/solana.ts` and the `solanadevnet` chain are inactive. Do not add Solana functionality.
- `stores/idl.ts` Anchor IDL is stale.

## Commands

```bash
npm run dev           # Vite dev server
npm run build         # type-check + vite build
npm run type-check    # vue-tsc --build
npm run lint          # eslint --fix
npm run format        # prettier --write src/
```
