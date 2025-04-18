import { defaultDb } from '../utils';

export const getPayable = async (id: string) => {
  const payableSnap = await defaultDb.doc(`/payables/${id}`).get();
  if (!payableSnap.exists) throw 'Payable Not Found';

  let { chainName, description } = payableSnap.data()!;
  if (!chainName || !description) {
    // TODO: This shouldn't happen, alert developers.
    throw 'Invalid Payable Data';
  }
  return { chainName, description };
};
