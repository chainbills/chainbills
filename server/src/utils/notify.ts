import { FieldValue } from 'firebase-admin/firestore';
import { Payment } from '../schemas';
import { firestore, messaging } from './firebase';

export const notify = async (address: string, payment: Payment) => {
  const hostSnap = await firestore.doc(`/users/${address}`).get();
  let fcmTokens: string[] = [];
  if (hostSnap.exists) {
    fcmTokens = hostSnap.data().fcmTokens || [];
  } else {
    // TODO: Alert developers in some way
  }

  const paymentId = payment.id;
  const { amount, token } = payment.details;
  const details = `${amount} ${token}`;

  for (const token of fcmTokens) {
    try {
      console.log(
        await messaging.send({
          token,
          notification: {
            title: `You just got paid ${details}`,
            body: 'Click to View the Payment Receipt',
            image: 'https://chainbills.xyz/assets/chainbills-light.png'
          },
          data: { paymentId },
          webpush: {
            fcm_options: {
              link: `https://chainbills.xyz/receipt/${paymentId}`
            }
          }
        })
      );
    } catch (e) {
      if (`${e}`.toLowerCase().includes('not found')) {
        await firestore
          .doc(`/users/${address}`)
          .set(
            { fcmTokens: FieldValue.arrayRemove(token) },
            { merge: true }
          );
      } else {
        // not re-throwing any error because the payer should not be affected
        console.error(e);
        // TODO: Alert developers in some way
      }
    }
  }
};
