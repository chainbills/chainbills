// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chain registry types
//
// Ported from relayer/src/chains.ts. The one deliberate difference: nothing
// here carries an `rpcUrl` field. SPEC.md §6 requires RPC URLs to be
// "injected from config at module init, not mutated globals" — the relayer's
// pattern of a shared `rpcUrl: ''` placeholder mutated in place at startup is
// exactly what that forbids. Instead, `src/chains/clients.ts` factories take
// the RPC URL as an explicit argument, sourced from `AppConfigService`.
// ──────────────────────────────────────────────────────────────────────────────

import type { Chain as ViemChain } from 'viem';

/**
 * Human slug for a chain — matches the frontend's chain slugs, used only in
 * logs and API output (SPEC.md §6). Never a cross-chain key: use `cbChainId`
 * for that. Solana devnet's slug is `solanadevnet`, not `solana`.
 */
export type ChainSlug = 'arctestnet' | 'sepolia' | 'megaeth' | 'solanadevnet';

/** Fields common to every chain the registry knows about. */
export interface BaseChainConfig {
  /** Short canonical slug — see {@link ChainSlug}. */
  slug: ChainSlug;
  /** Human-readable display name for logs, notifications and API output. */
  displayName: string;
  /**
   * CAIP-2 cbChainId: `keccak256("namespace:reference")`. The universal
   * cross-chain key used everywhere in the contracts, the database and the
   * API — never the Wormhole uint16 id or the Circle uint32 domain.
   */
  cbChainId: string;
  /** Network environment — selects the Wormhole and CCTP API to use. */
  network: 'testnet' | 'mainnet';
  /** Whether Wormhole Core is deployed on this chain. */
  hasWormhole: boolean;
  /** Wormhole uint16 chain id (set iff hasWormhole). */
  wormholeChainId?: number;
  /** Whether Circle CCTP is deployed on this chain. */
  hasCctp: boolean;
  /** Circle uint32 domain id (set iff hasCctp). */
  circleDomain?: number;
  /** Default poll interval for this chain's indexing loop, in ms. */
  pollIntervalMs?: number;
  /** Minimum CCTP attestation age (ms) before a relay job on this chain is attempted. */
  cctpAttestationMinAgeMs?: number;
  /**
   * Minimum native token balance (smallest unit — wei for EVM, lamports for
   * Solana) before the worker's gas-balance check warns.
   */
  minGasBalance: bigint;
  /** Discriminant: true for EVM chains (viem-based). */
  isEvm: boolean;
  /** Discriminant: true for Solana chains (web3.js-based). */
  isSolana: boolean;
}

/** Configuration for one EVM chain, watched and submitted to via viem. */
export interface EvmChainConfig extends BaseChainConfig {
  isEvm: true;
  isSolana: false;
  /** viem chain object used to construct PublicClient / WalletClient instances. */
  viemChain: ViemChain;
  /** Address of the Chainbills UUPS proxy on this chain — emits every indexed event. */
  contractAddress: `0x${string}`;
  /** Address of the CbGetters read-only contract on this chain. */
  gettersAddress: `0x${string}`;
  /** Block number to start indexing from on a cold cursor (the deployment block). */
  deploymentBlock: bigint;
}

/** Configuration for the Solana chain, watched and submitted to via @solana/web3.js + Anchor. */
export interface SolanaChainConfig extends BaseChainConfig {
  isSolana: true;
  isEvm: false;
  /** Chainbills program id on Solana. */
  programId: string;
  /** USDC mint address on this Solana network. */
  usdcMint: string;
  /** Wormhole Core Bridge program address. */
  wormholeProgramId: string;
  /** Circle CCTP MessageTransmitter program address. */
  cctpProgramId: string;
  /** Wormhole Post-Message Shim program address. */
  wormholeShimProgramId: string;
}

/** Discriminated union of every chain type the registry supports. */
export type ChainConfig = EvmChainConfig | SolanaChainConfig;
