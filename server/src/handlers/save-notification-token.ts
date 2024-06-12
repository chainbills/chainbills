import { FieldValue } from 'firebase-admin/firestore';

import { firestore, messaging } from '../utils';

export const saveNotificationToken = async (body: any) => {
  const { walletAddress, fcmToken } = body;
  if (!fcmToken) throw 'Missing required fcmToken';

  // the following simply tests if the token is valid. If it is not, it will
  // throw an error and auto-return. The second argument is a boolean that
  // indicates for "test-only" or "dry-run" purpose.
  await messaging.send({ token: fcmToken }, true);

  // not checking validity of the wallet address because its already validated
  // in the middleware against the signed auth message

  await firestore
    .doc(`/users/${walletAddress}`)
    .set(
      { address: walletAddress, fcmTokens: FieldValue.arrayUnion(fcmToken) },
      { merge: true }
    );
};
