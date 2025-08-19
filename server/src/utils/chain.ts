import { defineChain } from "viem";

export type ChainName = 'basecamptestnet' | 'basecampmainnet' | 'megaethtestnet' | 'solanadevnet';
export const chainNames: ChainName[] = [
  'basecampmainnet',
  'basecamptestnet',
  'megaethtestnet',
  'solanadevnet'
];

export const basecampMainnet = defineChain({
  id: 484,
  name: 'Basecamp Mainnet',
  nativeCurrency: { name: 'CAMP', symbol: 'CAMP', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.camp.raas.gelato.cloud/'] }
  },
  blockExplorers: {
    default: { name: 'Basecamp Explorer', url: 'https://camp.cloud.blockscout.com/' }
  }
});

export type ChainNetworkType = 'mainnet' | 'testnet';
export const chainNetworkTypes: ChainNetworkType[] = ['mainnet', 'testnet'];

export interface Chain {
  name: ChainName;
  displayName: string;
  isEvm: boolean;
  isSolana: boolean;
  networkType: ChainNetworkType;
}

export const basecampmainnet: Chain = {
  name: 'basecampmainnet',
  displayName: 'Camp Mainnet',
  isEvm: true,
  isSolana: false,
  networkType: 'mainnet'
};

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
  basecampmainnet,
  basecamptestnet,
  megaethtestnet,
  solanadevnet
};
