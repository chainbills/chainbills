# Chainbills

Chainbills is a cross-chain payment gateway that allows anyone (hosts) to receive cryptocurrency from everybody (payers), powered by WormHole. Chainbills deducts 2% (with a fixed maximum) from all withdrawals for fees and maintenance.

## Table Of Contents

- [Features](#features)
  - [About Payables](#about-payables)
  - [Payables' Configuration](#payables-configuration)
  - [Hosts' Controls](#hosts-controls)
  - [Payers' Experience](#payers-experience)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
  - [EVM](#evm)
  - [Solana](#solana)
  - [CosmWasm](#cosmwasm)
- [Server](#server)
- [Frontend](#frontend)
- [Roadmap](#roadmap)
- [Community](#community)

## Features

### About Payables

Anyone can connect their wallet on chainbills and create a _Payable_.

A payable is like a public invoice through which anybody can pay to. Users that create payables are the hosts of those payables. Whereas, users that make payments to payables are their payers. Hosts can view the balances of their payables and can withdraw at anytime. However, Chainbills deducts 2% from all withdrawals for fees and maintenance.

On the dashboard on the frontend, hosts can view all the payables they created and can withdraw from anyone that has a positive balance.

### Payables' Configuration

Chainbills gives you the basic flexibility you need in payables. A payable can either allow free payments or specify the amount of a token that can be paid to it.

If a payable allows free payments, then that payable can't enforce any accepted tokens and amounts. On the other hand, if the host provides a list of allowed token and amount pairs, then the pairs are enforced during payments. That is all payments must be of that token and amount.

When creating a payable, you can set it to allow free payment or you specified the allowed tokens and amounts. You can always update this at any time.

Asides from payment flexibility, you can set auto-withdrawal status on your payables. That is make payments to them to be auto-withdrawn to your wallet without your coming to Chainbills to withdraw. You can always update this later.

### Hosts' Controls

When creating a Payable, the host provides a description of that payable. The description is displayed to payers when they want to make payments on payables. Also, the description is also displayed on the receipt of payments to payable.

A host can close any payable they own. That is, they can stop payables from accepting payments. A host can also reopen any closed payable.

Asides from updating the close status of a payable, a host can update the description of their payable. Please do this with caution to ensure smooth payer experience.

### Payers' Experience

Anyone can visit the payment link of a payable and make payment there.

While making a payment to a payable that allows free payments, the payer can choose any token (from those provided), input any amount greater than zero, and pay.

If the payable specified only one accepted token (and its amount), the payer pays just that. If multiple tokens (and amounts) were specified in a payable, the payer can select which to pay and then pay.

After a successful payment, Chainbills generates a receipt with the payment's details and redirects the payer to the receipt link. Receipts are public. Hosts and payers can view receipts at anytime.

## Architecture

Chainbills permits the same activity set across multiple chains.

For now Ethereum Sepolia (EVM), Solana Devnet (Solana) are supported. More chains will be added.

Our mission is to provide a seamless payment-receiving experience to content creators, merchants, and foundations. To enable them receive money for donations, products, and services from a large user base (across multiple chains). Chainbills also makes money easy by providing all these payments in one dashboard.

Chainbills does this by allowing users to create payables and make payments and withdrawals on all chain networks (supported ones for now). So a payable can be created on any chain. Withdrawals are on the same chain in which the Payable was created. However, with payments, a payment can be done from the same or different chain as that of the Payable.

When the blockchain networks of the payable and the payer are the same, no cross-chain activity is needed and payment proceeds directly. However, in the case of different chains, we need to reconcile money and data across the invovled chains. This is powered by Wormhole and Circle.

[Wormhole](https://wormhole.com) is an open source blockchain development platform connecting the decentralized web. Wormhole powers Chainbills by enabling [cross-chain messaging](https://wormhole.com/messaging/) for data transfers. [Circle](https://www.circle.com/) mints and maintains [USDC](https://www.circle.com/usdc) across multiple blockchain networks through [CCTP (Cross-Chain Transfer Protocol)](https://www.circle.com/cross-chain-transfer-protocol). CCTP also powers Chainbills by enabling USDC transfers across chains.

Currently the cross-chain features are in active development and testing. Stay tuned for when they will be rolled out.

Asides from the cross-chain features, the overall data architecture of Chainbills is consistent across all parts of the code (various smart contract formats, frontend, and server). Read more about [Chainbills' architecture here](./ARCHITECTURE.md).

## Smart Contracts

The basic logic of Chainbills smart contract revolves around payables, payments, and withdrawals. In addition, we have other data types that help with governance and data control in the contracts.

There was best effort in replicating the same contract logic across the various blockchain network formats that we support, which are:

- EVM (Ethereum Virtual Machine) compatible chains,
- Solana, and
- Cosmos.

### EVM

We intend deploying our contracts on the multiple EVM chains to streamline payments for everybody. EVM contracts are written in Solidity. We use [foundry](https://book.getfoundry.sh/) to build, test, and deploy the EVM contracts.

Solidity has its design patterns and security best practices when it comes to Web3 development. We followed most paying attention to details especially as money is involved.

The Chainbills EVM contract is an upgradable contract with the ERC1967 proxy spec with OpenZeppelin. It also uses Wormhole's Solidity SDK for cross-chain architectures. Find out more in the [`evm` subdirectory](./evm).

### Solana

We support [Solana](https://solana.com) as it was the first chain on which Chainbills was born. Solana uses Rust for smart contracts (or programs). Chainbills uses the [Anchor framework](https://anchor-lang.com) for Solana contracts.

Solana's design patterns involves creating PDAs (Program Derived Accounts) for storing data in contrast to Solidity's mappings. Anchor uses `account contexts` to enforce constraints on the PDAs. We use them at best effort in the Chainbills Solana contract. Know more in the [`solana` subdirectory](./solana).

### CosmWasm

[Cosmos](https://cosmos.network/) allow you to build blockchains that can co-interact with the [IBC protocol](https://cosmos.network/ibc/). So just like there are multiple EVM-compatible chains, there are also many Cosmos-based blockchain networks.

Cosmos chains use [CosmWasm](https://cosmos.network/cosmwasm) (WebAssembly) for smart contracts. These cosmwasm contracts are also written in Rust like Solana. However, they have a similarity with EVM/Solidity in that they use a `mappings`-like way to store data and smart contract state.

Chainbills also has a cosmwasm contract built with the [Sylvia](https://cosmwasm.cosmos.network/sylvia) framework. Chainbills' features are split around `query` and `execute` method calls as CosmWasm expects. Find out more in the [`cosmwasm` subdirectory].

## Server

The server helps with handling other off-chain processes. Specifically, Chainbills keeps track of payables and descriptions in the server and sends browser notifications from there.

The server is a NodeJS Firebase Cloud Function that exposes endpoints for the frontend. The frontend call them after any of the main entities (Payables, Payments, and Withdrawals) have been created or initialized.

One important thing about the server is keeping track of all payables from any chain. So instead of the frontend to guess the chain on which the payable was created (when the payable's page is visited), the server records the chain alongside the payable ID during the payable's creation and returns those when queried.

Find out more information at the [`server` subdirectory](./server).

## Frontend

Chainbills' frontend is built with [Vue](https://vuejs.org), [TailwindCSS](https://tailwindcss.com), and [PrimeVue](https://primevue.org) components. It is user-friendly well-responsive web app that suits your payable, payments, and withdrawal needs. Find out more at the [`frontend` subdirectory](./frontend).

## Roadmap

- Completing Cross-Chain Architecture.

- Making widgets or embeddables that hosts can add to their websites.

- Enabling subscription payments for hosts.

## Community

We believe in community and know the value of our users and contributors. Join us in our [Discord](http://discord.chainbills.xyz/). Follow us on [X (Twitter)](https://x.com/chainbills_xyz). Feel free to contribute features here too. Cheers!
