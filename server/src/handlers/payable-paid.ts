import { Network } from '@wormhole-foundation/sdk';
import { PayablePayment } from '../schemas';
import {
  Chain,
  evmReadContract,
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
  paymentId = paymentId.toLowerCase().trim();

  // Ensure the payment is not being recreated a second time.
  // This is necessary to prevent sending emails twice.
  const paidSnap = await firestore.doc(`/payablePayments/${paymentId}`).get();
  if (paidSnap.exists) throw 'Payment has already been recorded';

  // Extract On-Chain Data
  let raw: any;
  if (chain === 'Solana') {
    raw = await solanaFetch('userPayment', paymentId, network);
  } else if (chain === 'Ethereum Sepolia') {
    raw = await evmReadContract('userPayments', [paymentId]);
  } else throw `Unsupported Chain ${chain}`;

  // Construct new UserPayment to save.
  const payment = new PayablePayment(paymentId, chain, network, raw);

  // Notify Host (browser and email)
  notifyHost({ ...payment, activity: 'payment' });

  // Save the userPayment to the database
  await firestore
    .doc(`/payablePayments/${paymentId}`)
    .set(payment, { merge: true });
};
