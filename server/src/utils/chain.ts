export type ChainName = 'megaeth' | 'sepolia' | 'solanadevnet' | 'arctestnet';
export const chainNames: ChainName[] = ['megaeth', 'arctestnet', 'sepolia', 'solanadevnet'];

export type ChainNetworkType = 'mainnet' | 'testnet';
export const chainNetworkTypes: ChainNetworkType[] = ['mainnet', 'testnet'];

export interface Chain {
  name: ChainName;
  displayName: string;
  isEvm: boolean;
  isSolana: boolean;
  networkType: ChainNetworkType;
  cbChainId: string;
}

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
