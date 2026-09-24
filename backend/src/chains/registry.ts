// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chain registry
//
// Ports relayer/src/chains.ts + relayer/src/chains/solana-devnet.ts (SPEC.md
// §6). Contract addresses, program ids, deployment blocks and cbChainIds are
// reviewed and versioned with the code, not env vars — after a new
// deployment the owner updates this one file. RPC URLs are deliberately not
// stored here; see types.ts's header comment.
//
// Adding a new EVM chain: add one `EvmChainConfig` object below.
// Adding a new Solana chain: add one `SolanaChainConfig` object below.
// No other file needs to change for a new chain.
// ──────────────────────────────────────────────────────────────────────────────

import { parseEther } from 'viem';
import { arcTestnet as viemArcTestnet, megaeth as viemMegaeth, sepolia as viemSepolia } from 'viem/chains';
import type { ChainConfig, ChainSlug, EvmChainConfig, SolanaChainConfig } from './types';

export const arcTestnet: EvmChainConfig = {
  slug: 'arctestnet',
  displayName: 'Arc Testnet',
  viemChain: viemArcTestnet,
  contractAddress: '0x0bA837eF7358981967FB2cFcB79bf649b7cACbf4',
  gettersAddress: '0x01656b5968C4b98F05F596344DA7066118d6738a',
  // keccak256("eip155:5042002")
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
  slug: 'sepolia',
  displayName: 'Ethereum Sepolia',
  viemChain: viemSepolia,
  contractAddress: '0x48353Ab7662Bc8218811Fbbdf247cCc8602fba8A',
  gettersAddress: '0x325D77a09F267A7aF695aB5E68F7ddF0eC530a38',
  // keccak256("eip155:11155111")
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
  slug: 'megaeth',
  displayName: 'MegaETH Mainnet',
  viemChain: viemMegaeth,
  contractAddress: '0xc38d1681d34Da821E46508C084D673477E455570',
  gettersAddress: '0x9885b3807f14Fe3DB010fB8BD98C60716f6468a8',
  // keccak256("eip155:4326")
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

export const solanaDevnet: SolanaChainConfig = {
  slug: 'solanadevnet',
  displayName: 'Solana Devnet',
  // keccak256("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")
  cbChainId: '0x318e886b7d5a2e6f89c50cd1cdc3614e5f66532f673b5f14448b9b58c12e0e6e',
  network: 'testnet',
  hasWormhole: true,
  wormholeChainId: 1,
  hasCctp: true,
  circleDomain: 5,
  pollIntervalMs: 5_000,
  // 0.05 SOL — warn if the relayer wallet drops below this.
  minGasBalance: 50_000_000n, // lamports
  isSolana: true,
  isEvm: false,
  programId: 'DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk',
  usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  wormholeProgramId: '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5',
  cctpProgramId: 'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd',
  wormholeShimProgramId: 'EtZMZM22ViKMo4r5y4Anovs3wKQ2owUmDpjygnMMcdEX',
};

/** Every chain this backend indexes and relays for. */
export const CHAINS: readonly ChainConfig[] = [arcTestnet, sepolia, megaeth, solanaDevnet];

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
