# On-Chain Data Reference (EVM)

This file lists every on-chain fact the frontend relies on. Paths are relative to the repository root. Solidity sources are in `evm/src`; the frontend ABIs are in `frontend/src/stores/abis.ts` (`gettersAbi` for CbGetters, `mainAbi` for the Chainbills proxy, `erc20Abi`).

> Note: `gettersAbi` and `mainAbi` each contain every entry twice (for example `closePayable` appears at two line ranges). viem tolerates this. Deduplicating them is a safe cleanup.

---

## 1. Contracts per chain

| Chain | Network | Chainbills proxy (`contracts` in `schemas/tokens.ts`) | CbGetters (`getters` in `stores/evm.ts`) | Wormhole | CCTP |
| --- | --- | --- | --- | --- | --- |
| `megaeth` | mainnet | `0xc38d1681d34DA821E46508C084D673477E455570` | `0x9885b3807f14Fe3DB010fB8BD98C60716f6468a8` | yes | no |
| `sepolia` | testnet | `0x48353Ab7662Bc8218811Fbbdf247cCc8602fba8A` | `0x325D77a09F267A7aF695aB5E68F7ddF0eC530a38` | yes | domain 0 |
| `arctestnet` | testnet | `0x0bA837eF7358981967FB2cFcB79bf649b7cACbf4` | `0x01656b5968C4b98F05F596344DA7066118d6738a` | no | domain 26 |

Reads do not need a connected wallet: build a viem/wagmi config per chain with `http()` transport (see `evm.getViemChain`).

---

## 2. CbGetters read functions

Every single-entity getter **reverts** when the entity does not exist on that chain. Use this revert to probe which chain holds an id.

| Getter | Reverts with | Returns |
| --- | --- | --- |
| `getConfig()` | — | `wormholeFinality, wormholeChainId, withdrawalFeePercentage, circleDomain, feeCollector, wormhole, circleBridge, circleTokenMinter, circleTransmitter, cbChainId` |
| `getChainStats()` | — | `usersCount, payablesCount, foreignPayablesCount, userPaymentsCount, payablePaymentsCount, withdrawalsCount, activitiesCount` |
| `getWormholeStats()` / `getCctpStats()` | — | message counters |
| `getTokenDetails(address token)` | `InvalidTokenAddress` | `isSupported, token, maxWithdrawalFees, totalUserPaid, totalPayableReceived, totalWithdrawn, totalWithdrawalFeesCollected`: **on-chain volume per token** |
| `getUser(address)` | `InvalidWalletAddress` | `chainCount, payablesCount, paymentsCount, withdrawalsCount, activitiesCount` |
| `getPayable(bytes32)` | `InvalidPayableId` | `host, chainCount, hostCount, createdAt, paymentsCount, withdrawalsCount, activitiesCount, allowedTokensAndAmountsCount, balancesCount, isClosed, isAutoWithdraw` |
| `getAllowedTokensAndAmounts(bytes32)` | `InvalidPayableId` | `{token, amount}[]`; an empty list means the payable accepts any supported token and any amount |
| `getBalances(bytes32)` | `InvalidPayableId` | `{token, amount}[]` |
| `getForeignPayable(bytes32)` | `InvalidPayableId` | `chainId` (the **home cbChainId**), `allowedTokensAndAmountsCount, isClosed` |
| `getForeignPayableAllowedTokensAndAmounts(bytes32)` | `InvalidPayableId` | `{bytes32 token, uint64 amount}[]` |
| `getUserPayment(bytes32)` | `InvalidPaymentId` | `payableId, payer, token, payableChainId, chainCount, payerCount, timestamp, amount` |
| `getPayablePayment(bytes32)` | `InvalidPaymentId` | `payableId, payer (bytes32), token, chainCount, payerChainId, localChainCount, payableCount, timestamp, amount, payerPaymentId` |
| `getWithdrawal(bytes32)` | `InvalidWithdrawalId` | `payableId, host, token, chainCount, hostCount, payableCount, timestamp, amount` |
| `getActivityRecord(bytes32)` | `InvalidActivityId` | `chainCount, userCount, payableCount, timestamp, entity (bytes32), activityType (uint8)` |
| `getPayableChainPaymentsCount(payableId, cbChainId)` | only for id 0 | number of payments the payable received from that source chain |
| `get*Bulk(ids[])` | the whole call reverts if **any** id is missing | arrays of the structs above (`getUsersBulk, getPayablesBulk, getUserPaymentsBulk, getPayablePaymentsBulk, getWithdrawalsBulk, getActivityRecordsBulk`) |

### Paginated id lists

All lists are stored **oldest first**. `offset` counts from the oldest item, and a call returns `min(limit, total - offset)` items. To show newest first, compute `offset = max(0, total - (page + 1) * size)` and reverse the result. Totals come from the matching counter.

