import { PublicKey } from '@solana/web3.js';
import { Params } from 'express';
import { isEmail } from 'validator';

import { Auth, Payable } from '../schemas';
import { firestore, owner, program } from '../utils';

export const initializedPayable = async (params: Params, auth: Auth) => {
  const { address, email } = params;
  if (!isEmail(email)) throw `Invalid Email: ${email}`;

  const raw = await program(auth.solanaCluster).account.payable.fetch(
    new PublicKey(address)
  );
  const { chain, ownerWallet } = await owner(raw.host, auth.solanaCluster);
  if (auth.walletAddress !== ownerWallet) throw 'Not your payable!';

  const payable = new Payable(address, chain, ownerWallet, raw);

  // TODO: Send email to host

  await firestore
    .collection('payables')
    .doc(address)
    .set({ email, ...payable }, { merge: true });
};
