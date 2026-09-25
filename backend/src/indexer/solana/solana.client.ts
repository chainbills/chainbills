// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Solana program client
//
// Wraps @coral-xyz/anchor's Program and @solana/web3.js Connection for the
// Chainbills program. Takes an RPC URL and the program IDL — never a mutated
// global. Exposes typed helpers for decoding Solana program accounts.
//
// Invariants:
//   - A new Connection and BorshAccountsCoder are created per instance; do not
//     share them across chains.
//   - All RPC calls use "confirmed" commitment to match the relayer behaviour.
//   - The IDL is read-only; program writes (submission) are handled separately
//     in the Solana submitter (relay/submitters/solana.submitter.ts).
// ──────────────────────────────────────────────────────────────────────────────

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, BorshAccountsCoder, Program, Wallet } from '@coral-xyz/anchor';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IDL = require('../../chains/idl/chainbills-idl.json');

export { IDL };

/**
 * Creates a Solana Connection for the given RPC URL.
 * Always uses "confirmed" commitment.
 */
export function makeConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Creates a BorshAccountsCoder scoped to the Chainbills IDL.
 * Used for decoding program accounts without needing a full provider/wallet.
 */
export function makeCoder(): BorshAccountsCoder {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new BorshAccountsCoder(IDL as any);
}

/**
 * Creates an Anchor Program instance scoped to the given payer keypair.
 * Used by the Solana submitter for sending transactions.
 *
 * @param rpcUrl  The Solana RPC URL (from AppConfigService, never a global).
 * @param programId  The Chainbills program id string.
 * @param payer  The relayer keypair that signs transactions.
 */
export function makeProgram(rpcUrl: string, programId: string, payer: Keypair): Program<never> {
  const connection = makeConnection(rpcUrl);
  const provider = new AnchorProvider(connection, new Wallet(payer), {
    commitment: 'confirmed',
  });
  // The program id in the IDL must match what is on chain; override programId
  // from the registry so that different deployments do not require IDL edits.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idlWithId = { ...IDL, address: programId } as any;
  return new Program(idlWithId, provider);
}

/**
 * Derives a PDA for the Chainbills program using the given seeds.
 *
 * @param seeds    Byte buffers used as PDA seeds.
 * @param programId  The Chainbills program id string.
 */
export function getPDA(seeds: (Uint8Array | Buffer)[], programId: string): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, new PublicKey(programId))[0];
}

/**
 * Decodes a Chainbills program account by name from raw bytes.
 * Throws when data is null or decoding fails — the caller should propagate the
 * error so the indexer can stop on failure and retry from the same position.
 *
 * @param coder       A BorshAccountsCoder built from the Chainbills IDL.
 * @param accountName The account discriminator name (e.g. "Stats", "Payable").
 * @param data        Raw account data bytes from Connection.getAccountInfo.
 */
export function decodeAccount<T>(coder: BorshAccountsCoder, accountName: string, data: Buffer | null): T {
  if (!data) throw new Error(`Account data is null (account: ${accountName})`);
  return coder.decode<T>(accountName, data);
}
