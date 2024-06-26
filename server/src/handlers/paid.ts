import { PublicKey } from '@solana/web3.js';
import { Network } from '@wormhole-foundation/sdk';
import { isEmail } from 'validator';

import { Auth, Payment } from '../schemas';
import { firestore, notify, owner, program } from '../utils';

export const paid = async (body: any, auth: Auth, network: Network) => {
  const { paymentId, email: payerEmail } = body;
  if (!isEmail(payerEmail)) throw `Invalid Email: ${payerEmail}`;
  if (!paymentId) throw 'Missing required paymentId';

  const raw = await program(network).account.payment.fetch(
    new PublicKey(paymentId)
  );
  const { chain, ownerWallet } = await owner(raw.payer, network);
  if (auth.walletAddress != ownerWallet) throw 'Not your payment!';

  const payment = new Payment(paymentId, chain, network, ownerWallet, raw);

  // TODO: Send email to payer

  await firestore
    .doc(`/payments/${paymentId}`)
    .set({ email: payerEmail, ...payment }, { merge: true });

  const payableId = payment.payable;
  const payableSnap = await firestore.doc(`/payables/${payableId}`).get();
  if (payableSnap.exists) {
    const { email: hostEmail, hostWallet } = payableSnap.data();
    // TODO: send email to host
    hostEmail;
    await notify(hostWallet, payment);
  } else {
    // TODO: Alert developers in some way
  }
};
