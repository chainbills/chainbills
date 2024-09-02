import { Network } from '@wormhole-foundation/sdk';
import { sanitize } from 'isomorphic-dompurify';
import { isEmail } from 'validator';
import { Payable } from '../schemas';
import { Chain, evmFetchPayable, firestore, solanaFetch } from '../utils';

export const createPayable = async (
  body: any,
  chain: Chain,
  walletAddress: string,
  network: Network
) => {
  // Checks
  let { description, email, payableId } = body;
  if (!description) throw 'Missing required description';
  if (typeof description !== 'string') throw 'Invalid description';
  description = sanitize(description);
  if (description.length < 10) throw 'Min description length is 15';
  if (description.length > 3000) throw 'Max description length is 3000';
  if (!isEmail(email)) throw `Invalid Email: ${email}`;
  if (!payableId) throw 'Missing required payableId';
  if (typeof payableId !== 'string') throw 'Invalid payableId';
  payableId = payableId.trim();

  // Ensure the payable is not being recreated a second time.
  // This is necessary to prevent sending emails twice.
  let payableSnap = await firestore.doc(`/payables/${payableId}`).get();
  if (payableSnap.exists) throw 'Payable already exists';

  // Repeating the search with lowercase equivalent to account for EVM addresses
  payableSnap = await firestore
    .doc(`/payables/${payableId.toLowerCase()}`)
    .get();
  if (payableSnap.exists) throw 'Payable already exists';

  // Extract On-Chain Data
  let raw: any;
  if (chain === 'Solana') {
    raw = await solanaFetch('payable', payableId, network);
  } else if (chain === 'Ethereum Sepolia') {
    raw = await evmFetchPayable(payableId);
    payableId = payableId.toLowerCase();
  } else throw `Unsupported Chain ${chain}`;

  // Construct new Payable to save. This constructor takes only immutable data.
  const payable = new Payable(payableId, chain, network, raw);

  // Reject the process if the authenticated user is not the owner of the
  // payable. This is necessary to prevent sending emails to wrong people.
  if (walletAddress !== payable.host) throw 'Not your payable!';

  // TODO: Send email to host

  // Save the payable to the database
  await firestore
    .doc(`/payables/${payableId}`)
    .set({ email, description, ...payable }, { merge: true });
};