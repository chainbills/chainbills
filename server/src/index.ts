import {
  AnchorProvider,
  BN,
  Idl,
  Program,
  Wallet
} from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import express, { Request, Response } from 'express';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import morgan from 'morgan';
import idl from './idl';
import { TokenAndAmountOnChain, convertTokens } from './token-and-amount';

const PROGRAM_ID = '4BTSkx71TpMMScc4QpVPr5ebH1rfsQojPSmcCALsq45d';

const app = express();
app.use(morgan('combined'));

initializeApp();
const firestore = getFirestore();

app.get('/payable/:address/:email', async (req: Request, res: Response) => {
  const { address, email: hostEmail } = req.params;

  const connection = new Connection(clusterApiUrl('devnet'));
  const program = new Program(
    idl as Idl,
    PROGRAM_ID,
    new AnchorProvider(connection, new Wallet(Keypair.generate()), {})
  );

  let payable;
  try {
    payable = await program.account.payable.fetch(new PublicKey(address));
  } catch (e) {
    console.error(e);
    return res.json({ success: false, message: `${e}` });
  }

  const globalCount = (payable.globalCount as BN).toNumber();
  const host = (payable.host as PublicKey).toBase58();
  const hostCount = (payable.hostCount as BN).toNumber();
  const tokensAndAmounts = convertTokens(
    payable.tokensAndAmounts as TokenAndAmountOnChain[]
  );
  const allowsFreePayments = payable.allowsFreePayments as boolean;
  const createdAt = (payable.createdAt as BN).toNumber();

  const data = {
    address,
    globalCount,
    host,
    hostCount,
    hostEmail,
    tokensAndAmounts,
    allowsFreePayments,
    createdAt
  };

  await firestore
    .collection('payables')
    .doc(address)
    .set(data, { merge: true });
  return res.json({ success: true });
});

app.use('**', (_: Request, res: Response) => res.json({ success: true }));

export const server = onRequest({ cors: true }, app);
