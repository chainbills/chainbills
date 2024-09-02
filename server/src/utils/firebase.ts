import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp();
export const defaultDb = getFirestore();
export const devDb = getFirestore('testnet');
export const messaging = getMessaging();
export const prodDb = getFirestore('mainnet');
