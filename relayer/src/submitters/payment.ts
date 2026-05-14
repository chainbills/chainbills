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
//     bytes   wormholeEncoded;       // signed VAA bytes
//     bytes   circleBridgeMessage;   // Circle CCTP message
//     bytes   circleAttestation;     // Circle attestation
//   }
//
// Both the VAA and the CCTP attestation must be ready before this is called.
// The job processor fetches them in parallel (Promise.all) and only calls
// this function once both are available.
// ──────────────────────────────────────────────────────────────────────────────

import { toHex } from 'viem';
import type { ChainConfig } from '../chains/index.js';
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
