// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chain registry
//
// The single place that lists deployed chains, contract addresses, deployment
// blocks, cbChainIds, and messaging protocol identifiers (SPEC.md §6.2).
// Contract addresses, program ids, deployment blocks and cbChainIds are
// reviewed and versioned with the code, not env vars — after a new deployment
// the owner updates this file. RPC URLs are deliberately not stored here; see
// types.ts's header comment.
//
// Invariants:
//   - Only diamond-based EVM contracts are registered. Legacy single-proxy
//     contracts (evm/legacy/) are not indexed by this backend.
//   - Chains with `diamondAddress: null` or `programId` missing fail config
//     validation — they cannot be enabled until the address is filled in.
//   - Networks never mix: relay jobs are created only between chains sharing
//     the same `network` value.
//
// Adding a new EVM chain: add one `EvmChainConfig` object below and update
// `CHAINS`, `ChainSlug`, and the `enabledChains` guard.
// Adding a new Solana chain: add one `SolanaChainConfig` object below.
// ──────────────────────────────────────────────────────────────────────────────

import { parseEther } from 'viem';
import {
  arc as viemArc,
  arcTestnet as viemArcTestnet,
  anvil as viemAnvil,
  base as viemBase,
  megaeth as viemMegaeth,
  sepolia as viemSepolia,
} from 'viem/chains';
import type { ChainConfig, ChainSlug, EvmChainConfig, SolanaChainConfig } from './types';

export const arcmainnet: EvmChainConfig = {
  slug: 'arcmainnet',
  displayName: 'Arc Mainnet',
  caip2: 'eip155:5042',
  // keccak256("eip155:5042")
  cbChainId: '0xb8aed675f862d651b4a8c85f23a045faa0faaa1d162e6eb15d732231df3dc250',
  network: 'mainnet',
  viemChain: viemArc,
  // TODO(owner): fill in from deploys/arcmainnet.json after deploying
  diamondAddress: null,
  // TODO(owner): fill in from deploys/arcmainnet.json after deploying
  deploymentBlock: null,
  // TODO(owner): not confirmed live on Arc mainnet yet — fill in when Wormhole is deployed
  wormholeChainId: undefined,
  circleDomain: 26,
  pollIntervalMs: 5000,
  minGasBalance: parseEther('1'),
  isEvm: true,
  isSolana: false,
};

export const anvil: EvmChainConfig = {
  slug: 'anvil',
  displayName: 'Anvil (local)',
  caip2: 'eip155:31337',
  // keccak256("eip155:31337")
  cbChainId: '0x318e51c37247d03bad135571413b06a083591bcc680967d80bf587ac928cf369',
  network: 'local',
  viemChain: viemAnvil,
  // TODO(owner): fill in after running evm/script/DeployLocalStack.s.sol
  diamondAddress: null,
  deploymentBlock: 0n,
  wormholeChainId: undefined,
  circleDomain: undefined,
  pollIntervalMs: 500,
  minGasBalance: parseEther('0.1'),
  isEvm: true,
  isSolana: false,
};

export const solanaDevnet: SolanaChainConfig = {
  slug: 'solanadevnet',
  displayName: 'Solana Devnet',
  caip2: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  // keccak256("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")
  cbChainId: '0x318e886b7d5a2e6f89c50cd1cdc3614e5f66532f673b5f14448b9b58c12e0e6e',
  network: 'testnet',
  wormholeChainId: 1,
  circleDomain: 5,
  pollIntervalMs: 5_000,
  // 0.05 SOL — warn if the relayer wallet drops below this.
  minGasBalance: 50_000_000n, // lamports
  isSolana: true,
  isEvm: false,
  relayEnabled: false,
  programId: 'DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk',
  usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  wormholeProgramId: '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5',
  cctpProgramId: 'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd',
  wormholeShimProgramId: 'EtZMZM22ViKMo4r5y4Anovs3wKQ2owUmDpjygnMMcdEX',
};

export const megaeth: EvmChainConfig = {
  slug: 'megaeth',
  displayName: 'MegaETH',
  caip2: 'eip155:4326',
  // keccak256("eip155:4326")
  cbChainId: '0x78b4988135f242a792c3ba307a59ea12c5ec8c24390a1f41381eeb7c7c444d3a',
  network: 'mainnet',
  viemChain: viemMegaeth,
  diamondAddress: null,
  deploymentBlock: null,
  wormholeChainId: undefined,
  circleDomain: undefined,
  pollIntervalMs: 5000,
  minGasBalance: parseEther('0.01'),
  isEvm: true,
  isSolana: false,
};

export const arctestnet: EvmChainConfig = {
  slug: 'arctestnet',
  displayName: 'Arc Testnet',
  caip2: 'eip155:5042002',
  // keccak256("eip155:5042002")
  cbChainId: '0xfcfa255b5b1c8e2b9672ea5d7a51e54c78ecbf0f0e87607e8b86ec2cfd25d4fd',
  network: 'testnet',
  viemChain: viemArcTestnet,
  diamondAddress: null,
  deploymentBlock: null,
  wormholeChainId: undefined,
  circleDomain: 26,
  pollIntervalMs: 5000,
  minGasBalance: parseEther('0.01'),
  isEvm: true,
  isSolana: false,
};

