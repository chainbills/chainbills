import { PublicKey } from '@solana/web3.js';

import { Auth, Withdrawal } from '../schemas';
import { firestore, owner, program } from '../utils';

export const withdrew = async (params: Params, auth: Auth) => {
  const { address } = params;
  const raw = await program(auth.solanaCluster).account.withdrawal.fetch(
    new PublicKey(address)
  );
  const { chain, ownerWallet } = await owner(raw.host, auth.solanaCluster);
  if (auth.walletAddress !== ownerWallet) throw 'Not your withdrawal!';

  const withdrawal = new Withdrawal(address, chain, ownerWallet, raw);
  const payableSnap = await firestore
    .collection('payables')
    .doc(withdrawal.payable)
    .get();
  if (!payableSnap.exists) throw `Unknown Payable: ${withdrawal.payable}`;
  const { email } = payableSnap.data();

  // TODO: Send email to host

  await firestore
    .collection('withdrawals')
    .doc(address)
    .set({ email, ...withdrawal }, { merge: true });
};
