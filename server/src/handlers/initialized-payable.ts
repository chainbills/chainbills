import { PublicKey } from '@solana/web3.js';
import { isEmail } from 'validator';

import { Auth, Payable } from '../schemas';
import { firestore, owner, program } from '../utils';

export const initializedPayable = async (body: any, auth: Auth) => {
  const { payableId, email } = body;
  if (!isEmail(email)) throw `Invalid Email: ${email}`;
  if (!payableId) throw 'Missing required payableId';

  const raw = await program(auth.solanaCluster).account.payable.fetch(
    new PublicKey(payableId)
  );
  const { chain, ownerWallet } = await owner(raw.host, auth.solanaCluster);
  if (auth.walletAddress !== ownerWallet) throw 'Not your payable!';

  const payable = new Payable(payableId, chain, ownerWallet, raw);

  // TODO: Send email to host

  await firestore
    .doc(`/payables/${payableId}`)
    .set({ email, ...payable }, { merge: true });
};
