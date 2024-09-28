import { Network } from '@wormhole-foundation/sdk';
import { Withdrawal } from '../schemas';
import {
  Chain,
  devDb,
  evmFetchWithdrawal,
  notifyHost,
  prodDb,
  solanaFetch
} from '../utils';

export const withdrew = async (
  withdrawalId: string,
  chain: Chain,
  network: Network
) => {
  // Set Database based on Network mode
  const db = network === 'Mainnet' ? prodDb : devDb;

  // Ensure the withdrawal is not being recreated a second time.
  // This is necessary to prevent sending emails twice.
  let withDSnap = await db.doc(`/withdrawals/${withdrawalId}`).get();
  if (withDSnap.exists) throw 'Withdrawal has already been recorded';

  // Repeating the search with lowercase equivalent to account for EVM addresses
  withDSnap = await db.doc(`/withdrawals/${withdrawalId.toLowerCase()}`).get();
  if (withDSnap.exists) throw 'Withdrawal has already been recorded';

  // Extract On-Chain Data
  let raw: any;
  if (chain === 'Solana') {
    raw = await solanaFetch('withdrawal', withdrawalId, network);
  } else if (chain === 'Ethereum Sepolia') {
    raw = await evmFetchWithdrawal(withdrawalId);
    withdrawalId = withdrawalId.toLowerCase();
  } else throw `Unsupported Chain ${chain}`;

  // Construct new Withdrawal to save.
  const withdrawal = new Withdrawal(withdrawalId, chain, network, raw);

  // Notify Host (email)
  notifyHost({ ...withdrawal, activity: 'withdrawal' });

  // Save the withdrawal to the database
  await db
    .doc(`/withdrawals/${withdrawalId}`)
    .set({ ...withdrawal }, { merge: true });
};
