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
import type { ChainConfig } from '../chains/index.js';
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
    account: account.address,
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
    functionName: 'receivePayableUpdateViaCircle',
    args: [message as `0x${string}`, attestation as `0x${string}`],
    account: account.address,
  });

  const txHash = await walletClient.writeContract(request);
  const explorerUrl = destChain.viemChain.blockExplorers?.default?.url;
  const txLink = explorerUrl ? `${explorerUrl}/tx/${txHash}` : txHash;

  logger.info({ destChain: destChain.name, txHash, txLink }, 'CCTP payable update submitted successfully');
  return txHash;
}
