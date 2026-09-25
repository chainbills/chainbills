// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chain registry types
//
// The one deliberate difference from the relayer: nothing here carries an
// `rpcUrl` field. SPEC.md §6 requires RPC URLs to be "injected from config at
// module init, not mutated globals" — the relayer's pattern of a shared
// `rpcUrl: ''` placeholder mutated in place at startup is exactly what that
// forbids. Instead, `src/chains/clients.ts` factories take the RPC URL as an
// explicit argument, sourced from `AppConfigService`.
// ──────────────────────────────────────────────────────────────────────────────

import type { Chain as ViemChain } from 'viem';

/**
 * Human slug for a chain — used only in logs, config keys and API output.
 * Never a cross-chain key: use `cbChainId` for that.
 */
export type ChainSlug = 'arcmainnet' | 'anvil' | 'base' | 'solanadevnet' | 'megaeth' | 'arctestnet' | 'sepolia';

/** Network environment — selects the Wormhole and CCTP API tier. */
export type Network = 'mainnet' | 'testnet' | 'local';

/** Fields common to every chain the registry knows about. */
export interface BaseChainConfig {
  /** Short canonical slug — see {@link ChainSlug}. */
  slug: ChainSlug;
  /** Human-readable display name for logs, notifications and API output. */
  displayName: string;
  /** CAIP-2 identifier string, e.g. "eip155:5042" or "solana:...". */
  caip2: string;
  /**
   * CAIP-2 cbChainId: `keccak256("namespace:reference")`. The universal
   * cross-chain key used everywhere in the contracts, the database and the
   * API — never the Wormhole uint16 id or the Circle uint32 domain.
   */
  cbChainId: string;
  /** Network environment — selects the Wormhole and CCTP API to use. */
  network: Network;
  /** Wormhole uint16 chain id. Absent when Wormhole is not deployed on this chain. */
  wormholeChainId?: number;
  /** Circle uint32 domain id. Absent when CCTP is not deployed on this chain. */
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
  /**
   * Address of the Chainbills ERC-2535 diamond on this chain, or null when
   * not yet deployed. Config validation rejects enabling a chain with null here.
   */
  diamondAddress: `0x${string}` | null;
}

/** Configuration for the Solana chain, watched and submitted to via @solana/web3.js + Anchor. */
export interface SolanaChainConfig extends BaseChainConfig {
  isSolana: true;
  isEvm: false;
  /** Chainbills program id on Solana. */
  programId: string;
  /** Whether this chain participates in relaying (false for indexing-only chains). */
  relayEnabled: boolean;
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
