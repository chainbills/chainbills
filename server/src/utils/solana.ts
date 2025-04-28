import { Program } from '@project-serum/anchor';
import { AllAccountsMap } from '@project-serum/anchor/dist/cjs/program/namespace/types';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { contracts } from '../schemas';
import { IDL, type Chainbills } from './idl';

export const solanaFetch = async (
  entity: keyof AllAccountsMap<Chainbills>,
  id: string
) => await program().account[entity].fetch(new PublicKey(id));

export const program = () =>
  new Program<Chainbills>(IDL, contracts.solanadevnet, {
    connection: new Connection(clusterApiUrl('devnet'))
  });

export const solanaVerify = (
  message: string,
  signature: string,
  publicKey: string
) =>
  nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    bs58.decode(signature),
    bs58.decode(publicKey)
  );
