# Chainbills

Chainbills is a cross-chain payment gateway that allows anyone (hosts) to receive any amount of cryptocurrency from everybody (payers), powered by WormHole. ChainBills deducts 2% (with a fixed maximum) from all withdrawals for fees and maintenance.

## Table Of Contents

- [Features](#features)
  - [About Payables](#about-payables)
  - [Payables' Configuration](#payables-configuration)
  - [Hosts' Controls](#hosts-controls)
  - [Payers' Experience](#payers-experience)
- [Cross-Chain Architecture and Wormhole](#cross-chain-architecture-and-wormhole)
- [Smart Contracts and Entities (Structs)](#smart-contracts-and-entities-structs)
- [Server](#server)
- [Roadmap](#roadmap)

## Features

### About Payables

Anyone can connect their wallet on chainbills and create a _Payable_.

A payable is like a public invoice through which anybody can pay to. Users that create payables are the hosts of those payables. Whereas, users that make payments to payables are their payers. Hosts can view the balances of their payables and can withdraw at anytime. However, ChainBills deducts 2% from all withdrawals for fees and maintenance.

On the dashboard on the frontend, hosts can view all the payables they created and can withdraw from anyone that has a positive balance.

### Payables' Configuration

A payable specifies the amount of a token that can be paid to it. Also, it could specify multiple tokens (and their amounts) that could be paid to it. Furthermore, a payable could allow free payments. That is, accepting any amounts of any tokens.

If a payable allows free payments, it can't specify any accepted tokens and amounts. The payable's host (creator) specifies this payable configuration (allowing free payments or specifying accepted tokens and amounts) at the time when they create the payable.

Hosts can update the configuration of their payables'. However, they should do this with caution to ensure smooth payer experience.

### Hosts' Controls

When creating a Payable, the host provides their email address and a description of that payable. Chainbills uses the email to send payment and withdrawal notifications on the payable. The description is displayed to payers when they want to make payments on payables. Also, the description is also displayed on the receipt of payments to payable.

A host can close any payable they own. That is, they can stop payables from accepting payments. A host can also reopen any closed payable.

Asides from updating the close status of a payable, a host can update the description of their payable. Please do this with caution to ensure smooth payer experience.

### Payers' Experience

Anyone can visit the payment link of a payable and make payment there.

Chainbills collects email addresses of payers too. This is to send email notifications to the payers, after the payment.

While making a payment to a payable that allows free payments, the payer can choose any token (from those provided), input any amount greater than zero, and pay.

If the payable specified only one accepted token (and its amount), the payer pays just that. If multiple tokens (and amounts) were specified in a payable, the payer can select which to pay and then pay.

After a successful payment, Chainbills generates a receipt with the payment's details and redirects the payer to the receipt link. Receipts are public. Hosts and payers can view receipts at anytime.

## Cross-Chain Architecture and Wormhole

Chainbills permits the same activity set across multiple chains.

For now Ethereum Sepolia and Solana Devnet are supported. More chains will be added.

Our mission is to provide a seamless payment-receiving experience to content creators, merchants, and foundations. To enable them receive money for donations, products, and services from a large user base (across multiple chains). Chainbills also makes money easy by providing all these payments in one dashboard.

Chainbills does this by allowing users to create payables and make payments and withdrawals on all chain networks (supported ones for now). So a payable can be created on any chain. Withdrawals are on the same chain in which the Payable was created. However, with payments, a payment can be done from the same or different chain as that of the Payable.

When the blockchain networks of the payable and the payer are the same, no cross-chain activity is needed and payment proceeds directly. However, in the case of different chains, we need to reconcile money and data across the invovled chains. This is powered by Wormhole.

[Wormhole](https://wormhole.com) is an open source blockchain development platform connecting the decentralized web. Wormhole powers Chainbills by enabling [cross-chain messaging](https://wormhole.com/messaging/) and with payment [routes](https://github.com/wormhole-foundation/wormhole-sdk-ts/blob/main/examples/src/router.ts).

## Smart Contracts and Entities (Structs)

For each supported smart contract ecosystem (EVM and Solana), the contract code lives in the respective directories. Each Chainbills contract on each chain is built with a solid data framework backing it. It is built around the following core entities:

- `TokenAndAmount`: A helper struct to specify a payable's configuration or record details of a payment or a withdrawal.

- `Payable`: Where payments can be made. Created by a host and holds balances of its payments. Is Closeable. Specifies its accepted TokensAndAmounts. If the TokensAndAmounts array/vector is empty, then the given payable allows free payments.

- `UserPayment`: Created when payers pay into a payable. Holds payment-related info like the payer (of course), payableId, payable's chain timestamp, and payment details (the paid token and amount). This is stored on the chain in which the payer's address resides.

- `PayablePayment`: Created when a payable receives a payment. Holds payment info relative to the payable like the payer and the payer's chain among others. This is stored on the chain in which the payable was created. Effectively payment info is duplicated for both users and payables to allow optimum data access with cross-chain features.

- `Withdrawal`: Created when hosts withdraw money from a payable. Holds withdrawal-related info like the host (of course), payable, timestamp, and withdrawal details (the withdrawn token and its amount).

- `User`: A struct that keeps track of the counts of payables, payments, and withdrawals made by wallet addresses on Chainbills.

- `ChainStats`: A struct that keeps track of the counts of all users, payables, payments, and withdrawals on Chainbills on a given chain.

## Server

The server helps with handling other off-chain processes. Specifically, Chainbills sends notification emails from within the server.

The server is a NodeJS Firebase Cloud Function that exposes endpoints for the frontend. The frontend call them after any of the main entities (Payables, Payments, and Withdrawals) have been created or initialized.

Users' emails and payable descriptions are stored and managed by users off-chain. For now, relaying calls are done here too.

One important thing about the server is keeping track of all payables from any chain. So instead of the frontend to guess the chain on which the payable was created (when the payable's page is visited), the server records the chain alongside the payable ID during the payable's creation and returns those when queried.

## Roadmap

- Completing Cross-Chain Architecture.

- Implement custom Wormhole route to add token swaps to the USDC CCTP bridging.

- Build a custom relayer.

- Adding a CosmWasm Chain.

- Passing the 2% charge to payers.

- Making widgets or embeddables that hosts can add to their websites.

- Enabling subscription payments for hosts.

- Enable Event Ticketing.

- Supporting More Chains.
