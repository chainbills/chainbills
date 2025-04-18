import { PayablePayment } from '../schemas';
import {
  Chain,
  evmFetch,
  getFirestore,
  notifyHost,
  solanaFetch
} from '../utils';

export const payablePaid = async (paymentId: string, chain: Chain) => {
  // Set Database based on Chain Name
  const db = getFirestore(chain.name);

  // Ensure the payment is not being recreated a second time.
  // This is necessary to prevent sending emails twice.
  let paidSnap = await db.doc(`/payablePayments/${paymentId}`).get();
  if (paidSnap.exists) throw 'Payment has already been recorded';

  // Repeating the search with lowercase equivalent to account for HEX addresses
  paidSnap = await db.doc(`/payablePayments/${paymentId.toLowerCase()}`).get();
  if (paidSnap.exists) throw 'Payment has already been recorded';

  // Extract On-Chain Data
  let raw: any;
  if (chain.isEvm) {
    raw = await evmFetch('PayablePayment', paymentId);
    paymentId = paymentId.toLowerCase();
  } else if (chain.isSolana)
    raw = await solanaFetch('payablePayment', paymentId);
  else throw `Unsupported Chain ${chain.name}`;

  // Construct new UserPayment to save.
  const payment = new PayablePayment(paymentId, chain, raw);

  // Notify Host (browser and email)
  notifyHost({ ...payment, activity: 'payment' });

  // Save the userPayment to the database
  await db.doc(`/payablePayments/${paymentId}`).set({ ...payment });
};
