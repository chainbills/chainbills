// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — EVM relay submitter
//
// Simulates then sends the destination diamond's inbound relay functions from
// the relayer wallet (viem WalletClient). Decodes any custom error from the
// diamond ABI and returns its name for idempotent-error classification.
//
// Functions submitted:
//   receivePayableUpdateViaWormhole(encodedVaa)
//   receivePayableUpdateViaCctp(message, attestation)
//   receiveForeignPaymentViaCctp(burnMessage, attestation)
//
// Invariants:
//   - The abi field is stripped from viem errors before logging to prevent
//     log floods (viem attaches the full ABI to thrown errors).
//   - simulateContract runs before writeContract so the error is classified
//     before the tx is submitted.
// ──────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';
import { type WalletClient, type PublicClient, decodeErrorResult, type Hash } from 'viem';
import { chainbillsAbi } from '../../chains/abi/chainbills';
import type { EvmChainConfig } from '../../chains/types';

const logger = new Logger('EvmSubmitter');

/** Custom error name decoded from the diamond ABI, or null when no error was decoded. */
export type DecodedErrorName = string | null;

function stripAbiFromError(err: unknown): unknown {
  if (!err || typeof err !== 'object') return err;
  const seen = new WeakSet<object>();
  const strip = (obj: object): Record<string, unknown> => {
    if (seen.has(obj)) return { '[Circular]': true };
    seen.add(obj);
    const out: Record<string, unknown> = {};
    for (const key of Object.getOwnPropertyNames(obj)) {
      if (key === 'abi') continue;
      const val = (obj as Record<string, unknown>)[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        out[key] = strip(val as object);
      } else {
        out[key] = val;
      }
    }
    return out;
  };
  return strip(err as object);
}

/**
 * Attempts to decode a custom error from the diamond ABI. Returns the error
 * name (e.g. "StalePayableUpdateNonce") when it matches, null otherwise.
 */
function decodeCustomError(err: unknown): DecodedErrorName {
  if (!err || typeof err !== 'object') return null;
  // Viem ContractFunctionExecutionError wraps the revert in `.cause.data`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: string | undefined = (err as any)?.cause?.data ?? (err as any)?.data;
  if (!data || typeof data !== 'string') return null;
  try {
    const decoded = decodeErrorResult({ abi: chainbillsAbi, data: data as `0x${string}` });
    return decoded.errorName;
  } catch {
    return null;
  }
}

/**
 * Simulates and submits `receivePayableUpdateViaWormhole` on the destination diamond.
 *
 * @returns The decoded custom error name if the call reverted, null on success.
 * @throws  On network errors or unknown reverts.
 */
export async function submitReceivePayableUpdateViaWormhole(
  chain: EvmChainConfig,
  publicClient: PublicClient,
  walletClient: WalletClient,
  vaaBytes: Uint8Array
): Promise<DecodedErrorName> {
  const address = chain.diamondAddress!;

  try {
    await publicClient.simulateContract({
      address,
      abi: chainbillsAbi,
      functionName: 'receivePayableUpdateViaWormhole',
      args: [`0x${Buffer.from(vaaBytes).toString('hex')}`],
    });

    const hash: Hash = await walletClient.writeContract({
      address,
      abi: chainbillsAbi,
      functionName: 'receivePayableUpdateViaWormhole',
      args: [`0x${Buffer.from(vaaBytes).toString('hex')}`],
      chain: chain.viemChain,
      account: walletClient.account!,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    logger.debug({ chain: chain.slug, hash }, 'receivePayableUpdateViaWormhole confirmed');
    return null;
  } catch (err) {
    const decoded = decodeCustomError(err);
    if (decoded) return decoded;
    logger.error({ chain: chain.slug, err: stripAbiFromError(err) }, 'receivePayableUpdateViaWormhole failed');
    throw err;
  }
}

/**
 * Simulates and submits `receivePayableUpdateViaCctp` on the destination diamond.
 *
 * @returns The decoded custom error name if the call reverted, null on success.
 * @throws  On network errors or unknown reverts.
 */
export async function submitReceivePayableUpdateViaCctp(
  chain: EvmChainConfig,
  publicClient: PublicClient,
  walletClient: WalletClient,
  message: string,
  attestation: string
): Promise<DecodedErrorName> {
  const address = chain.diamondAddress!;

  try {
    await publicClient.simulateContract({
      address,
      abi: chainbillsAbi,
      functionName: 'receivePayableUpdateViaCctp',
      args: [message as `0x${string}`, attestation as `0x${string}`],
    });

    const hash: Hash = await walletClient.writeContract({
      address,
      abi: chainbillsAbi,
      functionName: 'receivePayableUpdateViaCctp',
      args: [message as `0x${string}`, attestation as `0x${string}`],
      chain: chain.viemChain,
      account: walletClient.account!,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    logger.debug({ chain: chain.slug, hash }, 'receivePayableUpdateViaCctp confirmed');
    return null;
  } catch (err) {
    const decoded = decodeCustomError(err);
    if (decoded) return decoded;
    logger.error({ chain: chain.slug, err: stripAbiFromError(err) }, 'receivePayableUpdateViaCctp failed');
    throw err;
  }
}

/**
 * Simulates and submits `receiveForeignPaymentViaCctp` on the destination diamond.
 *
 * @returns The decoded custom error name if the call reverted, null on success.
 * @throws  On network errors or unknown reverts.
 */
export async function submitReceiveForeignPaymentViaCctp(
  chain: EvmChainConfig,
  publicClient: PublicClient,
  walletClient: WalletClient,
  burnMessage: string,
  attestation: string
): Promise<DecodedErrorName> {
  const address = chain.diamondAddress!;

  try {
    await publicClient.simulateContract({
      address,
      abi: chainbillsAbi,
      functionName: 'receiveForeignPaymentViaCctp',
      args: [burnMessage as `0x${string}`, attestation as `0x${string}`],
    });

    const hash: Hash = await walletClient.writeContract({
      address,
      abi: chainbillsAbi,
      functionName: 'receiveForeignPaymentViaCctp',
      args: [burnMessage as `0x${string}`, attestation as `0x${string}`],
      chain: chain.viemChain,
      account: walletClient.account!,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    logger.debug({ chain: chain.slug, hash }, 'receiveForeignPaymentViaCctp confirmed');
    return null;
  } catch (err) {
    const decoded = decodeCustomError(err);
    if (decoded) return decoded;
    logger.error({ chain: chain.slug, err: stripAbiFromError(err) }, 'receiveForeignPaymentViaCctp failed');
    throw err;
  }
}
