import { defineChain } from 'viem';

export type ChainName = 'basecampmainnet' | 'basecamptestnet' | 'megaethtestnet' | 'solanadevnet';
export const chainNamesEvm: ChainName[] = ['basecampmainnet', 'basecamptestnet', 'megaethtestnet'];
export const chainNames: ChainName[] = [...chainNamesEvm, 'solanadevnet'];

export const basecampMainnet = defineChain({
  id: 484,
  name: 'Basecamp Mainnet',
  nativeCurrency: { name: 'CAMP', symbol: 'CAMP', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.camp.raas.gelato.cloud/'] },
  },
  blockExplorers: {
    default: { name: 'Basecamp Explorer', url: 'https://camp.cloud.blockscout.com/' },
  },
});

export interface Chain {
  name: ChainName;
  displayName: string;
  isEvm: boolean;
  isSolana: boolean;
}

export const getTxUrl = (txHash: string, chain: Chain) => {
  if (chain.name === 'basecampmainnet') return `https://camp.cloud.blockscout.com/tx/${txHash}`;
  if (chain.name === 'basecamptestnet') return `https://basecamp.cloud.blockscout.com/tx/${txHash}`;
  if (chain.name === 'megaethtestnet') return `https://megaexplorer.xyz/tx/${txHash}`;
  if (chain.name === 'solanadevnet') return `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
  throw 'Unhandled Chain in GetTxUrl';
};

export const getWalletUrl = (wallet: string, chain: Chain) => {
  if (chain.name === 'basecampmainnet') return `https://camp.cloud.blockscout.com/address/${wallet}`;
  if (chain.name === 'basecamptestnet') return `https://basecamp.cloud.blockscout.com/address/${wallet}`;
  if (chain.name === 'megaethtestnet') return `https://megaexplorer.xyz/address/${wallet}`;
  if (chain.name === 'solanadevnet') return `https://explorer.solana.com/address/${wallet}?cluster=devnet`;
  throw 'Unhandled Chain in GetWalletUrl';
};

export const basecampmainnet: Chain = {
  name: 'basecampmainnet',
  displayName: 'Camp Mainnet',
  isEvm: true,
  isSolana: false,
};

export const basecamptestnet: Chain = {
  name: 'basecamptestnet',
  displayName: 'Camp Testnet',
  isEvm: true,
  isSolana: false,
};

export const megaethtestnet: Chain = {
  name: 'megaethtestnet',
  displayName: 'MegaETH Testnet',
  isEvm: true,
  isSolana: false,
};

export const solanadevnet: Chain = {
  name: 'solanadevnet',
  displayName: 'Solana Devnet',
  isEvm: false,
  isSolana: true,
};

export const chainNamesToChains: Record<ChainName, Chain> = {
  basecampmainnet,
  basecamptestnet,
  megaethtestnet,
  solanadevnet,
};

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
