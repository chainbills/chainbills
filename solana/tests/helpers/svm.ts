/**
 * Core LiteSVM test utilities for Chainbills.
 *
 * Pattern:
 *   const svm = createSvm();                     // fresh in-process VM
 *   const { keypair, program } = fund(svm);      // funded actor + Anchor builder
 *   const ix = await program.methods.foo().accounts({...}).instruction();
 *   const result = sendIx(svm, ix, keypair);     // execute
 *   expect(isFailed(result)).toBe(false);
 *   const data = decode<Config>(svm, "config", configPda);
 */

import { LiteSVM, FailedTransactionMetadata, type TransactionMetadata } from 'litesvm';
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import { AnchorProvider, BorshAccountsCoder, Program, Wallet } from '@coral-xyz/anchor';
import * as path from 'path';
import IDL from '../../target/idl/chainbills.json';
import type { Chainbills } from '../../target/types/chainbills';

// ── Constants ─────────────────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey('DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk');

const SO_PATH = path.join(__dirname, '../../target/deploy/chainbills.so');

const BPF_LOADER_UPGRADEABLE = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

// ── VM factory ────────────────────────────────────────────────────────────────

/** Create a fresh LiteSVM instance with Chainbills and all SPL programs loaded. */
export function createSvm(): LiteSVM {
  const svm = new LiteSVM();
  svm.addProgramFromFile(PROGRAM_ID, SO_PATH);
  return svm;
}

// ── Anchor program builder ────────────────────────────────────────────────────

/**
 * Create an Anchor Program scoped to `payer`.
 * The Connection is a dummy — instruction building never hits the network.
 */
export function createProgram(payer: Keypair): Program<Chainbills> {
  const connection = new Connection('http://127.0.0.1:8899', 'confirmed');
  const provider = new AnchorProvider(connection, new Wallet(payer), {
    commitment: 'confirmed',
  });
  return new Program(IDL as Chainbills, provider);
}

/** Fund a new random keypair and return it with its Anchor program. */
export function fund(
  svm: LiteSVM,
  lamports: bigint = 10_000_000_000n
): { keypair: Keypair; program: Program<Chainbills> } {
  const keypair = Keypair.generate();
  svm.airdrop(keypair.publicKey, lamports);
  return { keypair, program: createProgram(keypair) };
}

// ── Transaction helpers ───────────────────────────────────────────────────────

/** Build and send a single-instruction transaction. Signers[0] is the fee payer. */
export function sendIx(
  svm: LiteSVM,
  ix: TransactionInstruction,
  payer: Keypair,
  ...extra: Keypair[]
): TransactionMetadata | FailedTransactionMetadata {
  const tx = new Transaction().add(ix);
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = payer.publicKey;
  tx.sign(payer, ...extra);
  return svm.sendTransaction(tx);
}

/** Build and send multiple instructions in one transaction. */
export function sendIxs(
  svm: LiteSVM,
  ixs: TransactionInstruction[],
  payer: Keypair,
  ...extra: Keypair[]
): TransactionMetadata | FailedTransactionMetadata {
  const tx = new Transaction();
  for (const ix of ixs) tx.add(ix);
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = payer.publicKey;
  tx.sign(payer, ...extra);
  return svm.sendTransaction(tx);
}

/** Returns true when the result is a failed transaction. */
export function isFailed(r: TransactionMetadata | FailedTransactionMetadata): r is FailedTransactionMetadata {
  return r instanceof FailedTransactionMetadata;
}

/** Assert the transaction succeeded; throw with logs on failure. */
export function expectSuccess(r: TransactionMetadata | FailedTransactionMetadata): asserts r is TransactionMetadata {
  if (isFailed(r)) {
    const meta = (r as FailedTransactionMetadata).meta();
    const logs = meta ? meta.logs().join('\n') : '(no logs)';
    const err = (r as FailedTransactionMetadata).err();
    throw new Error(`Transaction failed: ${JSON.stringify(err)}\n${logs}`);
  }
}

/** Assert the transaction failed and optionally check the error code. */
export function expectFailure(
  r: TransactionMetadata | FailedTransactionMetadata,
  errorCode?: number
): asserts r is FailedTransactionMetadata {
  if (!isFailed(r)) {
    throw new Error('Expected transaction to fail but it succeeded');
  }
  if (errorCode !== undefined) {
    const err = (r as FailedTransactionMetadata).err();
    const errStr = JSON.stringify(err);
    if (!errStr.includes(String(errorCode))) {
      throw new Error(`Expected error code ${errorCode}, got: ${errStr}`);
    }
  }
}

// ── Account helpers ───────────────────────────────────────────────────────────

