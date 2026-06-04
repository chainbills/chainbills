import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { contracts } from '../schemas';
import { IDL } from './idl';

export const program = () => {
  const connection = new Connection(clusterApiUrl('devnet'));
  const provider = new AnchorProvider(connection, {} as any, {
    commitment: 'confirmed',
  });
  return new Program(IDL as any, provider);
};

export const solanaFetch = async (entity: string, id: string): Promise<any> =>
  await (program().account as any)[entity].fetch(new PublicKey(id));

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
