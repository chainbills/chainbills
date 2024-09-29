import { Network } from '@wormhole-foundation/sdk';
import { UserPayment } from '../schemas';
import {
  Chain,
  cosmwasmFetch,
  devDb,
  evmFetchUserPayment,
  prodDb,
  solanaFetch
} from '../utils';

export const userPaid = async (
  paymentId: string,
  chain: Chain,
  network: Network
) => {
  // Set Database based on Network mode
  const db = network === 'Mainnet' ? prodDb : devDb;

  // Ensure the payment is not being recreated a second time.
  // This is necessary to prevent sending emails twice.
  let paymentSnap = await db.doc(`/userPayments/${paymentId}`).get();
  if (paymentSnap.exists) throw 'Payment has already been recorded';

  // Repeating the search with lowercase equivalent to account for HEX addresses
  paymentSnap = await db.doc(`/userPayments/${paymentId.toLowerCase()}`).get();
  if (paymentSnap.exists) throw 'Payment has already been recorded';

  // Extract On-Chain Data
  let raw: any;
  if (chain === 'Solana') {
    raw = await solanaFetch('userPayment', paymentId, network);
  } else if (chain === 'Ethereum Sepolia') {
    raw = await evmFetchUserPayment(paymentId);
    paymentId = paymentId.toLowerCase();
  } else if (chain === 'Burnt Xion') {
    raw = await cosmwasmFetch('user_payment', paymentId);
    paymentId = paymentId.toLowerCase();
  } else throw `Unsupported Chain ${chain}`;

  // Construct new UserPayment to save.
  const payment = new UserPayment(paymentId, chain, network, raw);

  // TODO: Send email to payer. Fetch from saved user profile

  // Save the userPayment to the database
  await db
    .doc(`/userPayments/${paymentId}`)
    .set({ ...payment }, { merge: true });
};
