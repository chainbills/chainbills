# Chainbills

Chainbills is a cross-chain payment gateway that allows anyone (hosts) to receive any amount of cryptocurrency from everybody (payers), powered by WormHole. ChainBills deducts 2% from all withdrawals for fees and maintenance.

## Table Of Contents

- [Features](#features)
  - [About Payables](#about-payables)
  - [Payables' Configuration](#payables-configuration)
  - [Hosts' Controls](#hosts-controls)
  - [Payers' Experience](#payers-experience)
- [Cross-Chain Architecture](#cross-chain-architecture)
  - [Wormhole](#wormhole)
- [Solana](#solana)
  - [Entities (Structs)](#entities-structs)
  - ["Global"](#global)
  - [More on the Program](#more-on-the-program)
- [EVM](#evm)
- [Relayer](#relayer)
- [Server](#server)
- [Frontend](#frontend)
- [Roadmap](#roadmap)

## Features

### About Payables

Anyone can connect their wallet on chainbills and create a _Payable_.

A payable is like a public invoice through which anybody can pay to. Users that create payables are the hosts of those payables. Whereas, users that make payments to payables are their payers. Hosts can view the balances of their payables and can withdraw at anytime. However, ChainBills deducts 2% from all withdrawals for fees and maintenance.

On the dashboard on the frontend, hosts can view all the payables they created and can withdraw from anyone that has a positive balance.

### Payables' Configuration

A payable specifies the amount of a token that can be paid to it. Also, it could specify multiple tokens (and their amounts) that could be paid to it. Furthermore, a payable could allow free payments. That is, accepting any amounts of any tokens.

If a payable allows free payments, it can't specify any accepted tokens and amounts. The payable's host (creator) specifies this payable configuration (allowing free payments or specifying accepted tokens and amounts) at the time when they create the payable.

Payables' configurations are permanent. They can't be updated. If you want to change how your payable accepts money, please create a new payable.

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

## Cross-Chain Architecture

Chainbills allows payments from multiple chains.

For now, only Ethereum and Solana are supported. More chains will be added.

Our mission is to provide a seamless payment-receiving experience to content creators, merchants, and foundations. To enable them receive money for donations, products, and services from a large user base (across multiple chains).

Chainbills does this by allowing users to create payables and make withdrawals on Solana while accepting payments from all chain networks (Ethereum and Solana for now). Solana is the choice central data and assets store because of its performance and inexpensiveness.

In effect, Chainbills is built as a hub-and-spoke model with Solana as the hub. All payments can come from all chains (the spokes). These payments get forwarded to the respective Payable on Solana.

Bridging tokens at payment time is made possible by Wormhole.

### Wormhole

[Wormhole](https://wormhole.com) is an open source blockchain development platform connecting the decentralized web.

Wormhole powers by Chainbills by any cross-chain payments through the [Wormhole TokenBridge](). If a payer connects a Solana wallet, they can directly pay into the Payable on Solana. On the other hand, if the payer connects with an Ethereum wallet, they can still make payment, but this time, it routes through Wormhole into the Solana program.

Chainbills' EVM contract and Solana program both integrate the Wormhole SDK to achieve [contract-controlled]() transfers. Chainbills also maintains a [Specialized Relayer](#relayer) for submitting the VAAs from Wormhole [Guardians]() to the Solana program.

## Solana

### Entities (Structs)

The Chainbills program is built with the Anchor framework. It is built around 6 core entities:

- `TokenAndAmount`: A helper struct to specify a payable's configuration or record details of a payment or a withdrawal.

- `Payable`: Where payments can be made. Has a description and a configuration. Created by a host and holds balances of its payments. Is Closeable.

- `Payment`: Created when payers pay into a payable. Holds payment-related info like the payer (of course), payable, timestamp, and payment details (the paid token and amount).

- `Withdrawal`: Created when hosts withdraw money from a payable. Holds withdrawal-related info like the host (of course), payable, timestamp, and withdrawal details (the withdrawn token and its amount).

- `User`: A struct that keeps track of the counts of payables, payments, and withdrawals made by wallet addresses on Chainbills. It also stores the wallet address itself.

- `GlobalStats`: A struct that keeps track of the counts of all users, payables, payments, and withdrawals on Chainbills. It is a singleton and is involved in most methods of the Chainbills program.

### "Global"

The `GlobalStats` singleton account keeps track of all entities ever created on Chainbills. It is a PDA (Program Derived Address) whose seed is the word "global".

It is also the signer PDA for Chainbills. When payers make payments for any given token, the token gets transferred from the payers' token account for that token mint, into GlobalStats' token account for the same mint.

When hosts make withdrawals, the specified amount (minus 2% fees) is transferred from GlobalStats' token account for the requested token mint, into the hosts' token account for the same mint.

### More on the Program

## EVM

## Relayer

## Server

The server also helps with handling other off-chain processes. Specifically, Chainbills sends notification emails from within the server.

The server is a NodeJS Firebase Cloud Function that exposes endpoints for the frontend. The frontend call them after any of the 3 main entities (Payables, Payments, and Withdrawals) have been created or initialized.

Users' emails shouldn't be seen inside the blockchain. Also, we can't send an email from within the chain. These brought about the necessity of a Web2 server.

[Know more about the server here](./server)

## Frontend

## Roadmap

passing the 2% charge to the payer
