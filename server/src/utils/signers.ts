import { Wallet } from '@project-serum/anchor';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import 'dotenv/config';

if (!process.env.SOLANA_KEY) throw 'Set SOLANA_KEY in .env';

export const solanaWallet = new Wallet(
  Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_KEY!))
);
