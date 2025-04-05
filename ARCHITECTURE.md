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
- [Governance](#governance)
- [ChainStats](#chainstats)
- [Users](#users)
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

## Governance

- Token Details
  - isSupported
  - maxWithdrawalFees

## ChainStats

## Users

## Cross-Chain
