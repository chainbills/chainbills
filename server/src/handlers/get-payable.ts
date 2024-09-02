import { devDb } from '../utils';

export const getPayable = async (id: string) => {
  const payableSnap = await devDb.doc(`/payables/${id}`).get();
  if (!payableSnap.exists) throw 'Payable Not Found';

  // TODO: When there are mainnets, also check for prodDb before throwing

  let { chain, chainId, network, description } = payableSnap.data()!;
  if (!chain || !chainId || !network || !description) {
    // TODO: This shouldn't happen, alert developers.
    throw 'Invalid Payable Data';
  }
  return { chain, chainId, network, description };
};
