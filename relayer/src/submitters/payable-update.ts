// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Payable Update Submitter
//
// Calls the appropriate on-chain receive function to apply a cross-chain
// payable update on the destination chain. Supports both Wormhole VAA and
// Circle CCTP attestation delivery paths.
//
// Wormhole path:
//   receivePayableUpdateViaWormhole(bytes encodedVaa)
//     → parses VAA, verifies emitter, enforces nonce, applies PayablePayload
//
// CCTP path:
//   receivePayableUpdateViaCircle(bytes message, bytes attestation)
//     → verifies Circle transmitter, enforces nonce, applies PayablePayload
//
// Admin sync (fallback):
//   adminSyncForeignPayable(...)
//     → used when source and dest chains share no common protocol
//     → requires ADMIN_ROLE on the destination chain
// ──────────────────────────────────────────────────────────────────────────────

import { toHex } from 'viem';
import type { ChainConfig } from '../chains.js';
import { mainAbi } from '../utils/abis.js';
import { makePublicClient, makeWalletClient, relayerAccount } from '../utils/clients.js';
import { logger } from '../utils/logger.js';

/**
 * Submits a Wormhole VAA to the destination chain to apply a payable update.
 *
 * @param destChain  Chain on which receivePayableUpdateViaWormhole() is called.
 * @param encodedVaa The signed VAA bytes returned by getVaa().
 * @returns          Transaction hash on success, or throws.
 */
export async function submitPayableUpdateViaWormhole(
  destChain: ChainConfig,
  encodedVaa: Uint8Array
): Promise<`0x${string}`> {
  const walletClient = makeWalletClient(destChain);
  const publicClient = makePublicClient(destChain);
  const account = relayerAccount();

  logger.info(
    {
      destChain: destChain.name,
      fn: 'receivePayableUpdateViaWormhole',
      contract: destChain.contractAddress,
    },
    'Submitting payable update via Wormhole'
  );

  const { request } = await publicClient.simulateContract({
    address: destChain.contractAddress,
    abi: mainAbi,
    functionName: 'receivePayableUpdateViaWormhole',
    args: [toHex(encodedVaa)],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  const explorerUrl = destChain.viemChain.blockExplorers?.default?.url;
  const txLink = explorerUrl ? `${explorerUrl}/tx/${txHash}` : txHash;

  logger.info({ destChain: destChain.name, txHash, txLink }, 'Wormhole payable update submitted successfully');
  return txHash;
}

/**
 * Submits a Circle CCTP message + attestation to the destination chain
 * to apply a payable update.
 *
 * @param destChain   Chain on which receivePayableUpdateViaCircle() is called.
 * @param message     Hex-encoded CCTP message bytes from Circle Iris API.
 * @param attestation Hex-encoded CCTP attestation bytes from Circle Iris API.
 * @returns           Transaction hash on success, or throws.
 */
export async function submitPayableUpdateViaCctp(
  destChain: ChainConfig,
  message: string,
  attestation: string
): Promise<`0x${string}`> {
  const walletClient = makeWalletClient(destChain);
  const publicClient = makePublicClient(destChain);
  const account = relayerAccount();

  logger.info(
    {
      destChain: destChain.name,
      fn: 'receivePayableUpdateViaCircle',
      contract: destChain.contractAddress,
    },
    'Submitting payable update via CCTP'
  );

  const { request } = await publicClient.simulateContract({
    address: destChain.contractAddress,
    abi: mainAbi,
    functionName: 'receivePayableUpdateViaCctp',
    args: [message as `0x${string}`, attestation as `0x${string}`],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  const explorerUrl = destChain.viemChain.blockExplorers?.default?.url;
  const txLink = explorerUrl ? `${explorerUrl}/tx/${txHash}` : txHash;

  logger.info({ destChain: destChain.name, txHash, txLink }, 'CCTP payable update submitted successfully');
  return txHash;
}

/**
 * Parses a signed Wormhole VAA (PayablePayload) and calls adminSyncForeignPayable
 * on the destination chain.
 *
 * Used when source chain has Wormhole but dest chain does not — the VAA cannot
 * be consumed on dest, so we decode the VAA payload and call adminSync directly.
 *
 * PayablePayload wire format (after VAA header):
 *   payloadType(1) | version(1) | actionType(1) | payableId(32) | nonce(8)
 *   actionType 1 or 4: ataaLength(1) | [token(32) | amount(8)] * n
 *   actionType 2 or 3: isClosed(1)
 *
 * @param sourceChain Chain that emitted the payable update (supplies cbChainId).
 * @param destChain   Chain on which adminSyncForeignPayable() is called.
 * @param encodedVaa  The signed VAA bytes (hex-decoded).
 */
export async function submitAdminSyncPayable(
  sourceChain: ChainConfig,
  destChain: ChainConfig,
  encodedVaa: Uint8Array
): Promise<`0x${string}`> {
  // Locate payload start: version(1) + guardianSetIndex(4) + numSigs(1) + sigs(66*n) + header(51)
  const numSigs = encodedVaa[5];
  const payloadOffset = 6 + 66 * numSigs + 51;

  // Parse PayablePayload fields.
  let i = payloadOffset;
  i += 1; // payloadType (already verified = 1 by watcher)
  i += 1; // version
  const actionType = encodedVaa[i];
  i += 1;
  const payableId = ('0x' + Buffer.from(encodedVaa.slice(i, i + 32)).toString('hex')) as `0x${string}`;
  i += 32;
  const nonce = BigInt('0x' + Buffer.from(encodedVaa.slice(i, i + 8)).toString('hex'));
  i += 8;
  const initiatedAt = BigInt('0x' + Buffer.from(encodedVaa.slice(i, i + 8)).toString('hex'));
  i += 8;

  let isClosed = false;
  const ataa: { token: `0x${string}`; amount: bigint }[] = [];

  if (actionType === 1 || actionType === 4) {
    const ataaLength = encodedVaa[i];
    i += 1;
    for (let j = 0; j < ataaLength; j++) {
      const token = ('0x' + Buffer.from(encodedVaa.slice(i, i + 32)).toString('hex')) as `0x${string}`;
      i += 32;
      const amount = BigInt('0x' + Buffer.from(encodedVaa.slice(i, i + 8)).toString('hex'));
      i += 8;
      ataa.push({ token, amount });
    }
  } else if (actionType === 2 || actionType === 3) {
    isClosed = encodedVaa[i] !== 0;
  }

  const walletClient = makeWalletClient(destChain);
  const publicClient = makePublicClient(destChain);
  const account = relayerAccount();

  logger.info(
    {
      sourceChain: sourceChain.name,
      destChain: destChain.name,
      payableId,
      actionType,
      nonce: nonce.toString(),
      initiatedAt: initiatedAt.toString(),
      isClosed,
      ataaCount: ataa.length,
    },
    'Submitting adminSyncForeignPayable'
  );

  const { request } = await publicClient.simulateContract({
    address: destChain.contractAddress,
    abi: mainAbi,
    functionName: 'adminSyncForeignPayable',
    args: [payableId, sourceChain.cbChainId as `0x${string}`, nonce, initiatedAt, actionType, isClosed, ataa],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  const explorerUrl = destChain.viemChain.blockExplorers?.default?.url;
  const txLink = explorerUrl ? `${explorerUrl}/tx/${txHash}` : txHash;

  logger.info({ destChain: destChain.name, txHash, txLink }, 'adminSyncForeignPayable submitted successfully');
  return txHash;
}
