import { UserPayment } from '../schemas';
import { Chain, evmFetch, getFirestore, solanaFetch } from '../utils';

export const userPaid = async (paymentId: string, chain: Chain) => {
  // Set Database based on Chain Name
  const db = getFirestore(chain.name);

  // Ensure the payment is not being recreated a second time.
  // This is necessary to prevent sending emails twice.
  let paymentSnap = await db.doc(`/userPayments/${paymentId}`).get();
  if (paymentSnap.exists) throw 'Payment has already been recorded';

  // Repeating the search with lowercase equivalent to account for HEX addresses
  paymentSnap = await db.doc(`/userPayments/${paymentId.toLowerCase()}`).get();
  if (paymentSnap.exists) throw 'Payment has already been recorded';

  // Extract On-Chain Data
  let raw: any;
  if (chain.isEvm) {
    raw = await evmFetch('UserPayment', paymentId);
    paymentId = paymentId.toLowerCase();
  } else if (chain.isSolana) raw = await solanaFetch('userPayment', paymentId);
  else throw `Unsupported Chain ${chain.name}`;

  // Construct new UserPayment to save.
  const payment = new UserPayment(paymentId, chain, raw);

  // TODO: Send email to payer. Fetch from saved user profile

  // Save the userPayment to the database
  await db.doc(`/userPayments/${paymentId}`).set({ ...payment });
};
