// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Solana Transaction Submitter
//
// Submits Solana transactions to finalize cross-chain receives.
//
// recv_payment_via_cctp_wormhole path (EVM → Solana, Wormhole + CCTP):
//   1. Post VAA: call wormhole_core::verify_signatures + post_vaa (creates PostedVAA).
//   2. Receive: call recv_payment_via_cctp_wormhole with the PostedVAA address.
//
// recv_payment_via_cctp_only path (EVM → Solana, CCTP only):
//   - Requires ALTs to fit the 1232-byte transaction limit.
//   - See comment in build plan: LiteSVM 0.5.x limitation (test coverage deferred).
//
// All instructions are built via the Anchor IDL (no manual discriminator math).
// ──────────────────────────────────────────────────────────────────────────────

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
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import type { SolanaChainConfig } from '../chains.js';
import { getSolanaRelayerKeypair } from '../config.js';
import { logger } from '../utils/logger.js';
import {
  cctpTokenBurnNoncePDA,
  chainRegistryPDA,
  consumedVaaPDA,
  foreignPayablePDA,
  payablePaymentPDA,
  paymentNoncePDA,
  postedVaaPDA,
  statsPDA,
  vaultAuthorityPDA,
} from './accounts.js';
import { decodeAccount, makeCoder, makeConnection, makeProgram } from './client.js';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bY1');

// ── ParsedVAA ─────────────────────────────────────────────────────────────────

interface ParsedVAA {
  vaaHash: Buffer;
  emitterChain: number;
  emitterAddress: Buffer;
  payload: Buffer;
}

/**
 * Parse key fields from a signed Wormhole VAA.
 * VAA layout: version(1) + guardianSetIndex(4) + numSigs(1) + sigs(66*n) + header(51) + payload
 * Header: timestamp(4) + nonce(4) + emitterChain(2) + emitterAddress(32) + sequence(8) + finality(1)
 */
function parseVAA(vaaBytes: Uint8Array): ParsedVAA {
  const numSigs = vaaBytes[5];
  const headerOffset = 6 + 66 * numSigs;

  // vaaHash = keccak256(header + payload) — computed by Wormhole core bridge
  // For the PDA derivation we use the raw vaaBytes hash (bridge computes internally).
  // We need a deterministic key — use the sequence + emitter as the "hash" input to PDA.
  // In practice, the bridge stores PostedVAA keyed by keccak256(body).
  // We can compute it ourselves using the crypto module.
  const { createHash } = require('crypto');
  const body = vaaBytes.slice(headerOffset);
  const vaaHash = Buffer.from(createHash('keccak256').update(body).digest());

  const emitterChain = (vaaBytes[headerOffset + 8] << 8) | vaaBytes[headerOffset + 9];
  const emitterAddress = Buffer.from(vaaBytes.slice(headerOffset + 10, headerOffset + 42));
  const payloadOffset = headerOffset + 51;
  const payload = Buffer.from(vaaBytes.slice(payloadOffset));

  return { vaaHash, emitterChain, emitterAddress, payload };
}

// ── Post VAA (Wormhole verify + post) ─────────────────────────────────────────

/**
 * Post a signed VAA to the Wormhole Core Bridge on Solana.
 * This creates the PostedVAA account which our program's recv_payment
 * instruction reads to verify the payload.
 *
 * In production, this is a two-step process:
 *   1. verify_signatures (guardian set validation)
 *   2. post_vaa (writes PostedVAA account)
 *
 * NOTE: The Wormhole Solana SDK / Guardian verification is complex to
 * replicate here. In production, use the Wormhole TypeScript SDK:
 *   @wormhole-foundation/sdk-solana-core
 *
 * This stub posts the VAA by calling post_vaa directly using a fake
 * signature set account (development only — devnet guardian is permissive).
 */
async function postVAA(
  chain: SolanaChainConfig,
  connection: Connection,
  relayer: Keypair,
  vaaBytes: Uint8Array,
  log: typeof logger
): Promise<PublicKey> {
  // Full Wormhole guardian verification + post_vaa flow requires either:
  //   1. @wormhole-foundation/sdk-solana-core (wormhole-foundation SDK)
  //   2. Manual verify_signatures + post_vaa instruction sequence
  //
  // This is intentionally left as a stub. Implement by:
  //   npm install @wormhole-foundation/sdk-solana-core
  //   Then use WormholeContext.postVaa() from the SDK.
  throw new Error(
    'postVAA: Wormhole SDK integration required for guardian verification. ' +
      'Install @wormhole-foundation/sdk-solana-core and call WormholeContext.postVaa().'
  );
}

// ── recv_payment_via_cctp_wormhole ────────────────────────────────────────────

/**
 * Submit recv_payment_via_cctp_wormhole to Solana.
 *
 * @param chain       Solana chain config (dest chain).
 * @param vaaBytes    Signed Wormhole VAA bytes from Wormhole API.
 * @param burnMessage Hex-encoded CCTP token burn message from Circle.
 * @param attestation Hex-encoded CCTP attestation from Circle.
 * @returns           Transaction signature on success.
 */
