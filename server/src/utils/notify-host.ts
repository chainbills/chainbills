import { FieldValue } from 'firebase-admin/firestore';
import { TokenAndAmountDB } from '../schemas';
import { firestore, messaging } from './firebase';

export interface NotifyHostInputs {
  id: string;
  activity: 'payment' | 'withdrawal';
  details: TokenAndAmountDB;
  payableId: string;
}

export const notifyHost = async (inputs: NotifyHostInputs) => {
  const { activity, details, id, payableId } = inputs;
  const payableSnap = await firestore.doc(`/payables/${payableId}`).get();
  if (!payableSnap.exists) {
    // TODO: Alert developers in some way
    return;
  }

  const { email, host } = payableSnap.data()!;
  const hostSnap = await firestore.doc(`/users/${host}`).get();
  if (!hostSnap.exists) {
    // TODO: Alert developers in some way
    return;
  }

  // TODO: Send email to host
  email;

  // Send browser notifications only if the activity was a payment.
  // Don't notify for withdrawals since the host would have initiated it
  // themselves and the UI will update.
  if (activity == 'payment') {
    const { fcmTokens } = hostSnap.data()!;
    if (!fcmTokens || !fcmTokens.length) return;

    for (const token of fcmTokens) {
      try {
        console.log(
          await messaging.send({
            token,
            notification: {
              title: `You just got paid ${details.amount} ${details.token}`,
              body: 'Click to View the Payment Receipt'
              // image: 'https://chainbills.xyz/assets/chainbills-light.png'
            },
            data: { id },
            webpush: {
              fcmOptions: {
                link: `https://chainbills.xyz/receipt/${id}`
              }
            }
          })
        );
      } catch (e) {
        if (`${e}`.toLowerCase().includes('not found')) {
          await firestore
            .doc(`/users/${host}`)
            .set({ fcmTokens: FieldValue.arrayRemove(token) }, { merge: true });
        } else {
          // not re-throwing any error because the flow should not be affected
          console.error(e);
          // TODO: Alert developers in some way
        }
      }
    }
  }
};
