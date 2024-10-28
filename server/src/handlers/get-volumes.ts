import { devDb } from '../utils';

export const getVolumes = async () => {
  const volumesSnap = await devDb.doc('/volumes/volumes').get();
  if (!volumesSnap.exists) throw 'Volumes Not Found';
  return volumesSnap.data();
};
