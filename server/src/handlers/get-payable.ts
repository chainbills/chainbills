import { firestore } from '../utils';

export const getPayable = async (id: string) => {
  const payableSnap = await firestore.doc(`/payables/${id}`).get();
  if (!payableSnap.exists) throw 'Payable Not Found';
  let { chain, chainId, network, description } = payableSnap.data()!;
  if (!chain || !chainId || !network || !description) {
    // TODO: This shouldn't happen, alert developers.
    throw 'Invalid Payable Data';
  }
  return { chain, chainId, network, description };
};
