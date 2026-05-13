export type ChainName = 'arctestnet' | 'megaeth' | 'sepolia' | 'solanadevnet';
export const chainNamesEvm: ChainName[] = ['megaeth', 'arctestnet', 'sepolia'];
export const chainNames: ChainName[] = [...chainNamesEvm, 'solanadevnet'];

export type ChainNetworkType = 'mainnet' | 'testnet';

export interface Chain {
  name: ChainName;
  displayName: string;
  isEvm: boolean;
  isSolana: boolean;
  networkType: ChainNetworkType;
  cbChainId: string;
}

export const getTxUrl = (txHash: string, chain: Chain) => {
  if (chain.name === 'megaeth') return `https://megaeth.blockscout.com/tx/${txHash}`;
  if (chain.name === 'arctestnet') return `https://testnet.arcscan.app/tx/${txHash}`;
  if (chain.name === 'sepolia') return `https://sepolia.etherscan.io/tx/${txHash}`;
  if (chain.name === 'solanadevnet') return `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
  throw 'Unhandled Chain in GetTxUrl';
};

export const getWalletUrl = (wallet: string, chain: Chain) => {
  if (chain.name === 'megaeth') return `https://megaexplorer.xyz/address/${wallet}`;
  if (chain.name === 'arctestnet') return `https://testnet.arcscan.app/address/${wallet}`;
  if (chain.name === 'sepolia') return `https://sepolia.etherscan.io/address/${wallet}`;
  if (chain.name === 'solanadevnet') return `https://explorer.solana.com/address/${wallet}?cluster=devnet`;
  throw 'Unhandled Chain in GetWalletUrl';
};

export const megaeth: Chain = {
  name: 'megaeth',
  displayName: 'MegaETH',
  isEvm: true,
  isSolana: false,
  networkType: 'mainnet',
  cbChainId: '0x78b4988135f242a792c3ba307a59ea12c5ec8c24390a1f41381eeb7c7c444d3a',
};

export const arctestnet: Chain = {
  name: 'arctestnet',
  displayName: 'Arc Testnet',
  isEvm: true,
  isSolana: false,
  networkType: 'testnet',
  cbChainId: '0xfcfa255b5b1c8e2b9672ea5d7a51e54c78ecbf0f0e87607e8b86ec2cfd25d4fd',
};

export const sepolia: Chain = {
  name: 'sepolia',
  displayName: 'Sepolia',
  isEvm: true,
  isSolana: false,
  networkType: 'testnet',
  cbChainId: '0xafa90c317deacd3d68f330a30f96e4fa7736e35e8d1426b2e1b2c04bce1c2fb7',
};

export const solanadevnet: Chain = {
  name: 'solanadevnet',
  displayName: 'Solana Devnet',
  isEvm: false,
  isSolana: true,
  networkType: 'testnet',
  // TODO: Replace with real cbChainId from contract config
  cbChainId: '0x0000000000000000000000000000000000000000000000000000000000000004',
};

export const chainNamesToChains: Record<ChainName, Chain> = {
  arctestnet,
  megaeth,
  sepolia,
  solanadevnet,
};

export const cbChainIdToChain: Record<string, Chain> = Object.fromEntries(
  Object.values(chainNamesToChains).map((chain) => [chain.cbChainId, chain])
);

export class OnChainSuccess {
  created: string;
  txHash: string;
  chain: Chain;

  constructor(input: any) {
    this.created = input['created'];
    this.txHash = input['txHash'];
    this.chain = input['chain'];
  }

  get explorerUrl() {
    return getTxUrl(this.txHash, this.chain);
  }
}
