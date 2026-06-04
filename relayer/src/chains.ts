// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Chain Registry
//
// Two chain types:
//   EvmChainConfig  — EVM chains watched via viem (getLogs, readContract, etc.)
//   SolanaChainConfig — Solana chains watched via @solana/web3.js + Anchor
//
// Adding a new EVM chain: add one EvmChainConfig object here.
// Adding a new Solana chain: add one SolanaChainConfig object here.
// No other files need changing for new chains.
// ──────────────────────────────────────────────────────────────────────────────

import { parseEther, type Chain as ViemChain } from 'viem';
import { arcTestnet as viemArcTestnet, megaeth as viemMegaeth, sepolia as viemSepolia } from 'viem/chains';

/** All chain names used throughout the relayer and Firestore paths. */
export type ChainName = 'arctestnet' | 'sepolia' | 'megaeth' | 'solana';

/** Fields common to all chain types. */
export interface BaseChainConfig {
  /** Short canonical name — matches Firestore path keys. */
  name: ChainName;
  /** Human-readable display name for logs and notifications. */
  displayName: string;
  /** RPC URL — read from env at startup (see src/config.ts). */
  rpcUrl: string;
  /**
   * CAIP-2 cbChainId: keccak256("namespace:reference").
   * Universal cross-chain key used in all Chainbills contracts and Firestore.
   */
  cbChainId: string;
  /** Network environment — used for Wormhole and CCTP API selection. */
  network: 'testnet' | 'mainnet';
  /** Whether Wormhole Core is deployed on this chain. */
  hasWormhole: boolean;
  /** Wormhole uint16 chain ID (set if hasWormhole=true). */
  wormholeChainId?: number;
  /** Whether Circle CCTP is deployed on this chain. */
  hasCctp: boolean;
  /** Circle uint32 domain ID (set if hasCctp=true). */
  circleDomain?: number;
  /** How often (ms) to poll this chain. */
  pollIntervalMs?: number;
  /** Minimum CCTP attestation age (ms) before polling starts. */
  cctpAttestationMinAgeMs?: number;
  /**
   * Minimum native token balance (in smallest unit) before the relayer warns.
   * ETH wei for EVM; lamports for Solana.
   */
  minGasBalance: bigint;
  /** True for EVM chains (viem-based). */
  isEvm: boolean;
  /** True for Solana chains (web3.js-based). */
  isSolana: boolean;
}

/**
 * Full configuration for one EVM chain the relayer watches.
 * Uses viem for client creation and ABI-based contract interaction.
 */
export interface EvmChainConfig extends BaseChainConfig {
  isEvm: true;
  isSolana: false;
  /** viem chain object used when creating PublicClient / WalletClient. */
  viemChain: ViemChain;
  /**
   * Address of the Chainbills UUPS proxy on this chain.
   * Emits all events the relayer listens to.
   */
  contractAddress: `0x${string}`;
  /**
   * Address of the CbGetters read-only contract on this chain.
   * Used for on-chain data fetches (getPayable, getPayablePayment, etc.)
   */
  gettersAddress: `0x${string}`;
  /**
   * Block number from which to start indexing on first run.
   * Set to actual deployment block to skip unnecessary history scanning.
   */
  deploymentBlock: bigint;
}

/**
 * Full configuration for the Solana chain the relayer watches.
 * Uses @solana/web3.js + Anchor for connection and instruction building.
 */
export interface SolanaChainConfig extends BaseChainConfig {
  isSolana: true;
  isEvm: false;
  /** Chainbills program ID on Solana. */
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

/** Discriminated union of all supported chain types. */
export type ChainConfig = EvmChainConfig | SolanaChainConfig;

// ── EVM Chain Definitions ─────────────────────────────────────────────────────

export const arcTestnet: EvmChainConfig = {
  name: 'arctestnet',
  displayName: 'Arc Testnet',
  viemChain: viemArcTestnet,
  rpcUrl: '', // filled from RPC_ARC_TESTNET at startup
  contractAddress: '0x0bA837eF7358981967FB2cFcB79bf649b7cACbf4',
  gettersAddress: '0x01656b5968C4b98F05F596344DA7066118d6738a',
  cbChainId: '0xfcfa255b5b1c8e2b9672ea5d7a51e54c78ecbf0f0e87607e8b86ec2cfd25d4fd',
  network: 'testnet',
  hasWormhole: false,
  hasCctp: true,
  circleDomain: 26,
  deploymentBlock: 42188119n,
  pollIntervalMs: 5000,
  minGasBalance: parseEther('1'),
  isEvm: true,
  isSolana: false,
};

export const sepolia: EvmChainConfig = {
  name: 'sepolia',
  displayName: 'Ethereum Sepolia',
  viemChain: viemSepolia,
  rpcUrl: '', // filled from RPC_SEPOLIA at startup
  contractAddress: '0x48353Ab7662Bc8218811Fbbdf247cCc8602fba8A',
  gettersAddress: '0x325D77a09F267A7aF695aB5E68F7ddF0eC530a38',
  cbChainId: '0xafa90c317deacd3d68f330a30f96e4fa7736e35e8d1426b2e1b2c04bce1c2fb7',
  network: 'testnet',
  hasWormhole: true,
  wormholeChainId: 10002,
  hasCctp: true,
  circleDomain: 0,
  deploymentBlock: 10850296n,
  pollIntervalMs: 10_000,
  minGasBalance: parseEther('0.01'),
  isEvm: true,
  isSolana: false,
};

export const megaeth: EvmChainConfig = {
  name: 'megaeth',
  displayName: 'MegaETH Mainnet',
  viemChain: viemMegaeth,
  rpcUrl: '', // filled from RPC_MEGAETH at startup
  contractAddress: '0xc38d1681d34Da821E46508C084D673477E455570',
  gettersAddress: '0x9885b3807f14Fe3DB010fB8BD98C60716f6468a8',
  cbChainId: '0x78b4988135f242a792c3ba307a59ea12c5ec8c24390a1f41381eeb7c7c444d3a',
  network: 'mainnet',
  hasWormhole: true,
  wormholeChainId: 64,
  hasCctp: false,
  deploymentBlock: 0n,
  pollIntervalMs: 5000,
  minGasBalance: parseEther('0.0001'),
  isEvm: true,
  isSolana: false,
};

// ── Solana Chain Definitions ──────────────────────────────────────────────────

import { solanaDevnet } from './chains/solana-devnet.js';
export { solanaDevnet };

// ── All Chains ────────────────────────────────────────────────────────────────

/** All chains the relayer watches. Add new chains here. */
export const ALL_CHAINS: ChainConfig[] = [arcTestnet, sepolia, megaeth, solanaDevnet];

/** Look up a chain config by its CAIP-2 cbChainId. */
export const chainByCbChainId = new Map<string, ChainConfig>(ALL_CHAINS.map((c) => [c.cbChainId, c]));

/** Look up a chain config by its short name. */
export const chainByName = new Map<ChainName, ChainConfig>(ALL_CHAINS.map((c) => [c.name, c]));
