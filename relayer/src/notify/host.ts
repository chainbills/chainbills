// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Host Notifications
//
// Sends FCM push notifications to payable hosts when they receive a payment.
// Reuses the same Firestore /users/{wallet} structure as the server, so
// FCM tokens registered via the server are visible to the relayer.
//
// Withdrawal notifications are intentionally skipped here: the host initiated
// the withdrawal themselves so there's no need to notify.
// ──────────────────────────────────────────────────────────────────────────────

import { FieldValue } from 'firebase-admin/firestore';
import { db, messaging } from '../utils/firebase.js';
import { logger } from '../utils/logger.js';

/**
 * Notifies the host of a payable that they received a payment.
 * @param payableId The payable that was paid into.
 * @param paymentId The payable payment ID (used as the receipt link).
 * @param tokenName Human-readable token name (e.g. "USDC").
 * @param amount    Decimal amount (e.g. 10.5).
 */
export async function notifyPaymentReceived(
  payableId: string,
  paymentId: string,
  tokenName: string,
  amount: number
): Promise<void> {
  try {
    const payableSnap = await db.doc(`payables/${payableId}`).get();
    if (!payableSnap.exists) {
      // Payable may not be indexed yet (timing race). Skip notification.
      logger.warn({ payableId }, 'notifyPaymentReceived: payable not in Firestore yet, skipping FCM');
      return;
    }

    const { host } = payableSnap.data()!;
    if (!host) return;

    const hostSnap = await db.doc(`users/${host}`).get();
    if (!hostSnap.exists) return;

    const { fcmTokens } = hostSnap.data()!;
    if (!fcmTokens?.length) return;

    const title = `You just got paid ${amount} ${tokenName}`;
    const body = 'Click to view the Payment Receipt';
    const receiptUrl = `https://chainbills.xyz/receipt/${paymentId}`;

    for (const fcmToken of fcmTokens as string[]) {
      try {
        await messaging.send({
          token: fcmToken,
          notification: { title, body },
          data: { id: paymentId },
          webpush: { fcmOptions: { link: receiptUrl } },
        });
      } catch (e: any) {
        // If the token is expired/invalid, remove it from the user's list.
        if (`${e}`.toLowerCase().includes('not found')) {
          await db.doc(`users/${host}`).set(
            { fcmTokens: FieldValue.arrayRemove(fcmToken) },
            { merge: true }
          );
        } else {
          logger.error({ host, fcmToken, err: e }, 'FCM send failed');
        }
      }
    }
  } catch (err) {
    // Non-fatal — don't let notification failures block indexing.
    logger.error({ payableId, paymentId, err }, 'notifyPaymentReceived failed');
  }
}
