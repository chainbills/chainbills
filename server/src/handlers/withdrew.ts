import { PublicKey } from '@solana/web3.js';
import { Network } from '@wormhole-foundation/sdk';

import { Auth, Withdrawal } from '../schemas';
import { firestore, owner, program } from '../utils';

export const withdrew = async (body: any, auth: Auth, network: Network) => {
  const { withdrawalId } = body;
  if (!withdrawalId) throw 'Missing required withdrawalId';

  const raw = await program(network).account.withdrawal.fetch(
    new PublicKey(withdrawalId)
  );
  const { chain, ownerWallet } = await owner(raw.host, network);
  if (auth.walletAddress != ownerWallet) throw 'Not your withdrawal!';

  const withdrawal = new Withdrawal(
    withdrawalId,
    chain,
    network,
    ownerWallet,
    raw
  );
  const payableId = withdrawal.payable;
  const payableSnap = await firestore.doc(`/payables/${payableId}`).get();
  if (!payableSnap.exists) throw `Unknown Payable: ${payableId}`;
  const { email } = payableSnap.data();

  // TODO: Send email to host

  await firestore
    .doc(`/withdrawals/${withdrawalId}`)
    .set({ email, ...withdrawal }, { merge: true });
};
