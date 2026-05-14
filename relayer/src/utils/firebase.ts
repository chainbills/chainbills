// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Firebase / Firestore Client
//
// The relayer uses the same Firestore project as the server.
//
// Firestore write strategy — ALL writes use { merge: true } so that:
//   - The relayer and the server (POST /payable) can write to the same doc
//     in any order without one overwriting the other.
//   - Relayer indexing of on-chain data and server description upserts are
//     fully idempotent and race-condition safe.
// ──────────────────────────────────────────────────────────────────────────────

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp({
  credential: applicationDefault(),
});

/** Central Firestore database. All relayer writes go here. */
export const db = getFirestore();

/** Firebase Cloud Messaging client for push notifications. */
export const messaging = getMessaging();
