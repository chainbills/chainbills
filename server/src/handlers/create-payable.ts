import { sanitize } from 'isomorphic-dompurify';
import { Payable } from '../schemas';
import {
  Chain,
  defaultDb,
  evmFetch,
  getFirestore,
  solanaFetch
} from '../utils';

export const createPayable = async (
  body: any,
  chain: Chain,
  walletAddress: string
) => {
  // Checks
  let { description, payableId } = body;
  if (!description) throw 'Missing required description';
  if (typeof description !== 'string') throw 'Invalid description';
  description = sanitize(description);
  if (description.length < 10) throw 'Min description length is 15';
  if (description.length > 3000) throw 'Max description length is 3000';
  if (!payableId) throw 'Missing required payableId';
  if (typeof payableId !== 'string') throw 'Invalid payableId';
  payableId = payableId.trim();

  // Ensure the payable is not being recreated a second time.
  // This is necessary to prevent sending emails twice.
  let payableSnap = await defaultDb.doc(`/payables/${payableId}`).get();
  if (payableSnap.exists) throw 'Payable already exists';

  // Repeating the search with lowercase equivalent to account for HEX bytes
  payableSnap = await defaultDb
    .doc(`/payables/${payableId.toLowerCase()}`)
    .get();
  if (payableSnap.exists) throw 'Payable already exists';

  // Extract On-Chain Data
  let raw: any;
  if (chain.isEvm) {
    raw = await evmFetch('Payable', payableId);
    payableId = payableId.toLowerCase();
  } else if (chain.isSolana) raw = await solanaFetch('payable', payableId);
  else throw `Unsupported Chain ${chain.name}`;

  // Construct new Payable to save. This constructor takes only immutable data.
  const payable = new Payable(payableId, chain, raw);

  // Reject the process if the authenticated user is not the owner of the
  // payable. This is necessary to ensure that the right person is setting
  // the description of their payable and for preventing sending emails
  // to wrong people
  if (walletAddress !== payable.host) throw 'Not your payable!';

  // TODO: Send email to host if provided

  // Save the payable to the database twice
  // Firstly to the general database of payables
  await defaultDb
    .doc(`/payables/${payableId}`)
    .set({ description, ...payable });
  // Next to the chain of the payable too (without the description)
  await getFirestore(chain.name)
    .doc(`/payables/${payableId}`)
    .set({ ...payable });
};
