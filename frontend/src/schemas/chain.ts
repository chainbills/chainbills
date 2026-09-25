// schemas/chain.ts
//
// Describes the chains Chainbills is deployed to (`Chain`), the constant
// instances for each one, and the small pure helpers that turn a chain +
// address/txHash into a block-explorer URL or a local logo path. `cbChainId`
// is the cross-chain key used everywhere in this app and on-chain: it is
// `keccak256("namespace:reference")` per CAIP-2, never a Wormhole uint16 id
// or a Circle uint32 domain. `cbChainIdToChain` is how the frontend maps an
// on-chain `bytes32` chain id (found in payments, payables, activity
// records) back to a `Chain` it can render.
//
// Used by: every schema and store that resolves "which chain is this
// entity on" (`schemas/*`, `stores/evm.ts`, `stores/activity.ts`), and every
// view that links out to a wallet or transaction on a block explorer.
export type ChainName = 'arctestnet' | 'megaeth' | 'basesepolia' | 'solanadevnet';
export const chainNamesEvm: ChainName[] = ['megaeth', 'arctestnet', 'basesepolia'];
export const chainNames: ChainName[] = [...chainNamesEvm, 'solanadevnet'];

export type ChainNetworkType = 'mainnet' | 'testnet';

/** One chain Chainbills is deployed to (EVM or Solana), and the facts the rest of the app needs about it. */
export interface Chain {
  /** Internal, URL- and storage-safe identifier, e.g. `'megaeth'`. */
  name: ChainName;
  /** Human-facing name, e.g. `'MegaETH'`. */
  displayName: string;
  /** True for every EVM chain (reads/writes go through `stores/evm.ts`). */
  isEvm: boolean;
  /** True only for Solana chains (reads/writes go through `stores/solana.ts`). */
  isSolana: boolean;
  /** `'mainnet'` or `'testnet'` — mainnet and testnet data must never mix in one list, total or chart. */
  networkType: ChainNetworkType;
  /** `keccak256("namespace:reference")` (CAIP-2) — the universal cross-chain key for this chain. */
  cbChainId: string;
  /** The chain's official brand colour (hex). Used only for chain identity
   *  (ChainBadge tints, cross-chain rails, chain-scoped stat accents) — never
   *  as a button or text accent, which always stays the app's own accent
   *  colour (`--accent` in `src/assets/main.css`). */
  brandColor: string;
}

/**
 * Block-explorer URL for a transaction hash on `chain`. MegaETH's mainnet
 * and testnet address/tx pages both live on the same Blockscout instance —
 * `getWalletUrl` below must use that same instance, or wallet and tx links
 * for the same chain would point at two different explorers.
 */
export const getTxUrl = (txHash: string, chain: Chain) => {
  if (chain.name === 'megaeth') return `https://megaeth.blockscout.com/tx/${txHash}`;
  if (chain.name === 'arctestnet') return `https://testnet.arcscan.app/tx/${txHash}`;
  if (chain.name === 'basesepolia') return `https://sepolia.basescan.org/tx/${txHash}`;
  if (chain.name === 'solanadevnet') return `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
  throw 'Unhandled Chain in GetTxUrl';
};

/** Block-explorer URL for a wallet address on `chain`. See `getTxUrl` for why MegaETH uses Blockscout here too. */
export const getWalletUrl = (wallet: string, chain: Chain) => {
  if (chain.name === 'megaeth') return `https://megaeth.blockscout.com/address/${wallet}`;
  if (chain.name === 'arctestnet') return `https://testnet.arcscan.app/address/${wallet}`;
  if (chain.name === 'basesepolia') return `https://sepolia.basescan.org/address/${wallet}`;
  if (chain.name === 'solanadevnet') return `https://explorer.solana.com/address/${wallet}?cluster=devnet`;
  throw 'Unhandled Chain in GetWalletUrl';
};

/** Local asset path for a chain's logo image. */
export const getChainLogo = (chain: Chain) => {
  if (chain.name === 'megaeth') return '/assets/tokens/MegaETH.png';
  if (chain.name === 'arctestnet') return '/assets/tokens/ARC.png';
  if (chain.name === 'basesepolia') return '/assets/tokens/BASE.png';
  if (chain.name === 'solanadevnet') return '/assets/tokens/SOL.png';
  throw 'Unhandled Chain in GetChainLogo';
};

/** MegaETH — mainnet EVM chain, Wormhole-enabled, no CCTP. */
export const megaeth: Chain = {
  name: 'megaeth',
  displayName: 'MegaETH',
  isEvm: true,
  isSolana: false,
  networkType: 'mainnet',
  cbChainId: '0x78b4988135f242a792c3ba307a59ea12c5ec8c24390a1f41381eeb7c7c444d3a',
  brandColor: '#c6f135',
};

/** Arc Testnet — testnet EVM chain, CCTP-enabled (domain 26), no Wormhole. */
export const arctestnet: Chain = {
  name: 'arctestnet',
  displayName: 'Arc Testnet',
  isEvm: true,
  isSolana: false,
  networkType: 'testnet',
  cbChainId: '0xfcfa255b5b1c8e2b9672ea5d7a51e54c78ecbf0f0e87607e8b86ec2cfd25d4fd',
  brandColor: '#00d2ff',
};

/** Base Sepolia — testnet EVM chain, Wormhole- and CCTP-enabled (domain 6). */
export const basesepolia: Chain = {
  name: 'basesepolia',
  displayName: 'Base Sepolia',
  isEvm: true,
  isSolana: false,
  networkType: 'testnet',
  cbChainId: '0x8a9a9c58b754a98f1ff302a7ead652cfd23eb36a5791767b5d185067dd9481c2',
  brandColor: '#0052ff',
};

/** Solana Devnet — inactive this round; kept only so Solana code paths keep compiling. */
export const solanadevnet: Chain = {
  name: 'solanadevnet',
  displayName: 'Solana Devnet',
  isEvm: false,
  isSolana: true,
  networkType: 'testnet',
  cbChainId: '0x318e886b7d5a2e6f89c50cd1cdc3614e5f66532f673b5f14448b9b58c12e0e6e',
  brandColor: '#9945ff',
};

/** Every known chain, keyed by its `ChainName`. */
export const chainNamesToChains: Record<ChainName, Chain> = {
  arctestnet,
  megaeth,
  basesepolia,
  solanadevnet,
};

/** Reverse lookup: on-chain `bytes32` cbChainId → the `Chain` it identifies. */
export const cbChainIdToChain: Record<string, Chain> = Object.fromEntries(
  Object.values(chainNamesToChains).map((chain) => [chain.cbChainId, chain])
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
