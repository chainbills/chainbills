import { PublicKey } from '@solana/web3.js';
import { Params } from 'express';
import { isEmail } from 'validator';

import { Payable } from '../schemas/payable';
import { firestore, owner, program } from '../utils';

export const initializedPayable = async ({ address, email }: Params) => {
  if (!isEmail(email)) throw `Invalid Email: ${email}`;

  const raw = await program.account.payable.fetch(new PublicKey(address));
  const { chain, wallet } = await owner(raw.host);
  const payable = new Payable(address, chain, wallet, raw);

  // TODO: Send email to host

  await firestore
    .collection('payables')
    .doc(address)
    .set({ email, ...payable }, { merge: true });
};