| Function | Total from |
| --- | --- |
| `chainUserAddressesPaginated(off, lim)` → `address[]` | `getChainStats().usersCount` |
| `chainPayableIdsPaginated` | `payablesCount` |
| `chainForeignPayableIdsPaginated` | `foreignPayablesCount` |
| `chainUserPaymentIdsPaginated` | `userPaymentsCount` (payments **made from** this chain) |
| `chainPayablePaymentIdsPaginated` | `payablePaymentsCount` (payments **received on** this chain, including cross-chain) |
| `chainWithdrawalIdsPaginated` | `withdrawalsCount` |
| `chainActivityIdsPaginated` | `activitiesCount` |
| `userPayableIdsPaginated(addr, off, lim)` | `getUser(addr).payablesCount` |
| `userPaymentIdsPaginated(addr, …)` | `getUser(addr).paymentsCount` |
| `userWithdrawalIdsPaginated(addr, …)` | `getUser(addr).withdrawalsCount` |
| `userActivityIdsPaginated(addr, …)` | `getUser(addr).activitiesCount` |
| `payablePaymentIdsPaginated(id, …)` | `getPayable(id).paymentsCount` |
| `payableWithdrawalIdsPaginated(id, …)` | `getPayable(id).withdrawalsCount` |
| `payableActivityIdsPaginated(id, …)` | `getPayable(id).activitiesCount` |
| `payableChainPaymentIdsPaginated(id, cbChainId, …)` | `getPayableChainPaymentsCount(id, cbChainId)` |

User-scoped paginators revert (via `getUser`) for wallets that never interacted on that chain. Treat that as "no activity on this chain".

---

## 3. Activity records

`ActivityType` (uint8, order matters):

