# Chainbills - Solana

Chainbills is a cross-chain payment gateway that allows anyone (hosts) to receive any amount of cryptocurrency from everybody (payers), powered by WormHole. Chainbills deducts 2% from all withdrawals for fees and maintenance.

## Entities (Structs)

The Chainbills program is built with the Anchor framework. It is built around 6 core entities:

### TokenAndAmount

Holds details of a transaction. Contains the Pubkey mint of the token involved in the transaction alongside the amount (with decimals) that is involved. This struct is used in Payments and Withdrawals. It is also used in Payables to specify the allowed tokens and amounts that can be used to make payments. When a native token is used in a transaction, the mint is the program ID (or contract address).

### Payable

Where payments can be made. Created by a host and holds balances of its payments. Is Closeable. Specifies its accepted TokensAndAmounts. If the TokensAndAmounts array/vector is empty, then the given payable allows free payments.

Payables also keep a `host_count`. This represents the nth Payable that the host created. They also have a `payments_count` and a `withdrawals_count`. Both keep track of the respective entity related to a given payable.

As a PDA (Program Derived Address), its seeds are:

- The wallet address of the host creating the Payable,
- The keyword "payable", and
- The host_count of the payable at the time it was created. (There is no zeroth payable).

Hosts can update the `is_closed` status of a payable: marking them as closed or re-opening them. They can also update the `tokens_and_amounts` on their payables.

Payables have a balances property. It is a Vector of [TokenAndAmount](#tokenandamount)s. It gets updated when payments and withdrawals are made on a payable.

Payables can't be deleted.

### Payment

Created when payers pay into a payable. Holds payment-related info like the payer (of course), payable, timestamp, and payment details (the paid [TokenAndAmount](#tokenandamount)).

Payments also keep a `payer_count`. This represents the nth Payment made by the payer. They also have a `payable_count` which is the nth count on payments on the payable at the point of paying.

As a PDA (Program Derived Address), its seeds are:

- The wallet address of the payer making the Payment,
- The word "payment", and
- The payer_count of the payment at the time it was made. (There is no zeroth payment).

Payments are created when a user (the payer) successfully pays into a payable. They neither get updated nor deleted.

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

### ChainStats

A struct that keeps track of the counts of all users, payables, payments, and withdrawals on Chainbills in each chain. It is a singleton and is involved in most methods of the Chainbills program in Solana.

Every Entity or Struct above has a `chain_count`: the nth of that struct when its account was initialized or created in the chain. This is equal the count of that entity in ChainStats when it was initialized or created.

As a PDA (Program Derived Address), the seed for ChainStats is the word "chain" and the Wormhole Chain ID of Solana.

The ChainStats account is also the signer PDA for Chainbills. When payers make payments for any given token, the token gets transferred from the payers' token account for that token mint, into ChainStats' token account for the same mint.

When hosts make withdrawals, the specified amount (minus 2% fees - with a maximum fee) is transferred from ChainStats' token account for the requested token mint, into the hosts' token account for the same mint.
