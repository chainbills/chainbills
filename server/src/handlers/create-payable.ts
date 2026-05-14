import { sanitize } from 'isomorphic-dompurify';
import { Payable } from '../schemas';
import { Chain, db, evmFetch, solanaFetch } from '../utils';

export const createPayable = async (body: any, chain: Chain, walletAddress: string) => {
  // Checks
  let { description, payableId } = body;
  if (!description) throw 'Missing required description';
  if (typeof description !== 'string') throw 'Invalid description';
  description = sanitize(description);
  if (description.length < 3) throw 'Min description length is 3';
  if (description.length > 3000) throw 'Max description length is 3000';
  if (!payableId) throw 'Missing required payableId';
  if (typeof payableId !== 'string') throw 'Invalid payableId';
  payableId = payableId.trim();

  // Extract On-Chain Data to verify the caller is the actual owner.
  let raw: any;
  if (chain.isEvm) {
    raw = await evmFetch('Payable', payableId, chain.name);
    payableId = payableId.toLowerCase();
  } else if (chain.isSolana) raw = await solanaFetch('payable', payableId);
  else throw `Unsupported Chain ${chain.name}`;

  // Construct Payable from on-chain data (immutable fields only).
  const payable = new Payable(payableId, chain, raw);

  // Reject if the authenticated user is not the owner of the payable.
  // This ensures only the host can set the description.
  if (walletAddress !== payable.host) throw 'Not your payable!';

  // TODO: Send email to host if provided

  // Write to the top-level /payables collection using merge: true.
  await db.doc(`/payables/${payableId}`).set({ description, ...payable }, { merge: true });

  // Also write to the chain subcollection.
  await db.doc(`/chains/${chain.name}/payables/${payableId}`).set({ description, ...payable }, { merge: true });
};
