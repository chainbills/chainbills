import { FieldValue } from 'firebase-admin/firestore';

import { defaultDb, messaging } from '../utils';

export const saveNotificationToken = async (
  walletAddress: string,
  body: any
) => {
  const { fcmToken } = body;
  if (!fcmToken) throw 'Missing required fcmToken';

  // the following simply tests if the token is valid. If it is not, it will
  // throw an error and auto-return. The second argument is a boolean that
  // indicates for "test-only" or "dry-run" purpose.
  await messaging.send({ token: fcmToken }, true);

  await defaultDb
    .doc(`/users/${walletAddress}`)
    .set(
      { address: walletAddress, fcmTokens: FieldValue.arrayUnion(fcmToken) },
      { merge: true }
    );
};
