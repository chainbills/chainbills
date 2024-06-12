import { PublicKey } from '@solana/web3.js';

import { Auth, Withdrawal } from '../schemas';
import { firestore, owner, program } from '../utils';

export const withdrew = async (body: any, auth: Auth) => {
  const { withdrawalId } = body;
  if (!withdrawalId) throw 'Missing required withdrawalId';

  const raw = await program(auth.solanaCluster).account.withdrawal.fetch(
    new PublicKey(withdrawalId)
  );
  const { chain, ownerWallet } = await owner(raw.host, auth.solanaCluster);
  if (auth.walletAddress != ownerWallet) throw 'Not your withdrawal!';

  const withdrawal = new Withdrawal(withdrawalId, chain, ownerWallet, raw);
  const payableId = withdrawal.payable;
  const payableSnap = await firestore.doc(`/payables/${payableId}`).get();
  if (!payableSnap.exists) throw `Unknown Payable: ${payableId}`;
  const { email } = payableSnap.data();

  // TODO: Send email to host

  await firestore
    .doc(`/withdrawals/${withdrawalId}`)
    .set({ email, ...withdrawal }, { merge: true });
};