| # | Type | `entity` holds | Resolve with | Appears in lists |
| --- | --- | --- | --- | --- |
| 0 | `InitializedUser` | wallet, left-padded to bytes32 | `getUser(address(uint160(entity)))` | chain, user |
| 1 | `CreatedPayable` | payableId | `getPayable` | chain, user, payable |
| 2 | `UserPaid` | userPaymentId | `getUserPayment` | chain, user (payer's chain only) |
| 3 | `PayableReceived` | payablePaymentId | `getPayablePayment` | chain, payable (payable's home chain only) |
| 4 | `Withdrew` | withdrawalId | `getWithdrawal` | chain, user (host), payable |
| 5 | `ClosedPayable` | payableId | `getPayable` | chain, user, payable |
| 6 | `ReopenedPayable` | payableId | `getPayable` | chain, user, payable |
| 7 | `UpdatedPayableAllowedTokensAndAmounts` | payableId | `getPayable` | chain, user, payable |
| 8 | `UpdatedPayableAutoWithdrawStatus` | payableId | `getPayable` | chain, user, payable |

Notes:

- A cross-chain payment produces `UserPaid` on the **payer's chain** and `PayableReceived` on the **payable's chain**. They are linked through `PayablePayment.payerPaymentId == UserPayment id`.
- When auto-withdraw is on, a `Withdrew` activity follows the `PayableReceived`, recorded under the host.
- Activity records hold no transaction hash. Rows link to entity pages (payable, receipt, address) and to the block explorer's address pages, not to transactions.
- Settings activities (5–8) do not store the before/after values. The row shows the event plus the payable's **current** state.

---

## 4. Write functions on the Chainbills proxy

| Function | msg.value | Broadcast to other chains | Emits |
| --- | --- | --- | --- |
| `createPayable(TokenAndAmount[] ataa, bool isAutoWithdraw)` | exactly `getWormholeMessageFee()` (0 when the chain has no Wormhole) | yes | `CreatedPayable`, `PayableUpdateBroadcasted` |
| `closePayable(bytes32)` | exactly the Wormhole fee | yes | `ClosedPayable`, `PayableUpdateBroadcasted` |
| `reopenPayable(bytes32)` | exactly the Wormhole fee | yes | `ReopenedPayable`, `PayableUpdateBroadcasted` |
| `updatePayableAllowedTokensAndAmounts(bytes32, TokenAndAmount[])` | exactly the Wormhole fee | yes | `UpdatedPayableAllowedTokensAndAmounts`, `PayableUpdateBroadcasted` |
| `updatePayableAutoWithdraw(bytes32, bool)` | none (nonpayable) | **no** | `UpdatedPayableAutoWithdrawStatus` |
| `pay(bytes32 payableId, address token, uint256 amount)` | `amount` if native token, else 0 | — | `UserPaid`, `PayableReceived` |
| `payForeignViaCctp(bytes32 payableId, address token, uint256 amount, uint256 maxFee)` | Wormhole fee | payment message | `UserPaid` |
| `withdraw(bytes32 payableId, address token, uint256 amount)` | 0 | — | `Withdrew` |
| `publishPayableDetails(bytes32)` | Wormhole fee | yes (anyone may call) | `PayableUpdateBroadcasted` |

- The Wormhole fee must match **exactly**: too little reverts `InsufficientWormholeFees`, too much reverts `IncorrectWormholeFees`. Read it with `mainAbi.getWormholeMessageFee()` (`evm.fetchWormholeFee`).
- Host-only guards: `NotYourPayable`, `PayableIsAlreadyClosed`, `PayableIsNotClosed`.
- `updatePayableAllowedTokensAndAmounts` replaces the whole list. Tokens must be supported, amounts non-zero and within uint64, with no duplicate (token, amount) pairs. An empty list means "accept any amount".
- ERC-20 payments need `approve(proxy, amount)` first (plus `maxFee` for CCTP). The native token is represented by the proxy's own address.
- The 2% withdrawal fee comes from `getConfig().withdrawalFeePercentage`, which is in basis points (/10000), capped per token by `getTokenDetails(token).maxWithdrawalFees`.

---

## 5. Detecting cross-chain delivery from the browser

### 5.1 Payment arrival (payer chain A → payable chain B)

1. On chain A, the `payForeignViaCctp` receipt contains `UserPaid(payableId, payerWallet, paymentId, payableChainId, chainCount, payerCount)`.
   - `payerCount` is the payment **nonce**. It equals `getUserPayment(paymentId).payerCount`.
2. On chain B (the payable's home chain), poll the proxy's public mapping:
   `consumedPaymentNonces(bytes32 cbChainIdOfA, bytes32 payerLeftPadded, uint64 payerCount) → bool`.
   - `payerLeftPadded` is the payer address left-padded to 32 bytes (`pad(address, { size: 32 })`).
   - `true` means the relayer delivered the payment.
3. To fetch the delivered record on chain B:
   - read `getPayableChainPaymentsCount(payableId, cbChainIdOfA)`,
   - page the newest ids with `payableChainPaymentIdsPaginated(payableId, cbChainIdOfA, off, lim)`,
   - load them with `getPayablePaymentsBulk`,
   - pick the one whose `payerPaymentId == paymentId`.
4. The chain-B payment id **differs** from the chain-A id. The receipt page resolves it through step 3.

Suggested cadence: every 6 s while the tab is visible, backing off to 20 s after 3 minutes. Stop on success or when the component unmounts. Typical CCTP fast transfer plus relay takes about 1–3 minutes on testnets.

### 5.2 Payable sync (home chain → other chains)

1. The home-chain receipt of `createPayable` / `closePayable` / `reopenPayable` / `updatePayableAllowedTokensAndAmounts` contains `PayableUpdateBroadcasted(payableId, nonce, actionType)`.
2. On each other chain of the **same network type** that the payable can sync to, poll `payableUpdateNonces(payableId, homeCbChainId) → uint64` until it is `>= nonce`.
3. Without a receipt (for example on page load), `getForeignPayable(payableId)` succeeding on a chain means the payable is available there. Compare `isClosed` and `allowedTokensAndAmountsCount` with the home chain to flag "sync pending".
4. Auto-withdraw changes are **not** broadcast, so there is nothing to poll for them.

### 5.3 Finding the home chain of an id

IDs are `keccak256(chainid, timestamp, entity, salt, count)`, so the chain cannot be derived from an id. Instead, probe in parallel on every EVM chain:

- **payable:** `getPayable(id)` succeeds only on its home chain. As a shortcut, `getForeignPayable(id).chainId` on any synced chain returns the home cbChainId (map it with `cbChainIdToChain`).
- **payment:** `getUserPayment` (payer side) and `getPayablePayment` (payable side).
- **withdrawal:** `getWithdrawal`.
- **activity:** `getActivityRecord`.

---

## 6. Events (for parsing transaction receipts)

`CreatedPayable(payableId, hostWallet, chainCount, hostCount)`, `UserPaid(payableId, payerWallet, paymentId, payableChainId, chainCount, payerCount)`, `PayableReceived(payableId, payerWallet bytes32, paymentId, payerChainId, chainCount, payableCount)`, `Withdrew(payableId, hostWallet, withdrawalId, chainCount, hostCount, payableCount)`, `ClosedPayable`, `ReopenedPayable`, `UpdatedPayableAllowedTokensAndAmounts`, `UpdatedPayableAutoWithdrawStatus(…, isAutoWithdraw)`, `PayableUpdateBroadcasted(payableId, nonce, actionType)`, `ReceivedForeignPaymentViaWormhole`, `ReceivedForeignPaymentViaCircle`, `ReceivedPayableUpdateViaWormhole`, `ReceivedPayableUpdateViaCircle`. The full list is in `evm/src/CbEvents.sol`.

---

## 7. Off-chain exceptions

| Data | Where | Endpoint |
| --- | --- | --- |
| Payable description | Firebase server | `GET /payable/:id` → `{ chainName, description }`; `POST /payable {payableId, description}` upserts. The server checks on-chain that the signed-in wallet is the host, so the same call both creates and edits a description. Length must be 3–3000 characters. |
| FCM notification token | Firebase server | `POST /notifications` (unchanged) |
| Analytics | Firebase Analytics | unchanged |

Chain discovery must **not** depend on `GET /payable/:id`. Use on-chain probing (§5.3) and treat the description as optional decoration that may fail to load.
