// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Solana Client Helpers
//
// Creates Connection, Anchor Program, and BorshAccountsCoder instances
// for reading on-chain Solana state.
// ──────────────────────────────────────────────────────────────────────────────

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, BorshAccountsCoder, Program, Wallet } from '@coral-xyz/anchor';
import type { SolanaChainConfig } from '../chains.js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IDL = require('./chainbills-idl.json');

export { IDL };

/** Create a Solana Connection for the given chain config. */
export function makeConnection(chain: SolanaChainConfig): Connection {
  return new Connection(chain.rpcUrl, 'confirmed');
}

/** Create an Anchor Program instance scoped to the given payer keypair. */
export function makeProgram(chain: SolanaChainConfig, payer: Keypair): Program<any> {
  const connection = makeConnection(chain);
  const provider = new AnchorProvider(connection, new Wallet(payer), {
    commitment: 'confirmed',
  });
  return new Program(IDL as any, provider);
}

/** Create a BorshAccountsCoder for decoding program accounts without a provider. */
export function makeCoder(): BorshAccountsCoder {
  return new BorshAccountsCoder(IDL as any);
}

/**
 * Decode a program account by name from raw bytes.
 * Throws if the account is not found or decoding fails.
 */
export function decodeAccount<T>(coder: BorshAccountsCoder, accountName: string, data: Buffer | null): T {
  if (!data) throw new Error(`Account data is null (account: ${accountName})`);
  return coder.decode<T>(accountName, data);
}

/** Derive a PDA for the Chainbills program using the given seeds. */
export function getPDA(seeds: (Uint8Array | Buffer)[], programId: string): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, new PublicKey(programId))[0];
}