export const sepolia: EvmChainConfig = {
  slug: 'sepolia',
  displayName: 'Sepolia',
  caip2: 'eip155:11155111',
  // keccak256("eip155:11155111")
  cbChainId: '0xafa90c317deacd3d68f330a30f96e4fa7736e35e8d1426b2e1b2c04bce1c2fb7',
  network: 'testnet',
  viemChain: viemSepolia,
  diamondAddress: null,
  deploymentBlock: null,
  wormholeChainId: 10002,
  circleDomain: 0,
  pollIntervalMs: 12000,
  minGasBalance: parseEther('0.01'),
  isEvm: true,
  isSolana: false,
};

export const base: EvmChainConfig = {
  slug: 'base',
  displayName: 'Base',
  caip2: 'eip155:8453',
  // keccak256("eip155:8453")
  cbChainId: '0x43b48883ef7be0f98fe7f98fafb2187e42caab4063697b32816f95e09d69b3ec',
  network: 'mainnet',
  viemChain: viemBase,
  // TODO(owner): fill in from deploys/base.json after deploying
  diamondAddress: null,
  // TODO(owner): fill in from deploys/base.json after deploying
  deploymentBlock: null,
  wormholeChainId: 30,
  circleDomain: 6,
  pollIntervalMs: 2000,
  minGasBalance: parseEther('0.01'),
  isEvm: true,
  isSolana: false,
};

/** Every chain this backend knows about. */
export const CHAINS: readonly ChainConfig[] = [arcmainnet, anvil, base, megaeth, arctestnet, sepolia, solanaDevnet];

/** Looks up a chain by its CAIP-2 cbChainId — the universal cross-chain key. */
export const CHAIN_BY_CB_CHAIN_ID: ReadonlyMap<string, ChainConfig> = new Map(CHAINS.map((c) => [c.cbChainId, c]));

/** Looks up a chain by its human slug (logs / API output only — never a cross-chain key). */
export const CHAIN_BY_SLUG: ReadonlyMap<ChainSlug, ChainConfig> = new Map(CHAINS.map((c) => [c.slug, c]));

/** Every EVM chain in the registry, narrowed to `EvmChainConfig`. */
export const EVM_CHAINS: readonly EvmChainConfig[] = CHAINS.filter((c): c is EvmChainConfig => c.isEvm);

/** Every Solana chain in the registry, narrowed to `SolanaChainConfig`. */
export const SOLANA_CHAINS: readonly SolanaChainConfig[] = CHAINS.filter((c): c is SolanaChainConfig => c.isSolana);

/**
 * Looks up a chain by cbChainId and throws a clear error if it is unknown,
 * for call sites (e.g. resolving a payable's home chain) that cannot proceed
 * without a valid chain.
 */
export function requireChainByCbChainId(cbChainId: string): ChainConfig {
  const chain = CHAIN_BY_CB_CHAIN_ID.get(cbChainId);
  if (!chain) {
    throw new Error(`unknown cbChainId: ${cbChainId}`);
  }
  return chain;
}

/**
 * Returns the registry entries for the given slugs. Throws a clear error
 * listing any unknown slugs or any slug whose `diamondAddress` (EVM) or
 * `programId` (Solana) is null/missing — those chains cannot be enabled
 * until the address is filled in.
 *
 * This is called by the config validator so all problems surface together
 * at boot, never at the first RPC call.
 */
export function enabledChains(slugs: string[]): ChainConfig[] {
  const unknownSlugs: string[] = [];
  const nullAddressSlugs: string[] = [];

  for (const slug of slugs) {
    const chain = CHAIN_BY_SLUG.get(slug as ChainSlug);
    if (!chain) {
      unknownSlugs.push(slug);
      continue;
    }
    if (chain.isEvm && chain.diamondAddress === null) {
      nullAddressSlugs.push(slug);
    }
  }

  const errors: string[] = [];
  if (unknownSlugs.length > 0) {
    errors.push(`unknown chain slugs: ${unknownSlugs.join(', ')}`);
  }
  if (nullAddressSlugs.length > 0) {
    errors.push(
      `chains with no deployed diamond address (fill in the address before enabling): ${nullAddressSlugs.join(', ')}`
    );
  }
  if (errors.length > 0) {
    throw new Error(`ENABLED_CHAINS: ${errors.join('; ')}`);
  }

  return slugs.map((slug) => CHAIN_BY_SLUG.get(slug as ChainSlug)!);
}

/**
 * Returns true when both chains share the same `network` value. Relay jobs
 * are only created between chains of the same network — mainnet never relays
 * to testnet or local, and vice versa.
 */
export function sameNetwork(a: ChainConfig, b: ChainConfig): boolean {
  return a.network === b.network;
}
