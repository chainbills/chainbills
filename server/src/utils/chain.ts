export type ChainName = 'megaeth' | 'solanadevnet';
export const chainNames: ChainName[] = ['megaeth', 'solanadevnet'];

export type ChainNetworkType = 'mainnet' | 'testnet';
export const chainNetworkTypes: ChainNetworkType[] = ['mainnet', 'testnet'];

export interface Chain {
  name: ChainName;
  displayName: string;
  isEvm: boolean;
  isSolana: boolean;
  networkType: ChainNetworkType;
}

export const megaeth: Chain = {
  name: 'megaeth',
  displayName: 'MegaETH',
  isEvm: true,
  isSolana: false,
  networkType: 'mainnet'
};

export const solanadevnet: Chain = {
  name: 'solanadevnet',
  displayName: 'Solana Devnet',
  isEvm: false,
  isSolana: true,
  networkType: 'testnet'
};

export const chainNamesToChains: Record<ChainName, Chain> = {
  megaeth,
  solanadevnet
};