/** Decode an Anchor-managed account by its type name (camelCase). */
export function decode<T>(svm: LiteSVM, accountName: string, address: PublicKey): T {
  const info = svm.getAccount(address);
  if (!info) throw new Error(`Account not found: ${address.toBase58()}`);
  const coder = new BorshAccountsCoder(IDL as any);
  return coder.decode<T>(accountName, Buffer.from(info.data));
}

/** Encode an Anchor account struct to bytes (discriminator + borsh). */
export async function encodeAccount(accountName: string, data: object): Promise<Buffer> {
  const coder = new BorshAccountsCoder(IDL as any);
  return coder.encode(accountName, data);
}

/** Inject a program-owned account directly (bypasses instruction logic). */
export function injectAccount(svm: LiteSVM, address: PublicKey, data: Buffer): void {
  const lamports = Number(svm.minimumBalanceForRentExemption(BigInt(data.length)));
  svm.setAccount(address, {
    lamports,
    data,
    owner: PROGRAM_ID,
    executable: false,
  });
}

// ── Upgrade authority patching ────────────────────────────────────────────────

/**
 * Read the program data account address from the program account.
 * BPFLoaderUpgradeable Program account layout (bincode):
 *   [0..4]  u32 LE = 2 (Program variant)
 *   [4..36] Pubkey  (programdata_address)
 */
export function getProgramDataAddress(svm: LiteSVM): PublicKey {
  const programAccount = svm.getAccount(PROGRAM_ID);
  if (!programAccount) throw new Error('Program account not found');
  const data = Buffer.from(programAccount.data);
  return new PublicKey(data.slice(4, 36));
}

/**
 * Patch the upgrade authority in the program data account so that `authority`
 * becomes the upgrade authority. Required before calling `initialize`.
 *
 * BPFLoaderUpgradeable ProgramData layout (bincode):
 *   [0..4]   u32 LE = 3  (ProgramData variant)
 *   [4..12]  u64 LE      (deployment slot)
 *   [12]     u8  = 1     (Option::Some tag)
 *   [13..45] [u8; 32]    (upgrade authority pubkey)
 *   [45..]               (ELF bytes — unchanged)
 */
export function setProgramUpgradeAuthority(svm: LiteSVM, authority: PublicKey): void {
  const programDataAddress = getProgramDataAddress(svm);
  const existing = svm.getAccount(programDataAddress);
  if (!existing) throw new Error('Program data account not found — did addProgramFromFile run?');

  const data = Buffer.from(existing.data);
  data[12] = 1; // Option::Some
  const bytes = authority.toBytes();
  for (let i = 0; i < 32; i++) {
    data[13 + i] = bytes[i];
  }

  svm.setAccount(programDataAddress, { ...existing, data });
}

// ── Versioned transaction helper (for oversized instructions) ─────────────────

/**
 * Create an Address Lookup Table (ALT) on-chain via the native ALT program,
 * populate it with `addresses`, and return the `AddressLookupTableAccount`
 * ready for use in a v0 transaction.
 *
 * Using ALTs in v0 transactions shrinks account keys from 32 bytes each to
 * 1 byte each, enabling instructions with large Vec<u8> args (like
 * recv_payment_via_cctp_only) to fit within the 1232-byte legacy limit.
 */
export function createAlt(svm: LiteSVM, payer: Keypair, addresses: PublicKey[]): AddressLookupTableAccount {
  const slot = svm.getClock().slot;

  const [createIx, altAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: slot,
  });

  const createTx = new Transaction().add(createIx);
  createTx.recentBlockhash = svm.latestBlockhash();
  createTx.feePayer = payer.publicKey;
  createTx.sign(payer);
  const createResult = svm.sendTransaction(createTx);
  if (createResult instanceof FailedTransactionMetadata) {
    throw new Error(`createLookupTable failed: ${JSON.stringify(createResult.err())}`);
  }

  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: altAddress,
    addresses,
  });

  const extendTx = new Transaction().add(extendIx);
  extendTx.recentBlockhash = svm.latestBlockhash();
  extendTx.feePayer = payer.publicKey;
  extendTx.sign(payer);
  const extendResult = svm.sendTransaction(extendTx);
  if (extendResult instanceof FailedTransactionMetadata) {
    throw new Error(`extendLookupTable failed: ${JSON.stringify(extendResult.err())}`);
  }

  const altAccountInfo = svm.getAccount(altAddress);
  if (!altAccountInfo) throw new Error('ALT account not found after creation');

  return new AddressLookupTableAccount({
    key: altAddress,
    state: AddressLookupTableAccount.deserialize(Buffer.from(altAccountInfo.data)),
  });
}

