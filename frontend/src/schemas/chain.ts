// schemas/chain.ts
//
// Single source of truth for every chain Chainbills is deployed to. Every
// UI surface that filters, lists or displays chains reads from here — the
// wagmi config in `main.ts`, the connect flow in `SignInButton.vue`, the
// header chain switcher, the stats / activity pages, the block-explorer
// helpers below. No other file hardcodes chain lists.
//
// Code-driven visibility: each `Chain` has a `visible` boolean. Flip it to
// `false` to hide the chain from all UI surfaces without removing its data
// (contract reads on that chain still work). Mainnet chains stay `true`
// forever; testnet chains are toggled from here alone.
//
// Adding a chain: append its `Chain` object below, put it in
// `chainNamesToChains`, extend `ChainName`. `wagmiEvmChains` and every
// UI surface pick it up automatically.

import type { Chain as ViemChain } from 'viem';
import { arc as viemArc, arcTestnet, base as viemBase, baseSepolia, megaeth } from 'viem/chains';

export type ChainName = 'arcmainnet' | 'base' | 'arctestnet' | 'megaeth' | 'basesepolia' | 'solanadevnet';

export type ChainNetworkType = 'mainnet' | 'testnet';

/** One chain Chainbills is deployed to (EVM or Solana), and the facts the rest of the app needs about it. */
export interface Chain {
  /** Internal, URL- and storage-safe identifier, e.g. `'base'`. */
  name: ChainName;
  /** Human-facing name, e.g. `'Base'`. */
  displayName: string;
  /** True for every EVM chain (reads/writes go through `stores/evm.ts`). */
  isEvm: boolean;
  /** True only for Solana chains (reads/writes go through `stores/solana.ts`). */
  isSolana: boolean;
  /** `'mainnet'` or `'testnet'` — mainnet and testnet data must never mix in one list, total or chart. */
  networkType: ChainNetworkType;
  /** `keccak256("namespace:reference")` (CAIP-2) — the universal cross-chain key for this chain. */
  cbChainId: string;
  /**
   * Whether this chain is exposed to end users in the wallet connect dialog,
   * chain switcher, stats and activity views. Code-driven per chain — mainnet
   * chains stay `true`, testnet chains are toggled from here.
   */
  visible: boolean;
  /** The chain's official brand colour (hex). Used only for chain identity
   *  (ChainBadge tints, cross-chain rails, chain-scoped stat accents) — never
   *  as a button or text accent, which always stays the app's own accent
   *  colour (`--accent` in `src/assets/main.css`). */
  brandColor: string;
  /**
   * viem chain object used by wagmi to talk to this chain. Undefined for
   * Solana. On mainnet, `main.ts` filters by `visible` before feeding these
   * into `createConfig({ chains, transports })`.
   */
  viemChain?: ViemChain;
  /** Chainbills proxy / diamond address on this chain, or the Solana program id. */
  contractAddress: string;
  /**
   * Base URL of the chain's block explorer. Used by `getTxUrl` and
   * `getWalletUrl` below — replaces the hardcoded switch statement.
   */
  explorerBase: string;
  /**
   * Optional query suffix appended to explorer URLs (e.g. `cluster=devnet`
   * for Solana explorer). Empty for chains whose explorer has no cluster.
   */
  explorerClusterQuery?: string;
  /** Filename (without extension) of the chain logo in `/public/assets/tokens/`. */
  logoSlug: string;
}

/** Arc Mainnet — mainnet EVM chain, CCTP-enabled (domain 26), no Wormhole. */
export const arcmainnet: Chain = {
  name: 'arcmainnet',
  displayName: 'Arc',
  isEvm: true,
  isSolana: false,
  networkType: 'mainnet',
  cbChainId: '0xb8aed675f862d651b4a8c85f23a045faa0faaa1d162e6eb15d732231df3dc250',
  visible: false,
  brandColor: '#00d2ff',
  viemChain: viemArc,
  contractAddress: '0xa837c89d3550Eb0D18c3988c689509EB2c3A5695',
  explorerBase: 'https://mainnet.arcscan.app',
  logoSlug: 'ARC',
};

