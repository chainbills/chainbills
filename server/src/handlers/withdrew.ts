import { Withdrawal } from '../schemas';
import {
  Chain,
  evmFetch,
  getFirestore,
  notifyHost,
  solanaFetch
} from '../utils';

export const withdrew = async (withdrawalId: string, chain: Chain) => {
  // Set Database based on Chain Name
  const db = getFirestore(chain.name);

  // Ensure the withdrawal is not being recreated a second time.
  // This is necessary to prevent sending emails twice.
  let withDSnap = await db.doc(`/withdrawals/${withdrawalId}`).get();
  if (withDSnap.exists) throw 'Withdrawal has already been recorded';

  // Repeating the search with lowercase equivalent to account for EVM addresses
  withDSnap = await db.doc(`/withdrawals/${withdrawalId.toLowerCase()}`).get();
  if (withDSnap.exists) throw 'Withdrawal has already been recorded';

  // Extract On-Chain Data
  let raw: any;
  if (chain.isEvm) {
    raw = await evmFetch('Withdrawal', withdrawalId, chain.name);
    withdrawalId = withdrawalId.toLowerCase();
  } else if (chain.isSolana)
    raw = await solanaFetch('withdrawal', withdrawalId);
  else throw `Unsupported Chain ${chain.name}`;

  // Construct new Withdrawal to save.
  const withdrawal = new Withdrawal(withdrawalId, chain, raw);

  // Notify Host (email)
  notifyHost({ ...withdrawal, activity: 'withdrawal' });

  // Save the withdrawal to the database
  await db.doc(`/withdrawals/${withdrawalId}`).set({ ...withdrawal });
};
