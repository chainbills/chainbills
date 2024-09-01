import { Network } from '@wormhole-foundation/sdk';
import { Withdrawal } from '../schemas';
import {
  Chain,
  evmReadContract,
  firestore,
  notifyHost,
  solanaFetch
} from '../utils';

export const withdrew = async (body: any, chain: Chain, network: Network) => {
  // Checks
  let { withdrawalId } = body;
  if (!withdrawalId) throw 'Missing required withdrawalId';

  // Ensure the withdrawal is not being recreated a second time.
  // This is necessary to prevent sending emails twice.
  const withSnap = await firestore.doc(`/withdrawals/${withdrawalId}`).get();
  if (withSnap.exists) throw 'Withdrawal has already been recorded';

  // Extract On-Chain Data
  let raw: any;
  if (chain === 'Solana') {
    raw = await solanaFetch('payable', withdrawalId, network);
  } else if (chain === 'Ethereum Sepolia') {
    if (!withdrawalId.startsWith('0x')) withdrawalId = `0x${withdrawalId}`;
    raw = await evmReadContract('withdrawals', [withdrawalId]);
  } else throw `Unsupported Chain ${chain}`;

  // Construct new Withdrawal to save.
  const withdrawal = new Withdrawal(withdrawalId, chain, network, raw);

  // Notify Host (email)
  notifyHost({ ...withdrawal, activity: 'withdrawal' });

  // Save the withdrawal to the database
  await firestore
    .doc(`/withdrawals/${withdrawalId}`)
    .set(withdrawal, { merge: true });
};