/** Base Mainnet — mainnet EVM chain, Wormhole (id 30) and CCTP (domain 6) enabled. */
export const base: Chain = {
  name: 'base',
  displayName: 'Base',
  isEvm: true,
  isSolana: false,
  networkType: 'mainnet',
  cbChainId: '0x43b48883ef7be0f98fe7f98fafb2187e42caab4063697b32816f95e09d69b3ec',
  visible: false,
  brandColor: '#0052ff',
  viemChain: viemBase,
  contractAddress: '0xa837c89d3550Eb0D18c3988c689509EB2c3A5695',
  explorerBase: 'https://basescan.org',
  logoSlug: 'BASE',
};

/** MegaETH — mainnet EVM chain, Wormhole-enabled, no CCTP. Hidden until the diamond ships on MegaETH. */
export const megaethChain: Chain = {
  name: 'megaeth',
  displayName: 'MegaETH',
  isEvm: true,
  isSolana: false,
  networkType: 'mainnet',
  cbChainId: '0x78b4988135f242a792c3ba307a59ea12c5ec8c24390a1f41381eeb7c7c444d3a',
  visible: false,
  brandColor: '#c6f135',
  viemChain: megaeth,
  contractAddress: '0xc38d1681d34DA821E46508C084D673477E455570',
  explorerBase: 'https://megaeth.blockscout.com',
  logoSlug: 'MegaETH',
};

/** Arc Testnet — testnet EVM chain, CCTP-enabled (domain 26), no Wormhole. */
export const arctestnet: Chain = {
  name: 'arctestnet',
  displayName: 'Arc Testnet',
  isEvm: true,
  isSolana: false,
  networkType: 'testnet',
  cbChainId: '0xfcfa255b5b1c8e2b9672ea5d7a51e54c78ecbf0f0e87607e8b86ec2cfd25d4fd',
  visible: true,
  brandColor: '#00d2ff',
  viemChain: arcTestnet,
  contractAddress: '0x3E473E5812542A865086Cb5Cb80D8f3DD3D692A7',
  explorerBase: 'https://testnet.arcscan.app',
  logoSlug: 'ARC',
};

/** Base Sepolia — testnet EVM chain, Wormhole- and CCTP-enabled (domain 6). */
export const basesepolia: Chain = {
  name: 'basesepolia',
  displayName: 'Base Sepolia',
  isEvm: true,
  isSolana: false,
  networkType: 'testnet',
  cbChainId: '0x8a9a9c58b754a98f1ff302a7ead652cfd23eb36a5791767b5d185067dd9481c2',
  visible: true,
  brandColor: '#0052ff',
  viemChain: baseSepolia,
  contractAddress: '0x3E473E5812542A865086Cb5Cb80D8f3DD3D692A7',
  explorerBase: 'https://sepolia.basescan.org',
  logoSlug: 'BASE',
};

/** Solana Devnet — inactive this round; kept only so Solana code paths keep compiling. */
export const solanadevnet: Chain = {
  name: 'solanadevnet',
  displayName: 'Solana Devnet',
  isEvm: false,
  isSolana: true,
  networkType: 'testnet',
  cbChainId: '0x318e886b7d5a2e6f89c50cd1cdc3614e5f66532f673b5f14448b9b58c12e0e6e',
  visible: false,
  brandColor: '#9945ff',
  contractAddress: 'DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk',
  explorerBase: 'https://explorer.solana.com',
  explorerClusterQuery: 'cluster=devnet',
  logoSlug: 'SOL',
};

/** Every known chain, keyed by its `ChainName`. */
export const chainNamesToChains: Record<ChainName, Chain> = {
  arcmainnet,
  base,
  megaeth: megaethChain,
  arctestnet,
  basesepolia,
  solanadevnet,
};

