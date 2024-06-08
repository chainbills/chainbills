import { Params } from 'express';

import { Withdrawal } from '../schemas/withdrawal';
import { firestore } from '../utils/firestore';
import { owner } from '../utils/wallet';

export const withdrew = async ({ address }: Params) => {
  const raw = await program.account.withdrawal.fetch(new PublicKey(address));
  const { chain, wallet } = await owner(raw.host);
  const withdrawal = new Withdrawal(address, chain, wallet, raw);

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
