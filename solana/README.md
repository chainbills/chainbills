# Chainbills - Solana

Chainbills is a cross-chain payment gateway that allows anyone (hosts) to receive any amount of cryptocurrency from everybody (payers), powered by WormHole. ChainBills deducts 2% from all withdrawals for fees and maintenance.

## Table Of Contents

- [Entities (Structs)](#entities-structs)
  - [TokenAndAmount](#tokenandamount)
  - [Payable](#payable)
    - [Payables' Configuration](#payables-configuration)
  - [Payment](#payment)
  - [Withdrawal](#withdrawal)
  - [User](#user)
  - [GlobalStats](#global)
- ["Global"](#global)
- [Constants](#constants)
  - [MAX_PAYABLES_DESCRIPTION_LENGTH](#max_payables_description_length)
  - [MAX_PAYABLES_TOKENS](#max_payables_tokens)
- [Checks and Errors](#checks-and-errors)
- [Program Methods](#program-methods)
  - [initialize_user](#initialize_user)
  - [initialize_payable](#initialize_payable)
  - [close_payable](#close_payable)
  - [reopen_payable](#reopen_payable)
  - [update_payable_description](#update_payable_description)
  - [pay](#pay)
  - [withdraw](#withdraw)
- [Admin-Only Methods](#admin-methods)
  - [initialize_global_stats](#initialize_global_stats)
  - [admin_withdraw](#admin_withdraw)
- [Wormhole](#wormhole)

## Entities (Structs)

The Chainbills program is built with the Anchor framework. It is built around 6 core entities:

### TokenAndAmount

### Payable

Where payments can be made. Has a description and a configuration. Created by a host and holds balances of its payments. Is Closeable.

Payables also keep a `host_count`. This represents the nth Payable that the host created. They also have a `payments_count` and a `withdrawals_count`. Both keep track of the respective entity related to a given payable.

As a PDA (Program Derived Address), its seeds are:

- The wallet address of the host creating the Payable,
- The keyword "payable", and
- The host_count of the payable at the time it was created. (There is no zeroth payable).

Hosts can update payables' description. They can also update the `is_closed` status of a payable: marking them as closed or re-opening them.

Asides from the description and close status, no other property is updateable in a Payable. Well, that's besides the continuously incrementing payables_count and withdrawals_count.

Payables have a balances property. It is a Vector of [TokenAndAmount](#tokenandamount)s. It gets updated when payments and withdrawals are made on a payable.

Payables can't be deleted.

#### Payables' Configuration

### Payment

Created when payers pay into a payable. Holds payment-related info like the payer (of course), payable, timestamp, and payment details (the paid [TokenAndAmount](#tokenandamount)).

Payments also keep a `payer_count`. This represents the nth Payment made by the payer. They also have a `payable_count` which is the nth count on payments on the payable at the point of paying.

As a PDA (Program Derived Address), its seeds are:

- The wallet address of the payer making the Payment,
- The word "payment", and
- The payer_count of the payment at the time it was made. (There is no zeroth payment).

Payments are initialized when a user (the payer) successfully pays into a payable. They neither get updated nor deleted.

### Withdrawal

Created when hosts withdraw money from a payable. Holds withdrawal-related info like the host (of course), payable, timestamp, and withdrawal details (the withdrawn [TokenAndAmount](#tokenandamount)).

Withdrawals, like Payables keep a `host_count`: the nth withdrawal by the host of the payable from which the withdrawal was made. They also keep a `payable_count`: the nth withdrawal on that payable.

As a PDA (Program Derived Address), its seeds are:

- The wallet address of the host creating the Payable,
- The keyword "payable", and
- The host_count of the withdrawal at the time it was done. (There is no zeroth withdrawal).

### User

A struct that keeps track of the counts of payables, payments, and withdrawals made by wallet addresses on Chainbills. It also stores the wallet address itself.

It increments the appropriate entity, when that entity gets initialized by a user. User must be initialized before it could be used as a host or a payer in Chainbills.

As a PDA (Program Derived Address), the seed for a user is the wallet address of the "real-world" user.

### GlobalStats

A struct that keeps track of the counts of all users, payables, payments, and withdrawals on Chainbills. It is a singleton and is involved in most methods of the Chainbills program.

Every Entity or Struct above has a `global_count`: the nth of that struct when its account was initialized. This is equal the count of that entity in GlobalStats when it was initialized.

As a PDA (Program Derived Address), the seed for GlobalStats is the word "global".

## "Global"

The `GlobalStats` singleton account keeps track of all entities ever created on Chainbills. It is a PDA (Program Derived Address) whose seed is the word "global".

It keeps the count of all entities ever created on Chainbills. The appropriate count for each entity gets incremented when the entity gets initialized. Specifically, when:

- a user is initialized,
- a payable is created,
- a payment is made,
- a withdrawal is made,

the count for the right entity gets incremented in GlobalStats.

The GlobalStats account is also the signer PDA for Chainbills. When payers make payments for any given token, the token gets transferred from the payers' token account for that token mint, into GlobalStats' token account for the same mint.

When hosts make withdrawals, the specified amount (minus 2% fees) is transferred from GlobalStats' token account for the requested token mint, into the hosts' token account for the same mint.

### Constants

#### MAX_PAYABLES_DESCRIPTION_LENGTH

#### MAX_PAYABLES_TOKENS

### Checks and Errors

### Program Methods

#### initialize_user

#### initialize_payable

#### close_payable

#### reopen_payable

#### update_payable_description

#### pay

#### withdraw

### Admin-Only Methods

#### initialize_global_stats

#### admin_withdraw

## Wormhole
