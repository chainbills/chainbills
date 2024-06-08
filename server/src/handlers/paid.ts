import { Params } from 'express';
import { isEmail } from 'validator';

import { Payment } from '../schemas/payment';
import { firestore } from '../utils/firestore';
import { owner } from '../utils/wallet';

export const paid = async ({ address, email }: Params) => {
  if (!isEmail(email)) throw `Invalid Email: ${email}`;

  const raw = await program.account.payment.fetch(new PublicKey(address));
  const { chain, wallet } =  await owner(raw.payer);
  const payment = new Payment(address, chain, wallet, raw);

  // TODO: Send email to payer

  await firestore
    .collection('payments')
    .doc(address)
    .set({ email, ...payment }, { merge: true });
};
