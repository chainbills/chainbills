// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Chain Registry
//
// Each entry in this registry fully describes one EVM chain the relayer
// watches. Adding a new chain (testnet or mainnet) is a matter of adding
// one object here — no other files need changing.
//
// Design notes:
//  • deploymentBlock defaults to 0n (BigInt zero) because no mainnet
//    deployments have happened yet. Update this to the actual deployment
//    block to skip unnecessary history scanning.
//  • pollIntervalMs overrides the global POLL_INTERVAL_MS for chains with
//    faster block times (e.g. Arc Testnet's ~500ms blocks → 2s polling).
// ──────────────────────────────────────────────────────────────────────────────

import { parseEther, type Chain as ViemChain } from 'viem';
import { arcTestnet as viemArcTestnet, megaeth as viemMegaeth, sepolia as viemSepolia } from 'viem/chains';

/** Identifies a chain name used throughout the relayer and Firestore paths. */
export type ChainName = 'arctestnet' | 'sepolia' | 'megaeth';

/**
 * Full configuration for one EVM chain the relayer watches.
 *
 * Fields marked "protocol-specific" (wormholeChainId, circleDomain) are
 * optional because not every chain supports both Wormhole and CCTP.
 */
export interface ChainConfig {
  /** Short canonical name — matches the key in server/chain.ts. */
  name: ChainName;
  /** Human-readable display name for logs and notifications. */
  displayName: string;
  /** viem chain object used when creating a PublicClient / WalletClient. */
  viemChain: ViemChain;
  /** RPC URL — read from env at startup (see src/config.ts). */
  rpcUrl: string;
  /**
   * Address of the Chainbills UUPS proxy on this chain.
   * This is the address that emits all events we listen to.
   */
  contractAddress: `0x${string}`;
  /**
   * Address of the CbGetters read-only contract on this chain.
   * Used for on-chain data fetches (getPayable, getPayablePayment, etc.)
   */
  gettersAddress: `0x${string}`;
  /**
   * CAIP-2 cbChainId: keccak256(abi.encodePacked("namespace:reference")).
   * This is the universal key used in all cross-chain fields inside Chainbills
   * contracts, and stored in Firestore records to identify the source chain.
   */
  cbChainId: `0x${string}`;
  /** Network environment for this chain — used for Wormhole and CCTP API selection. */
  network: 'testnet' | 'mainnet';
  /**
   * Whether Wormhole Core is deployed on this chain.
   * Chains without Wormhole skip VAA publishing and VAA fetching.
   */
  hasWormhole: boolean;
  /**
   * Wormhole uint16 chain ID (protocol-specific, set if hasWormhole=true).
   * Used to construct EmitterAddress for VAA fetching.
   */
  wormholeChainId?: number;
  /**
   * Whether Circle CCTP is deployed on this chain.
   * Chains without CCTP cannot receive/relay CCTP-based payable updates.
   */
  hasCctp: boolean;
  /**
   * Circle uint32 domain ID (protocol-specific, set if hasCctp=true).
   * Passed to the Circle Iris API when polling for attestations.
   */
  circleDomain?: number;
  /**
   * The block number from which to start indexing on first run.
   * Defaults to 0n (scan from genesis). Update to the actual deployment
   * transaction block to avoid unnecessary RPC calls on new installs.
   */
  deploymentBlock: bigint;
  /**
   * How often (ms) to poll this chain's getLogs endpoint.
   * Overrides the global POLL_INTERVAL_MS for chains with faster block times.
   */
  pollIntervalMs?: number;
  /**
   * Minimum native token balance required for this chain's gas.
   * If the balance falls below this amount, the relayer logs a critical warning.
   */
  minGasBalance: bigint;
  /**
   * Whether this chain is an EVM or non-EVM chain. Used to determine how to decode addresses.
   * For EVM chains, addresses are 20-byte values left-padded to 32 bytes and represented as hex strings.
   * For non-EVM chains, addresses may be variable-length byte arrays and we can use Wormhole decoding.
   */
  isEvm: boolean;
  isSolana: boolean;
}

