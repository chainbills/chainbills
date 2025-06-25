export type ChainName = 'basecamptestnet' | 'megaethtestnet' | 'solanadevnet';
export const chainNames: ChainName[] = [
  'basecamptestnet',
  'megaethtestnet',
  'solanadevnet'
];

export type ChainNetworkType = 'mainnet' | 'testnet';
export const chainNetworkTypes: ChainNetworkType[] = ['mainnet', 'testnet'];

export interface Chain {
  name: ChainName;
  displayName: string;
  isEvm: boolean;
  isSolana: boolean;
  networkType: ChainNetworkType;
}

export const basecamptestnet: Chain = {
  name: 'basecamptestnet',
  displayName: 'Camp Testnet',
  isEvm: true,
  isSolana: false,
  networkType: 'testnet'
};

export const megaethtestnet: Chain = {
  name: 'megaethtestnet',
  displayName: 'MegaETH Testnet',
  isEvm: true,
  isSolana: false,
  networkType: 'testnet'
};

export const solanadevnet: Chain = {
  name: 'solanadevnet',
  displayName: 'Solana Devnet',
  isEvm: false,
  isSolana: true,
  networkType: 'testnet'
};

export const chainNamesToChains: Record<ChainName, Chain> = {
  basecamptestnet,
  megaethtestnet,
  solanadevnet
};