/**
 * Build and send a single instruction as a versioned (v0) transaction.
 * v0 transactions bypass the @solana/web3.js 1232-byte client-side limit check,
 * allowing LiteSVM to enforce its own (higher) limit. Use for instructions that
 * carry large Vec<u8> arguments (e.g. recv_payment_via_cctp_only).
 */
export function sendVersionedIx(
  svm: LiteSVM,
  ix: TransactionInstruction,
  payer: Keypair,
  ...extra: Keypair[]
): TransactionMetadata | FailedTransactionMetadata {
  const blockhash = svm.latestBlockhash();
  const msg = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const vtx = new VersionedTransaction(msg);
  vtx.sign([payer, ...extra]);
  return svm.sendTransaction(vtx);
}

// ── PDA helpers ───────────────────────────────────────────────────────────────

/** Derive a program PDA synchronously. */
export function pda(seeds: (Uint8Array | Buffer)[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}

// ── Large-transaction helper ──────────────────────────────────────────────────

/**
 * Encode an integer as a Solana compact-u16 (1–3 bytes).
 * Used by the manual MessageV0 serializer.
 */
function compactU16(value: number): Buffer {
  if (value <= 0x7f) return Buffer.from([value]);
  if (value <= 0x3fff) return Buffer.from([(value & 0x7f) | 0x80, value >> 7]);
  return Buffer.from([(value & 0x7f) | 0x80, ((value >> 7) & 0x7f) | 0x80, value >> 14]);
}

/**
 * Manually serialize a MessageV0 without the @solana/web3.js PACKET_DATA_SIZE
 * (1232-byte) limit. Produces bytes identical to MessageV0.serialize() but
 * backed by a dynamically-sized buffer.
 */
function serializeMessageV0(msg: ReturnType<TransactionMessage['compileToV0Message']>): Buffer {
  const parts: Buffer[] = [];
  parts.push(Buffer.from([0x80])); // version prefix: v0
  parts.push(Buffer.from([
    msg.header.numRequiredSignatures,
    msg.header.numReadonlySignedAccounts,
    msg.header.numReadonlyUnsignedAccounts,
  ]));
  parts.push(compactU16(msg.staticAccountKeys.length));
  for (const key of msg.staticAccountKeys) parts.push((key as PublicKey).toBuffer());
  // Decode base58 blockhash via PublicKey (handles the 32-byte hash format).
  parts.push(new PublicKey(msg.recentBlockhash).toBuffer());
  parts.push(compactU16(msg.compiledInstructions.length));
  for (const ix of msg.compiledInstructions) {
    parts.push(Buffer.from([ix.programIdIndex]));
    parts.push(compactU16(ix.accountKeyIndexes.length));
    parts.push(Buffer.from(ix.accountKeyIndexes));
    parts.push(compactU16(ix.data.length));
    parts.push(Buffer.from(ix.data));
  }
  parts.push(compactU16(msg.addressTableLookups.length));
  return Buffer.concat(parts);
}

/**
 * Build and send an oversized instruction as a v0 transaction, bypassing the
 * @solana/web3.js 1232-byte client-side limit.
 *
 * `recv_payment_via_cctp_only` sends two large Vec<u8> messages (~399 + ~149
 * bytes) plus 17 accounts, making the legacy tx ~1412 bytes. This helper:
 *   1. Compiles the instruction to a MessageV0 (no serialization yet)
 *   2. Serializes the message manually with an unbounded buffer
 *   3. Signs with nacl (Ed25519, same as Solana)
 *   4. Assembles raw tx bytes and deserializes to VersionedTransaction
 *   5. Patches the instance's serialize() to return our raw bytes so LiteSVM
 *      does not call the size-limited @solana/web3.js serialize() internally
 */
export function sendLargeVersionedIx(
  svm: LiteSVM,
  ix: TransactionInstruction,
  payer: Keypair,
  ...extra: Keypair[]
): TransactionMetadata | FailedTransactionMetadata {
  const msg = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: svm.latestBlockhash(),
    instructions: [ix],
  }).compileToV0Message();

  const msgBytes = serializeMessageV0(msg);
  const signers = [payer, ...extra];
  const sigs = signers.map((kp) => nacl.sign.detached(msgBytes, kp.secretKey));

  const txRaw = Buffer.concat([
    Buffer.from([signers.length]),
    ...sigs.map((s) => Buffer.from(s)),
    msgBytes,
  ]);

  const vtx = VersionedTransaction.deserialize(txRaw);
  // Patch the instance so LiteSVM's internal vtx.serialize() returns our
  // already-assembled bytes, bypassing the 1232-byte allocation.
  (vtx as any).serialize = () => txRaw;

  return svm.sendTransaction(vtx);
}

export { SystemProgram };
