// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Relayer — Solana Devnet Chain Config
// ──────────────────────────────────────────────────────────────────────────────

import type { SolanaChainConfig } from '../chains.js';

/**
 * Solana devnet chain config.
 *
 * cbChainId = keccak256("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")
 * Wormhole chain ID for Solana = 1
 * Circle CCTP domain for Solana = 5
 */
export const solanaDevnet: SolanaChainConfig = {
  name: 'solana',
  displayName: 'Solana Devnet',
  rpcUrl: '', // filled from SOLANA_RPC_URL at startup
  // keccak256("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")
  cbChainId: '0x318e886b7d5a2e6f89c50cd1cdc3614e5f66532f673b5f14448b9b58c12e0e6e',
  network: 'testnet',
  hasWormhole: true,
  wormholeChainId: 1,
  hasCctp: true,
  circleDomain: 5,
  pollIntervalMs: 5_000,
  // 0.05 SOL — warn if relayer wallet drops below this
  minGasBalance: 50_000_000n, // lamports
  isSolana: true,
  isEvm: false,
  programId: 'DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk',
  // Devnet USDC mint
  usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  // Wormhole Core devnet
  wormholeProgramId: '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5',
  // CCTP V1 devnet (testnet)
  cctpProgramId: 'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd',
  // Wormhole Post-Message Shim
  wormholeShimProgramId: 'EtZMZM22ViKMo4r5y4Anovs3wKQ2owUmDpjygnMMcdEX',
};
