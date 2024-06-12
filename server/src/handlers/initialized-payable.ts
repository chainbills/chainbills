import { PublicKey } from '@solana/web3.js';
import { Network } from '@wormhole-foundation/sdk';
import { isEmail } from 'validator';

import { Auth, Payable } from '../schemas';
import { firestore, owner, program } from '../utils';

export const initializedPayable = async (
  body: any,
  auth: Auth,
  network: Network
) => {
  const { payableId, email } = body;
  if (!isEmail(email)) throw `Invalid Email: ${email}`;
  if (!payableId) throw 'Missing required payableId';

  const raw = await program(network).account.payable.fetch(
    new PublicKey(payableId)
  );
  const { chain, ownerWallet } = await owner(raw.host, network);
  if (auth.walletAddress !== ownerWallet) throw 'Not your payable!';

  const payable = new Payable(payableId, chain, network, ownerWallet, raw);

  // TODO: Send email to host

  await firestore
    .doc(`/payables/${payableId}`)
    .set({ email, ...payable }, { merge: true });
};
