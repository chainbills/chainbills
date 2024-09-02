import { Network } from '@wormhole-foundation/sdk';
import { PayablePayment } from '../schemas';
import {
  Chain,
  evmFetchPayablePayment,
  firestore,
  notifyHost,
  solanaFetch
} from '../utils';

export const payablePaid = async (
  body: any,
  chain: Chain,
  network: Network
) => {
  // Checks
  let { paymentId } = body;
  if (!paymentId) throw 'Missing required paymentId';
  if (typeof paymentId !== 'string') throw 'Invalid paymentId';
  paymentId = paymentId.trim();

  // Ensure the payment is not being recreated a second time.
  // This is necessary to prevent sending emails twice.
  let paidSnap = await firestore.doc(`/payablePayments/${paymentId}`).get();
  if (paidSnap.exists) throw 'Payment has already been recorded';

  // Repeating the search with lowercase equivalent to account for EVM addresses
  paidSnap = await firestore
    .doc(`/payablePayments/${paymentId.toLowerCase()}`)
    .get();
  if (paidSnap.exists) throw 'Payment has already been recorded';

  // Extract On-Chain Data
  let raw: any;
  if (chain === 'Solana') {
    raw = await solanaFetch('payablePayment', paymentId, network);
  } else if (chain === 'Ethereum Sepolia') {
    raw = await evmFetchPayablePayment(paymentId);
    paymentId = paymentId.toLowerCase();
  } else throw `Unsupported Chain ${chain}`;

  // Construct new UserPayment to save.
  const payment = new PayablePayment(paymentId, chain, network, raw);

  // Notify Host (browser and email)
  notifyHost({ ...payment, activity: 'payment' });

  // Save the userPayment to the database
  await firestore
    .doc(`/payablePayments/${paymentId}`)
    .set({ ...payment }, { merge: true });
};