/** Every registered chain in a stable order (mainnet EVM first, testnet EVM next, Solana last). */
export const allChains: Chain[] = [arcmainnet, base, megaethChain, arctestnet, basesepolia, solanadevnet];

/** Every chain currently exposed to end users — filtered by each chain's `visible` boolean. */
export const visibleChains = (): Chain[] => allChains.filter((c) => c.visible);

/** Visible EVM chains — the set the wallet-connect dialog and chain switcher present. */
export const visibleEvmChains = (): Chain[] => allChains.filter((c) => c.visible && c.isEvm);

/**
 * viem chain objects for every visible EVM chain, in registration order.
 * Fed to wagmi's `createConfig({ chains, transports })` in `main.ts` so the
 * wagmi client mirrors this list without a second hardcoded copy.
 */
export const wagmiEvmChains = (): [ViemChain, ...ViemChain[]] => {
  const chains = visibleEvmChains()
    .map((c) => c.viemChain)
    .filter((v): v is ViemChain => v !== undefined);
  if (chains.length === 0) {
    throw new Error('no visible EVM chains — check schemas/chain.ts');
  }
  return chains as [ViemChain, ...ViemChain[]];
};

/** Every visible chain of a given network type. Never mix mainnet and testnet in one list. */
export const chainsByNetwork = (networkType: ChainNetworkType): Chain[] =>
  visibleChains().filter((c) => c.networkType === networkType);

/** Names of every EVM chain — used by activity / stats / scan stores that iterate chains. */
export const chainNamesEvm: ChainName[] = allChains.filter((c) => c.isEvm).map((c) => c.name);

/** Names of every chain — used by activity / stats / scan stores that iterate chains. */
export const chainNames: ChainName[] = allChains.map((c) => c.name);

/**
 * Block-explorer URL for a transaction hash on `chain`. Builds the URL from
 * the chain's `explorerBase` (and optional `explorerClusterQuery`) — the
 * per-chain switch statement lives only in the constants above.
 */
export const getTxUrl = (txHash: string, chain: Chain): string => {
  const suffix = chain.explorerClusterQuery ? `?${chain.explorerClusterQuery}` : '';
  return `${chain.explorerBase}/tx/${txHash}${suffix}`;
};

/** Block-explorer URL for a wallet address on `chain`. See `getTxUrl`. */
export const getWalletUrl = (wallet: string, chain: Chain): string => {
  const suffix = chain.explorerClusterQuery ? `?${chain.explorerClusterQuery}` : '';
  return `${chain.explorerBase}/address/${wallet}${suffix}`;
};

/** Local asset path for a chain's logo image. */
export const getChainLogo = (chain: Chain): string => `/assets/tokens/${chain.logoSlug}.png`;

/** Reverse lookup: on-chain `bytes32` cbChainId → the `Chain` it identifies. */
export const cbChainIdToChain: Record<string, Chain> = Object.fromEntries(allChains.map((c) => [c.cbChainId, c]));

/** Reverse lookup: viem chain id (number) → the `Chain` it identifies. Only defined for EVM chains. */
export const evmChainIdToChain: Record<number, Chain> = Object.fromEntries(
  allChains.filter((c) => c.viemChain).map((c) => [c.viemChain!.id, c])
);

/** The result of a successful write transaction: the id it created, its tx hash, and the chain it ran on. */
export class OnChainSuccess {
  created: string;
  txHash: string;
  chain: Chain;
  /** The `PayableUpdateBroadcasted` nonce, when this write broadcasts a payable update (create/close/reopen/updateTokens). */
  broadcastNonce?: bigint;

  constructor(input: any) {
    this.created = input['created'];
    this.txHash = input['txHash'];
    this.chain = input['chain'];
    this.broadcastNonce = input['broadcastNonce'];
  }

  /** The block-explorer URL for this transaction. */
  get explorerUrl() {
    return getTxUrl(this.txHash, this.chain);
  }
}

/** Re-export the singular `megaeth` symbol to preserve existing imports. */
export { megaethChain as megaeth };
