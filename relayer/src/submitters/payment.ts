// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Cross-Chain Payment Submitter
//
// Submits the combined Wormhole VAA + Circle CCTP message/attestation to the
// destination chain to finalize a cross-chain USDC payment.
//
// The on-chain function signature is:
//   receiveForeignPaymentWithCircle(RedeemCirclePaymentParameters params)
//
// Where RedeemCirclePaymentParameters (from CbStructs.sol) is:
//   struct RedeemCirclePaymentParameters {
//     bytes   wormholeEncoded;            // signed VAA bytes (empty → CCTP-only path)
//     bytes   circleBridgeMessage;        // Circle CCTP token burn message
//     bytes   circleAttestation;          // Circle attestation for token burn
//     bytes   circlePayloadMessage;       // Circle data message with PaymentPayload (CCTP-only)
//     bytes   circlePayloadAttestation;   // Circle attestation for data message (CCTP-only)
//   }
//
// Both the VAA and the CCTP attestation must be ready before this is called.
// The job processor fetches them in parallel (Promise.all) and only calls
// this function once both are available.
// ──────────────────────────────────────────────────────────────────────────────

import { toHex } from 'viem';
import type { ChainConfig } from '../chains.js';
import { mainAbi } from '../utils/abis.js';
import { makePublicClient, makeWalletClient, relayerAccount } from '../utils/clients.js';
import { logger } from '../utils/logger.js';

/**
 * Submits a cross-chain payment relay transaction to the destination chain.
 *
 * @param destChain      Chain where the payable lives and USDC will be minted.
 * @param encodedVaa     Signed Wormhole VAA bytes containing the PaymentPayload.
 * @param circleMessage  Hex-encoded CCTP message from Circle Iris API.
 * @param circleAttest   Hex-encoded CCTP attestation from Circle Iris API.
 * @returns              Transaction hash on success, or throws.
 */
export async function submitForeignPayment(
  destChain: ChainConfig,
  encodedVaa: Uint8Array,
  circleMessage: string,
  circleAttest: string
): Promise<`0x${string}`> {
  const walletClient = makeWalletClient(destChain);
  const publicClient = makePublicClient(destChain);
  const account = relayerAccount();

  logger.info(
    {
      destChain: destChain.name,
      fn: 'receiveForeignPaymentWithCircle',
      contract: destChain.contractAddress,
    },
    'Submitting cross-chain payment relay'
  );

  const params = {
    wormholeEncoded: toHex(encodedVaa),
    circleBridgeMessage: circleMessage as `0x${string}`,
    circleAttestation: circleAttest as `0x${string}`,
    circlePayloadMessage: '0x' as `0x${string}`,
    circlePayloadAttestation: '0x' as `0x${string}`,
  };

  const { request } = await publicClient.simulateContract({
    address: destChain.contractAddress,
    abi: mainAbi,
    functionName: 'receiveForeignPaymentWithCircle',
    args: [params],
    account: account.address,
  });

  const txHash = await walletClient.writeContract(request);
  const explorerUrl = destChain.viemChain.blockExplorers?.default?.url;
  const txLink = explorerUrl ? `${explorerUrl}/tx/${txHash}` : txHash;

  logger.info({ destChain: destChain.name, txHash, txLink }, 'Cross-chain payment relay submitted successfully');
  return txHash;
}

/**
 * Submits a CCTP-only (no Wormhole) cross-chain payment relay transaction.
 *
 * @param destChain             Chain where the payable lives and USDC will be minted.
 * @param circleBridgeMsg       Hex-encoded Circle token burn message.
 * @param circleAttest          Hex-encoded Circle attestation for the token burn.
 * @param circlePayloadMsg      Hex-encoded Circle data message containing the PaymentPayload.
 * @param circlePayloadAttest   Hex-encoded Circle attestation for the data message.
 * @returns                     Transaction hash on success, or throws.
 */
export async function submitForeignPaymentViaCctp(
  destChain: ChainConfig,
  circleBridgeMsg: string,
  circleAttest: string,
  circlePayloadMsg: string,
  circlePayloadAttest: string
): Promise<`0x${string}`> {
  const walletClient = makeWalletClient(destChain);
  const publicClient = makePublicClient(destChain);
  const account = relayerAccount();

  logger.info(
    {
      destChain: destChain.name,
      fn: 'receiveForeignPaymentWithCircle',
      contract: destChain.contractAddress,
    },
    'Submitting CCTP-only cross-chain payment relay'
  );

  const params = {
    wormholeEncoded: '0x' as `0x${string}`,
    circleBridgeMessage: circleBridgeMsg as `0x${string}`,
    circleAttestation: circleAttest as `0x${string}`,
    circlePayloadMessage: circlePayloadMsg as `0x${string}`,
    circlePayloadAttestation: circlePayloadAttest as `0x${string}`,
  };

  const { request } = await publicClient.simulateContract({
    address: destChain.contractAddress,
    abi: mainAbi,
    functionName: 'receiveForeignPaymentWithCircle',
    args: [params],
    account: account.address,
  });

  const txHash = await walletClient.writeContract(request);
  const explorerUrl = destChain.viemChain.blockExplorers?.default?.url;
  const txLink = explorerUrl ? `${explorerUrl}/tx/${txHash}` : txHash;

  logger.info({ destChain: destChain.name, txHash, txLink }, 'CCTP-only payment relay submitted successfully');
  return txHash;
}
