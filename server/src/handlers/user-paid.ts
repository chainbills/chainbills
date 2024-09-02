import { Network } from '@wormhole-foundation/sdk';
import { isEmail } from 'validator';

import { UserPayment } from '../schemas';
import {
  Chain,
  devDb,
  evmFetchUserPayment,
  prodDb,
  solanaFetch
} from '../utils';

export const userPaid = async (
  body: any,
  chain: Chain,
  walletAddress: string,
  network: Network
) => {
  // Checks
  let { paymentId, email: payerEmail } = body;
  if (!isEmail(payerEmail)) throw `Invalid Email: ${payerEmail}`;
  if (!paymentId) throw 'Missing required paymentId';
  if (typeof paymentId !== 'string') throw 'Invalid paymentId';
  paymentId = paymentId.trim();

  // Set Database based on Network mode
  const db = network === 'Mainnet' ? prodDb : devDb;

  // Ensure the payment is not being recreated a second time.
  // This is necessary to prevent sending emails twice.
  let paymentSnap = await db.doc(`/userPayments/${paymentId}`).get();
  if (paymentSnap.exists) throw 'Payment has already been recorded';

  // Repeating the search with lowercase equivalent to account for EVM addresses
  paymentSnap = await db.doc(`/userPayments/${paymentId.toLowerCase()}`).get();
  if (paymentSnap.exists) throw 'Payment has already been recorded';

  // Extract On-Chain Data
  let raw: any;
  if (chain === 'Solana') {
    raw = await solanaFetch('userPayment', paymentId, network);
  } else if (chain === 'Ethereum Sepolia') {
    raw = await evmFetchUserPayment(paymentId);
    paymentId = paymentId.toLowerCase();
  } else throw `Unsupported Chain ${chain}`;

  // Construct new UserPayment to save.
  const payment = new UserPayment(paymentId, chain, network, raw);

  // Reject the process if the authenticated user is not the payer
  if (walletAddress !== payment.payer) throw 'Not your payable!';

  // TODO: Send email to payer

  // Save the userPayment to the database
  await db
    .doc(`/userPayments/${paymentId}`)
    .set({ email: payerEmail, ...payment }, { merge: true });
};
