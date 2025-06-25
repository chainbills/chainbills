export type ChainName = 'basecamptestnet' | 'megaethtestnet' | 'solanadevnet';
export const chainNames: ChainName[] = ['basecamptestnet', 'megaethtestnet', 'solanadevnet'];

export interface Chain {
  name: ChainName;
  displayName: string;
  isEvm: boolean;
  isSolana: boolean;
}

export const getTxUrl = (txHash: string, chain: Chain) => {
  if (chain.name === 'basecamptestnet') return `https://basecamp.cloud.blockscout.com/tx/${txHash}`;
  if (chain.name === 'megaethtestnet') return `https://megaexplorer.xyz/tx/${txHash}`;
  if (chain.name === 'solanadevnet') return `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
  throw 'Unhandled Chain in GetTxUrl';
};

export const getWalletUrl = (wallet: string, chain: Chain) => {
  if (chain.name === 'basecamptestnet') return `https://basecamp.cloud.blockscout.com/address/${wallet}`;
  if (chain.name === 'megaethtestnet') return `https://megaexplorer.xyz/address/${wallet}`;
  if (chain.name === 'solanadevnet') return `https://explorer.solana.com/address/${wallet}?cluster=devnet`;
  throw 'Unhandled Chain in GetWalletUrl';
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
