import { Program } from '@project-serum/anchor';
import { AllAccountsMap } from '@project-serum/anchor/dist/cjs/program/namespace/types';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Network } from '@wormhole-foundation/sdk';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { IDL, type Chainbills } from './idl';

export const PROGRAM_ID = '25DUdGkxQgDF7uN58viq6Mjegu3Ajbq2tnQH3zmgX2ND';

export const solanaFetch = async (
  entity: keyof AllAccountsMap<Chainbills>,
  id: string,
  network: Network
) => await program(network).account[entity].fetch(new PublicKey(id));

export const program = (network: Network) =>
  new Program<Chainbills>(IDL, PROGRAM_ID, {
    connection: new Connection(
      clusterApiUrl(network == 'Mainnet' ? 'mainnet-beta' : 'devnet')
    )
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
