# Chainbills - Server

Chainbills is a cross-chain payment gateway that allows anyone (hosts) to receive any amount of cryptocurrency from everybody (payers), powered by WormHole. ChainBills deducts 2% from all withdrawals for fees and maintenance.

The server helps with handling some off-chain processes. Specifically, Chainbills sends notification emails from within the server.

## About

The server is a public, CORS-enabled, onRequest, Firebase Cloud Function written with TypeScript in NodeJS.

It exposes endpoints that should be called by the frontend after any of the 3 main entities (Payables, Payments, and Withdrawals) have been created or initialized.

The endpoints are:

- `/payable/:address/:email`
- `/payment/:address/:email`
- `/withdrawal/:address`

The `address` in each path of each endpoint corresponds to the PDA (Program Derived Address) of the respective entity. The email of the payable is that of its host while for the payment is that of its payer.

Hosts don't need to reprovide emails when withdrawing since an email is already attached to the payable from which they are withdrawing from its balances.

## Emails

Email Addresses are personally-identifiably information. As such, they shouldn't be on-chain together with the wallet address of users. Also, we can't send an email from within the chain. These brought about the necessity of a Web2 server: to store and send emails.

The emails are stored in Cloud Firestore. The emails of payers are not available to the hosts and vice versa.

When payers make payments, they provide email addresses. Payers receive notification emails of receipts of their payments.

When users (hosts) create payables in the frontend, they provide email addresses. They receive an email for successful payable creation. They also receive emails once a payment to or a withdrawal from their payables.
