import { PublicKey } from '@solana/web3.js';
import { Body } from 'express';
import { isEmail } from 'validator';

import { Auth, Payable } from '../schemas';
import { firestore, owner, program } from '../utils';

export const initializedPayable = async (body: Body, auth: Auth) => {
  const { payableId, email } = body;
  if (!isEmail(email)) throw `Invalid Email: ${email}`;

  const raw = await program(auth.solanaCluster).account.payable.fetch(
    new PublicKey(payableId)
  );
  const { chain, ownerWallet } = await owner(raw.host, auth.solanaCluster);
  if (auth.walletAddress !== ownerWallet) throw 'Not your payable!';

  const payable = new Payable(payableId, chain, ownerWallet, raw);

  // TODO: Send email to host

  await firestore
    .collection('payables')
    .doc(payableId)
    .set({ email, ...payable }, { merge: true });
};