// ── Chain Definitions ─────────────────────────────────────────────────────────
// RPC URLs are injected at runtime from environment variables (see config.ts).
// The placeholder strings below are replaced before any chain watcher starts.

export const arcTestnet: ChainConfig = {
  name: 'arctestnet',
  displayName: 'Arc Testnet',
  viemChain: viemArcTestnet,
  rpcUrl: '', // filled from RPC_ARC_TESTNET at startup
  // Arc testnet proxy address (deployed)
  contractAddress: '0x535a2C8A5fa922B7a905B5a784A80401535B4eC1',
  gettersAddress: '0x93a55c2bce0E7EEF51621B18761565328d66bbE5',
  cbChainId: '0xfcfa255b5b1c8e2b9672ea5d7a51e54c78ecbf0f0e87607e8b86ec2cfd25d4fd',
  network: 'testnet',
  hasWormhole: false, // Wormhole NOT deployed on Arc Testnet
  hasCctp: true,
  circleDomain: 26, // Circle domain 26 for Arc Testnet
  deploymentBlock: 42188119n, // First tx block of latest DeployChainbills broadcast (chain 5042002)
  pollIntervalMs: 2000, // Arc has ~500ms blocks; poll every 2s
  minGasBalance: parseEther('10'), // Native token is USDC (18 decimals on Arc); warn below 10 units
  isEvm: true,
  isSolana: false,
};

export const sepolia: ChainConfig = {
  name: 'sepolia',
  displayName: 'Ethereum Sepolia',
  viemChain: viemSepolia,
  rpcUrl: '', // filled from RPC_SEPOLIA at startup
  contractAddress: '0x676FfD548E993E64018Ee23Ba039BBDB15f84699',
  gettersAddress: '0xbb695eF7cda9c6b86EE36049cE2022d15117D113',
  cbChainId: '0xafa90c317deacd3d68f330a30f96e4fa7736e35e8d1426b2e1b2c04bce1c2fb7',
  network: 'testnet',
  hasWormhole: true,
  wormholeChainId: 10002, // Wormhole chain ID for Ethereum Sepolia
  hasCctp: true,
  circleDomain: 0, // Circle domain 0 for Ethereum Sepolia
  deploymentBlock: 10850296n, // First tx block of latest DeployChainbills broadcast (chain 11155111)
  pollIntervalMs: 5000, // Sepolia ~12s blocks; poll every 12s
  minGasBalance: parseEther('0.01'), // Warn below 0.05 ETH
  isEvm: true,
  isSolana: false,
};

export const megaeth: ChainConfig = {
  name: 'megaeth',
  displayName: 'MegaETH Mainnet',
  viemChain: viemMegaeth,
  rpcUrl: '', // filled from RPC_MEGAETH at startup
  // TODO: Update after MegaETH mainnet deployment
  contractAddress: '0x0000000000000000000000000000000000000000',
  gettersAddress: '0x0000000000000000000000000000000000000000',
  cbChainId: '0x78b4988135f242a792c3ba307a59ea12c5ec8c24390a1f41381eeb7c7c444d3a',
  network: 'mainnet', // MegaETH is a mainnet chain
  hasWormhole: true,
  wormholeChainId: 64, // Wormhole chain ID for MegaETH
  hasCctp: false, // Circle CCTP NOT deployed on MegaETH (as of May 2026)
  deploymentBlock: 0n,
  pollIntervalMs: 2000, // MegaETH is a real-time chain; poll every 2s
  minGasBalance: parseEther('0.01'), // Warn below 0.01 ETH
  isEvm: true,
  isSolana: false,
};

/** All chains the relayer watches. Add new chains here. */
export const ALL_CHAINS: ChainConfig[] = [arcTestnet, sepolia /*, megaeth */];

/** Look up a chain config by its CAIP-2 cbChainId. */
export const chainByCbChainId = new Map<string, ChainConfig>(ALL_CHAINS.map((c) => [c.cbChainId, c]));

/** Look up a chain config by its short name. */
export const chainByName = new Map<ChainName, ChainConfig>(ALL_CHAINS.map((c) => [c.name, c]));
