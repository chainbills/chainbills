import { Program } from '@project-serum/anchor';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { Network } from '@wormhole-foundation/sdk';

import { IDL, type Chainbills } from './idl';

export const PROGRAM_ID = 'p7Lu1yPzMRYLfLxWbEePx8kn3LNevFTbGVC5ghyADF9';

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