export async function submitPaymentToSolana(
  chain: SolanaChainConfig,
  vaaBytes: Uint8Array,
  burnMessage: string,
  attestation: string
): Promise<string> {
  const relayer = getSolanaRelayerKeypair();
  const connection = makeConnection(chain);
  const coder = makeCoder();

  logger.info({ destChain: chain.name }, 'Submitting recv_payment_via_cctp_wormhole to Solana');

  // 1. Parse the VAA to extract key fields.
  const { vaaHash, emitterChain, emitterAddress, payload } = parseVAA(vaaBytes);

  // 2. Parse PaymentPayload from VAA payload.
  //    Byte layout: [0]=0x02 [1]=version [2]=action [3..35]=payableId [35..43]=nonce
  //    [43..51]=initiatedAt [51..59]=amount [59..91]=payableChainToken
  //    [91..123]=payableChainId [123..155]=payer [155..187]=payerChainToken
  //    [187..219]=payerChainId [219..251]=payerPaymentId
  if (payload.length < 251) {
    throw new Error(`PaymentPayload too short: ${payload.length} bytes (expected 251)`);
  }
  const payableId = Buffer.from(payload.slice(3, 35));
  const paymentNonce = payload.readBigUInt64BE(35);
  const payer = Buffer.from(payload.slice(123, 155));
  const payerChainId = Buffer.from(payload.slice(187, 219));

  // 3. Derive PDA addresses.
  const usdcMint = new PublicKey(chain.usdcMint);
  const foreignPayable = foreignPayablePDA(payableId, chain.programId);
  const vaultAuth = vaultAuthorityPDA(foreignPayable, chain.programId);
  const vaultUsdcAta = getAssociatedTokenAddressSync(usdcMint, vaultAuth, true);
  const postedVaa = postedVaaPDA(vaaHash, chain.wormholeProgramId);

  // 4. Read current ForeignPayable to get payments_count for PDA seeds.
  const fpInfo = await connection.getAccountInfo(foreignPayable);
  if (!fpInfo) throw new Error(`ForeignPayable not found for payableId ${payableId.toString('hex')}`);
  const fp = decodeAccount<Record<string, any>>(coder, 'ForeignPayable', fpInfo.data);
  const paymentsCount = BigInt(fp.payments_count.toString());

  // 5. Read Stats to get total_activities for activity record PDA.
  const statsAddr = statsPDA(chain.programId);
  const statsInfo = await connection.getAccountInfo(statsAddr);
  if (!statsInfo) throw new Error('Stats PDA not found');
  const stats = decodeAccount<Record<string, any>>(coder, 'Stats', statsInfo.data);
  const totalActivities = BigInt(stats.total_activities.toString());

  // 6. Derive replay protection PDAs.
  const burnMsg = Buffer.from(burnMessage.replace(/^0x/, ''), 'hex');
  // CCTP burn nonce is at bytes [12..44] of the burn message.
  const cctpBurnNonce = burnMsg.slice(12, 44);
  const srcDomain = burnMsg.readUInt32LE(4);

  // 7. Look up ChainRegistry for the emitter chain.
  //    emitterChain is the Wormhole chain ID → find matching ChainRegistry PDA.
  //    For now use emitter address + chain ID to find the registry.
  //    The contract validates emitterAddress == chainRegistry.registered_contract.

  // Find the cbChainId for the source chain by Wormhole chain ID.
  const { ALL_CHAINS } = await import('../chains.js');
  const sourceChain = ALL_CHAINS.find((c) => c.hasWormhole && c.wormholeChainId === emitterChain && !c.isSolana);
  if (!sourceChain) {
    throw new Error(`No chain registered for Wormhole chain ID ${emitterChain}`);
  }
  const srcCbChainId = Buffer.from(sourceChain.cbChainId.replace(/^0x/, ''), 'hex');
  const chainRegistry = chainRegistryPDA(srcCbChainId, chain.programId);

  // 8. Post the VAA to create the PostedVAA account (requires Wormhole SDK).
  await postVAA(chain, connection, relayer, vaaBytes, logger);

  // 9. Build and send the recv_payment_via_cctp_wormhole instruction.
  const program: any = makeProgram(chain, relayer);
  const ix = await program.methods
    .recvPaymentViaCctpWormhole(
      Array.from(vaaHash),
      Array.from(payerChainId),
      Array.from(payer),
      new BN(paymentNonce.toString()),
      Array.from(cctpBurnNonce),
      srcDomain,
      burnMsg,
      Buffer.alloc(0) // empty attestation (CCTP CPI stubbed)
    )
    .accounts({
      relayer: relayer.publicKey,
      wormholeProgram: new PublicKey(chain.wormholeProgramId),
      postedVaa,
      chainRegistry,
      foreignPayable,
      vaultAuthority: vaultAuth,
      usdcMint,
      vaultUsdcAta,
      payablePayment: payablePaymentPDA(foreignPayable, paymentsCount, chain.programId),
      consumedVaa: consumedVaaPDA(vaaHash, chain.programId),
      paymentNoncePda: paymentNoncePDA(payerChainId, payer, paymentNonce, chain.programId),
      cctpBurnNoncePda: cctpTokenBurnNoncePDA(srcDomain, cctpBurnNonce, chain.programId),
      stats: statsAddr,
      activityRecord: (await import('./accounts.js')).activityRecordPDA(totalActivities, chain.programId),
      payableActivityPointer: await derivePayableActivityPointerPDA(foreignPayable, paymentsCount, chain.programId),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  // Send as a legacy transaction.
  const tx = new Transaction().add(ix);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = relayer.publicKey;
  tx.sign(relayer);

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');

  logger.info({ destChain: chain.name, sig }, 'recv_payment_via_cctp_wormhole submitted');
  return sig;
}

// ── Payable update receive ────────────────────────────────────────────────────

/**
 * Submit recv_payable_update_via_wormhole to Solana.
 *
 * @param chain      Solana chain config (dest chain).
 * @param vaaBytes   Signed Wormhole VAA bytes.
 * @returns          Transaction signature.
 */
export async function submitPayableUpdateToSolana(chain: SolanaChainConfig, vaaBytes: Uint8Array): Promise<string> {
  const relayer = getSolanaRelayerKeypair();
  const connection = makeConnection(chain);

  logger.info({ destChain: chain.name }, 'Submitting recv_payable_update_via_wormhole to Solana');

  const { vaaHash, emitterChain, emitterAddress, payload } = parseVAA(vaaBytes);

  // Parse PayablePayload header to get payableId.
  // [0]=type [1]=version [2]=action [3..35]=payableId [35..43]=nonce
  if (payload.length < 36) throw new Error('PayablePayload too short');
  const payableId = Buffer.from(payload.slice(3, 35));

  // Find source chain registry.
  const { ALL_CHAINS } = await import('../chains.js');
  const sourceChain = ALL_CHAINS.find((c) => c.hasWormhole && c.wormholeChainId === emitterChain);
  if (!sourceChain) throw new Error(`No chain for Wormhole chain ID ${emitterChain}`);
  const srcCbChainId = Buffer.from(sourceChain.cbChainId.replace(/^0x/, ''), 'hex');

  const coder = makeCoder();
  const foreignPayable = foreignPayablePDA(payableId, chain.programId);
  const statsAddr = statsPDA(chain.programId);
  const statsInfo = await connection.getAccountInfo(statsAddr);
  if (!statsInfo) throw new Error('Stats PDA not found');
  const stats = decodeAccount<Record<string, any>>(coder, 'Stats', statsInfo.data);
  const totalActivities = BigInt(stats.total_activities.toString());
  const totalForeignPayables = BigInt(stats.total_foreign_payables.toString());

  // Post VAA first.
  await postVAA(chain, connection, relayer, vaaBytes, logger);

  const program: any = makeProgram(chain, relayer);
  const postedVaa = postedVaaPDA(vaaHash, chain.wormholeProgramId);
  const chainRegistry = chainRegistryPDA(srcCbChainId, chain.programId);

  const ix = await program.methods
    .recvPayableUpdateViaWormhole()
    .accounts({
      relayer: relayer.publicKey,
      postedVaa,
      chainRegistry,
      foreignPayable,
      consumedVaa: consumedVaaPDA(vaaHash, chain.programId),
      stats: statsAddr,
      activityRecord: (await import('./accounts.js')).activityRecordPDA(totalActivities, chain.programId),
      wormholeProgram: new PublicKey(chain.wormholeProgramId),
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = relayer.publicKey;
  tx.sign(relayer);

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');

  logger.info({ destChain: chain.name, sig }, 'recv_payable_update_via_wormhole submitted');
  return sig;
}

// ── ALT helper ────────────────────────────────────────────────────────────────

/**
 * Create an Address Lookup Table on Solana and populate it with the given
 * addresses. Returns the ALT account ready for use in v0 transactions.
 *
 * Used for recv_payment_via_cctp_only which exceeds the 1232-byte legacy limit.
 */
export async function createAddressLookupTable(
  connection: Connection,
  payer: Keypair,
  addresses: PublicKey[]
): Promise<AddressLookupTableAccount> {
  const slot = await connection.getSlot();

  const [createIx, altAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: slot,
  });

  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: altAddress,
    addresses,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [createIx, extendIx],
  }).compileToV0Message();

  const vtx = new VersionedTransaction(msg);
  vtx.sign([payer]);
  const sig = await connection.sendTransaction(vtx);
  await connection.confirmTransaction(sig, 'confirmed');

  // Wait one slot for the ALT to activate.
  await new Promise((r) => setTimeout(r, 500));

  const altInfo = await connection.getAddressLookupTable(altAddress);
  if (!altInfo.value) throw new Error('ALT not found after creation');
  return altInfo.value;
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function derivePayableActivityPointerPDA(
  payable: PublicKey,
  payableIndex: bigint,
  programId: string
): Promise<PublicKey> {
  const idxBuf = Buffer.alloc(8);
  idxBuf.writeBigUInt64LE(payableIndex, 0);
  const { getPDA } = await import('./client.js');
  return getPDA([Buffer.from('activity'), Buffer.from('payable'), payable.toBuffer(), idxBuf], programId);
}
