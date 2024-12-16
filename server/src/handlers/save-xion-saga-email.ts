import { FieldValue } from 'firebase-admin/firestore';
import { isEmail } from 'validator';
import { defaultDb } from '../utils';

export const saveXionSagaEmail = async (body: any) => {
  const { email } = body;
  if (!isEmail(email)) throw `Invalid Email: ${email}`;

  await defaultDb
    .collection('xion-saga-emails')
    .add({ email, timestamp: FieldValue.serverTimestamp() });
};
