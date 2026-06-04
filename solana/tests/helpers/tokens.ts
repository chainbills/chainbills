/**
 * SPL Token helpers for LiteSVM tests.
 * All functions build transactions locally and submit via LiteSVM — no RPC.
 */

import { LiteSVM } from 'litesvm';
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  ACCOUNT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  MintLayout,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

// ── Mint ──────────────────────────────────────────────────────────────────────

/**
 * Create a new SPL Token mint.
 * Authority for minting is `mintAuthority` (usually the payer keypair).
 * Returns the mint public key.
 */
export function createMint(
  svm: LiteSVM,
  payer: Keypair,
  mintAuthority: PublicKey = payer.publicKey,
  decimals: number = 6
): PublicKey {
  const mint = Keypair.generate();
  const lamports = Number(svm.minimumBalanceForRentExemption(BigInt(MintLayout.span)));

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports,
      space: MintLayout.span,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(mint.publicKey, decimals, mintAuthority, null)
  );
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = payer.publicKey;
  tx.sign(payer, mint);
  const result = svm.sendTransaction(tx);
  if ('err' in result) {
    throw new Error(`createMint failed: ${JSON.stringify(result.err)}`);
  }
  return mint.publicKey;
}

// ── ATA ───────────────────────────────────────────────────────────────────────

/** Derive ATA address for `owner` on `mint` (allows off-curve PDAs as owner). */
export function getAta(mint: PublicKey, owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, true);
}

/**
 * Create an ATA for `owner` on `mint`, funded by `payer`.
 * Returns the ATA address. No-ops if the ATA already exists.
 */
export function createAta(svm: LiteSVM, payer: Keypair, mint: PublicKey, owner: PublicKey): PublicKey {
  const ata = getAta(mint, owner);
  if (svm.getAccount(ata)) return ata; // already exists

  const tx = new Transaction().add(createAssociatedTokenAccountInstruction(payer.publicKey, ata, owner, mint));
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = payer.publicKey;
  tx.sign(payer);
  const result = svm.sendTransaction(tx);
  if ('err' in result) {
    throw new Error(`createAta failed: ${JSON.stringify(result.err)}`);
  }
  return ata;
}

// ── Minting ───────────────────────────────────────────────────────────────────

/**
 * Mint `amount` tokens to `recipient`'s ATA.
 * Creates the ATA if it doesn't exist.
 * Returns the ATA address.
 */
export function mintTo(svm: LiteSVM, payer: Keypair, mint: PublicKey, recipient: PublicKey, amount: bigint): PublicKey {
  const ata = createAta(svm, payer, mint, recipient);

  const tx = new Transaction().add(createMintToInstruction(mint, ata, payer.publicKey, amount));
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = payer.publicKey;
  tx.sign(payer);
  const result = svm.sendTransaction(tx);
  if ('err' in result) {
    throw new Error(`mintTo failed: ${JSON.stringify(result.err)}`);
  }
  return ata;
}

// ── Balance reads ─────────────────────────────────────────────────────────────

/**
 * Read the SPL token balance from an ATA.
 * SPL TokenAccount layout:
 *   [0..32]  mint
 *   [32..64] owner
 *   [64..72] amount (u64 LE)
 * Returns null if the account doesn't exist.
 */
export function getTokenBalance(svm: LiteSVM, ata: PublicKey): bigint | null {
  const info = svm.getAccount(ata);
  if (!info) return null;
  return Buffer.from(info.data).readBigUInt64LE(64);
}

export { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID };
