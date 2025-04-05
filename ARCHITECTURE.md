# Chainbills - Architecture

The core of Chainbills is about facilitating movement of money. We make it easy for users to send and receive money and **keep track of the movements**. To achieve tracking, our contracts are designed to have **synchronized** data structures. This document provides a high-level overview of the architecture of Chainbills, including the data structures used, how payments are made, and how withdrawals are processed.

## Table of Contents

- [Synchronized Data Structures](#synchronized-data-structures)
- [Payables](#payables)
- [Payments](#payments)
  - [UserPayments](#userpayments)
  - [PayablePayments](#payablepayments)
- [Withdrawals](#withdrawals)
- [Activities](#activities)
- [Users](#users)
- [ChainStats](#chainstats)
- [Governance](#governance)
- [Cross-Chain](#cross-chain)

## Synchronized Data Structures

By synchronized, we mean that the data structures are designed to be the same across all networks. This allows for easy UI integration and interoperability between different networks.

The data types got created as their necessities arose. They contain necessary properties based on the features being expressed. Mainly, most of Chainbills' activities revolve around the following data structures: **Payables**, **Payments**, and **Withdrawals**. There are other accompanying data structures that are used to support these main activities as we will see below.

Many properties of Chainbills' Data Structures are counters. They used to keep track of various entities across different contexts like `chainCount`, `hostCount`, `payerCount`, `withdrawalsCount`, `activitiesCount`, etc. These counters serve for statistics, kind of always telling the latest of the total that has happened. They also help you historically fetch the nth entity of a given type.

When coding in each blockchain network, we used the appropriate engineering best practice. For example, with EVM in Solidity, property names are in lowerCamelCase, while in Rust (Solana and CosmWasm), property names are in snake_case.

Naturally, most properties of a data structure get the most logical name of what the represent. Also, their data type will be based on the involved blockchain network. Examples include:

| Property           | EVM     | Solana | CosmWasm |
| ------------------ | ------- | ------ | -------- |
| wallet             | address | Pubkey | Addr     |
| token              | address | Pubkey | String   |
| amount (number)    | uint256 | u64    | Uint128  |
| timestamp (number) | uint256 | u64    | u64      |
| count (number)     | uint256 | u64    | u64      |

However, if a given property needs to be involved in a cross-chain activity, we use a more generic data type for reconciliation. Specifically, this is the case of wallet addresses when recording payments to payables (as payments can come from any chain). So when saving the payer of a payable, instead of using the native wallet address type, we use the 32 bytes representation of that wallet. This choice was inspired by Wormhole as it has a well-defined interchangeable method of representing wallet addresses in each chain as 32 bytes. Infact, we use Wormhole's methods to achieve that where obtainable (in EVM).

| EVM     | Solana   | CosmWasm |
| ------- | -------- | -------- |
| bytes32 | [u8; 32] | [u8; 32] |

Still on synchronisation, every data structure has a unique identifier (ID). IDs are also 32 bytes. In EVM and CosmWasm, we create IDs by hashing multiple variables. In Solana, the Pubkey of the PDA (Program Derived Account) storing the data structure auto-serves as its ID. (Pubkeys are 32 bytes). The ID is not stored within the data structure itself. You can get it from the method that the blockchain network expects.

Each contract call emits contextual event with which you can monitor the contracts for changes. We attempt to emit the event with exact same format and properties across all networks.

With the above intro in mind, let's look at each data structure, its components or fields, and their purpose.

## Payables

A payable is an entity into which anyone can pay money and from which its owner can withdraw funds. It can enforce how the tokens and amounts paid into it. It can also specify when it receive payments (being closed or not).

A payable can be created by anyone. However, only the creator (host) of a payable can update its properties or withdraw from it. It contains the following properties:

| Field                     | Type             | Description                                                                                                    |
| ------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `host`                    | wallet           | The address of the User account that owns the Payable.                                                         |
| `chainCount`              | number           | The nth count of payables on the context chain at the point this payable was created.                          |
| `hostCount`               | number           | The nth count of payables that the host has created at the point of this payable's creation.                   |
| `createdAt`               | number           | The timestamp of when this payable was created.                                                                |
| `paymentsCount`           | number           | The total number of payments made to this payable, from all chains.                                            |
| `withdrawalsCount`        | number           | The total number of withdrawals made from this payable.                                                        |
| `activitiesCount`         | number           | The total number of activities made on this payable.                                                           |
| `allowedTokensAndAmounts` | TokenAndAmount[] | Enforces which tokens and amounts can be paid to the Payable. If empty, then the payable allows free payments. |
| `balances`                | TokenAndAmount[] | The balances array in this Payable.                                                                            |
| `isClosed`                | bool             | Whether this payable is currently accepting payments.                                                          |
| `isAutoWithdraw`          | bool             | Whether payments to this payable get auto-withdrawn to the host at payment time.                               |

- `host`, `chainCount`, `hostCount`, `createdAt` are set at the time of creation of the payable and never change.
- `paymentsCount` keep increasing by one for every payment.
- `withdrawalsCount` keep increasing by one for every withdrawal.
- `activitiesCount` keep increasing by one for every activity on this payable, whether payment or withdrawal or an update. Creating the payable is already activity 1.
- `balances` increase on payments and decrease on withdrawals.
- `allowedTokensAndAmounts`, `isClosed`, and `isAutoWithdraw` can be updated by the `host` at any time.

In the EVM, the `allowedTokensAndAmounts` and `balances` arrays are stored in mappings based on how Solidity works. Instead, payables in EVM store the counts of these arrays, you can then use the count to retrieve the value from the mappings of arrays.

The following are the contract methods that manage payables:

| Method                          | Expected Properties                     |
| ------------------------------- | --------------------------------------- |
| `createPayable`                 | allowedTokensAndAmounts, isAutoWithdraw |
| `closePayable`                  | payableId                               |
| `reopenPayable`                 | payableId                               |
| `updatePayableTokensAndAmounts` | payableId, allowedTokensAndAmounts      |
| `updatePayableAutoWithdraw`     | payableId, isAutoWithdraw               |

For now, `autoWithdraw` only works in EVM.

## Payments

When a user calls the `pay` function of the contract, they provide the payable ID, the token, and the amount they want to pay. The contract makes necessary checks, transfers tokens, and then updates the payable's balance.

Within the same transaction, the contract creates 2 records of payments. One for the user and the other for the payable. Duplicating the records this way allows us to easily track payments based on a given context (user or payable). It also has the indispensable advantage of helping cross-chain activities.

If payment is made across chains, in the source chain, we store a `UserPayment` and in the target chain, we store a `PayablePayment`. If both payments user and payable live in the same chain (a non-cross-chain payment), we store both data structures on the same chain.

Payments are receipts of money movement. They are public and permanent (their properties don't change).

### UserPayments

A `UserPayment` is a record of a payment made by a user to a payable. It is a user's receipt of a payment made on their chain to a Payable on any blockchain network (source-chain inclusive). It contains the following properties:

| Field            | Type     | Description                                                                                           |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `payableId`      | 32 bytes | The ID of the Payable to which this Payment was made.                                                 |
| `payer`          | wallet   | The address of the User account that made this Payment.                                               |
| `token`          | token    | The address of the associated token that was paid.                                                    |
| `payableChainId` | number   | The Wormhole Chain ID of the chain into which the payment was made. 0 (zero) if same as source chain. |
| `chainCount`     | number   | The nth count of payments on this chain at the point this payment was made.                           |
| `payerCount`     | number   | The nth count of payments that the payer has made at the point of payment.                            |
| `timestamp`      | number   | When this payment was made.                                                                           |
| `amount`         | number   | The amount of the token that was paid.                                                                |

### PayablePayments

A `PayablePayment` is a record of a payment made to a payable. It is a Payable's receipt of a payment made from any blockchain network (recipient-chain inclusive). It contains the following properties:

| Field             | Type     | Description                                                                                                     |
| ----------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `payableId`       | 32 bytes | The ID of the Payable to which this Payment was made.                                                           |
| `payer`           | 32 bytes | The address of the User account that made this Payment.                                                         |
| `token`           | token    | The address of the associated token that was received.                                                          |
| `chainCount`      | number   | The nth count of payable payments on this chain at the point this payment was received.                         |
| `payerChainId`    | number   | The Wormhole Chain ID of the chain from which the payment was made. 0 (zero) if same as recipient chain.        |
| `localChainCount` | number   | The nth count of payments to this payable from the payment source chain at the point this payment was recorded. |
| `payableCount`    | number   | The nth count of payments that the payable has received at the point when this payment was made.                |
| `timestamp`       | number   | When this payment was made.                                                                                     |
| `amount`          | number   | The amount of the token that was received.                                                                      |

The `payer` is 32 bytes type of the payer's wallet address. This synchronises the different wallet types across different block chain networks.

## Withdrawals

Just like with `pay`, when a payable's owner (host) calls the `withdraw` function of the contract, they provide the payable ID, the token, and the amount they want to withdraw. The contract makes necessary checks, transfers tokens, and then updates the payable's balance.

During withdrawal, Chainbills deducts fees for maintenance. The fee is 2% of the withdrawal amount with a maximum capacity set for each token. The fee is deducted from the amount before it is transferred to the host's wallet. The fee is sent to the fee collector address.

A successful `withdraw` call effectively creates a `Withdrawal` data structure. A Withdrawal is also a receipt of money movement. It is public and permanent (its properties don't change). Following are its properties:

| Field          | Type     | Description                                                                           |
| -------------- | -------- | ------------------------------------------------------------------------------------- |
| `payableId`    | 32 bytes | The ID of the Payable from which this Withdrawal was made.                            |
| `host`         | wallet   | The address of the User account that made this Withdrawal.                            |
| `token`        | token    | The address of the associated token that was withdrawn.                               |
| `chainCount`   | number   | The nth count of withdrawals on this chain at the point this withdrawal was made.     |
| `hostCount`    | number   | The nth count of withdrawals that the host has made at the point of withdrawal.       |
| `payableCount` | number   | The nth count of withdrawals from this payable at the point this withdrawal was made. |
| `timestamp`    | number   | When this withdrawal was made.                                                        |
| `amount`       | number   | The amount of the token that was withdrawn.                                           |

Note that the recorded amount is the original amount that the user requested. If a user is withdrawing 100 USDC, 100 will be recorded, they will receive 98 USDC, and 2 USDC will be sent to the fee collector address.

## Activities

Every user action is recorded as an activity across the contracts. In Chainbills' contracts, activities are data structures that hold info about things that happen when they do. Keeping track of activities is to have a chronological means (through the counters) of obtaining when things happening in the contract, in context of a user, or a payable. It serves for statistics.

Any time a new data structure (payable, payment, or withdrawal) is created, the contracts also creates an activity. Also, for the first time when a user interacts with Chainbills (either creating a payable or making a payment), we emit an `InitializedUser` event and create a matching activity. An activity has the following properties:

| Field          | Type         | Description                                                                               |
| -------------- | ------------ | ----------------------------------------------------------------------------------------- |
| `chainCount`   | number       | The nth count of activities on this chain at the point this activity was recorded.        |
| `userCount`    | number       | The nth count of activities that the user has made at the point of this activity.         |
| `payableCount` | number       | The nth count of activities on the related payable at the point of this activity.         |
| `timestamp`    | number       | The timestamp of when this activity was recorded.                                         |
| `entity`       | 32 bytes     | The ID of the entity (Payable, Payment, or Withdrawal) that is relevant to this activity. |
| `activityType` | ActivityType | The type of activity.                                                                     |

The counters in activity are contextual. If it is a user initialized activity, then the `userCount` will be 1 (one) and the `payableCount` will be 0 (zero) as no payable is involved. Otherwise, for most activities, the payable counter is relative to the involved payable and the user counter is relative to the involved user. The `entity` holds the ID of the created data structure. In case of initializing a user, `entity` will be their wallet address. `ActivityType` is an enum that indicates the type of activity. It can be one of the following:

| ActivityType                            | Description                                                 |
| --------------------------------------- | ----------------------------------------------------------- |
| `InitializedUser`                       | A user was initialized.                                     |
| `CreatedPayable`                        | A payable was created.                                      |
| `UserPaid`                              | A payment was made by a user.                               |
| `PayableReceived`                       | A payment was made to the payable.                          |
| `Withdrew`                              | A withdrawal was made by a payable.                         |
| `ClosedPayable`                         | The payable was closed and is no longer accepting payments. |
| `ReopenedPayable`                       | The payable was reopened and is now accepting payments.     |
| `UpdatedPayableAllowedTokensAndAmounts` | The payable's allowed tokens and amounts were updated.      |
| `UpdatedPayableAutoWithdrawStatus`      | The payable's auto withdraw setting was updated.            |

The relevance of activities become evident when you want to query history for a given user, payable, or at the chain (contract level). If a user has had 25 activities, you can iterate and get the activity ID (and hence the activity). From the activity, you can know what happened, when it happened, the entity involved, and the type of activity. This was the only way to get the contracts to store events chronologically.

Also, activities are a one-time struct. Their counters are in sync with the respective user, payable, or chain-level recording. So the same activity is referenced in all three contexts.

## Users

The `User` data structure keeps activity counters for every user. It is created when a user first interacts with Chainbills. It contains the following properties:

| Field              | Type   | Description                                                                  |
| ------------------ | ------ | ---------------------------------------------------------------------------- |
| `chainCount`       | number | The nth count of users on this chain at the point this user was initialized. |
| `payablesCount`    | number | Total number of payables that this user has ever created.                    |
| `paymentsCount`    | number | Total number of payments that this user has ever made.                       |
| `withdrawalsCount` | number | Total number of withdrawals that this user has ever made.                    |
| `activitiesCount`  | number | Total number of activities that this user has ever made.                     |

When you need to fetch the payables a user created, the payments they made, the withdrawals they made, or their activities, you loop through the counter and fetch the ID of the entity based on the blockchain network. The counters get incremented based on the respective activity. During user initialization, `chainCount` is set and `activitiesCount` is set to 1 (one). `chainCount` never changes, it is permanent. The other counters keep increasing continuously.

To fetch a `User` object, you provide a wallet address and the involved struct with counters is returned. You provide this based on the involved blockchain network.

| Blockchain Network | Method to Fetch User                        |
| ------------------ | ------------------------------------------- |
| EVM                | `getUser` function                          |
| Solana             | Pubkey of PDA whose seeds is wallet address |
| CosmWasm           | `user` query                                |

## ChainStats

The `ChainStats` data structure keeps track of the statistics of the contract on a given chain. It is like the `User` struct but this time, its counters are in sync across the contract for each methods, like a global statistics keeper. Interestingly, it keeps other counters for cross-chain purposes. It contains the following properties:

| Field                            | Type   | Description                                                              |
| -------------------------------- | ------ | ------------------------------------------------------------------------ |
| `usersCount`                     | number | Total number of users that have ever interacted on this chain.           |
| `payablesCount`                  | number | Total number of payables that have ever been created on this chain.      |
| `foreignPayablesCount`           | number | Total number of foreign payables that have ever been recorded.           |
| `userPaymentsCount`              | number | Total number of payments that users have ever made on this chain.        |
| `payablePaymentsCount`           | number | Total number of payments that payables have ever received on this chain. |
| `withdrawalsCount`               | number | Total number of withdrawals that have ever been made on this chain.      |
| `activitiesCount`                | number | Total number of activities that have ever been made on this chain.       |
| `publishedWormholeMessagesCount` | number | Total number of published Wormhole messages on this chain.               |
| `consumedWormholeMessagesCount`  | number | Total number of consumed Wormhole messages on this chain.                |

ChainStats is available as a global getter on each blockchain network. It is initialized when the contract is deployed or initialized. With its counters, you can chronologically retrieve all data structures in Chainbills. Furthermore, its counters are naturally incremented when the involved action takes place.

In Solana, it is stored in the PDA whose seeds is just "chain". Additionally, this PDA in Solana serves as the authority for the token account holding tokens for the Chainbills contract in Solana.

## Governance

- Config
- Token Details
  - isSupported
  - maxWithdrawalFees

## Cross-Chain

- Wormhole Messages
- Foreign Payables
- USDC in payments
