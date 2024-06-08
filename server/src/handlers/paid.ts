import { PublicKey } from '@solana/web3.js';
import { Params } from 'express';
import { isEmail } from 'validator';

import { Auth, Payment } from '../schemas';
import { firestore, owner, program } from '../utils';

export const paid = async (params: Params, auth: Auth) => {
  const { address, email } = params;
  if (!isEmail(email)) throw `Invalid Email: ${email}`;

  const raw = await program(auth.solanaCluster).account.payment.fetch(
    new PublicKey(address)
  );
  const { chain, ownerWallet } = await owner(raw.payer, auth.solanaCluster);
  if (auth.walletAddress !== ownerWallet) throw 'Not your payment!';

  const payment = new Payment(address, chain, ownerWallet, raw);

  // TODO: Send email to payer

  await firestore
    .collection('payments')
    .doc(address)
    .set({ email, ...payment }, { merge: true });
};
