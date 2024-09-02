import { Network } from '@wormhole-foundation/sdk';
import { Withdrawal } from '../schemas';
import {
  Chain,
  evmFetchWithdrawal,
  firestore,
  notifyHost,
  solanaFetch
} from '../utils';

export const withdrew = async (body: any, chain: Chain, network: Network) => {
  // Checks
  let { withdrawalId } = body;
  if (!withdrawalId) throw 'Missing required withdrawalId';
  if (typeof withdrawalId !== 'string') throw 'Invalid withdrawalId';
  withdrawalId = withdrawalId.trim();

  // Ensure the withdrawal is not being recreated a second time.
  // This is necessary to prevent sending emails twice.
  let withDSnap = await firestore.doc(`/withdrawals/${withdrawalId}`).get();
  if (withDSnap.exists) throw 'Withdrawal has already been recorded';

  // Repeating the search with lowercase equivalent to account for EVM addresses
  withDSnap = await firestore
    .doc(`/userPayments/${withdrawalId.toLowerCase()}`)
    .get();
  if (withDSnap.exists) throw 'Withdrawal has already been recorded';

  // Extract On-Chain Data
  let raw: any;
  if (chain === 'Solana') {
    raw = await solanaFetch('payable', withdrawalId, network);
  } else if (chain === 'Ethereum Sepolia') {
    raw = await evmFetchWithdrawal(withdrawalId);
    withdrawalId = withdrawalId.toLowerCase();
  } else throw `Unsupported Chain ${chain}`;

  // Construct new Withdrawal to save.
  const withdrawal = new Withdrawal(withdrawalId, chain, network, raw);

  // Notify Host (email)
  notifyHost({ ...withdrawal, activity: 'withdrawal' });

  // Save the withdrawal to the database
  await firestore
    .doc(`/withdrawals/${withdrawalId}`)
    .set({ ...withdrawal }, { merge: true });
};
