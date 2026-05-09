export type ChainName = 'arctestnet' | 'megaeth' | 'solanadevnet';
export const chainNamesEvm: ChainName[] = ['megaeth', 'arctestnet'];
export const chainNames: ChainName[] = [...chainNamesEvm, 'solanadevnet'];

export interface Chain {
  name: ChainName;
  displayName: string;
  isEvm: boolean;
  isSolana: boolean;
}

export const getTxUrl = (txHash: string, chain: Chain) => {
  if (chain.name === 'megaeth') return `https://megaeth.blockscout.com/tx/${txHash}`;
  if (chain.name === 'arctestnet') return `https://testnet.arcscan.app/tx/${txHash}`;
  if (chain.name === 'solanadevnet') return `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
  throw 'Unhandled Chain in GetTxUrl';
};

export const getWalletUrl = (wallet: string, chain: Chain) => {
  if (chain.name === 'megaeth') return `https://megaexplorer.xyz/address/${wallet}`;
  if (chain.name === 'arctestnet') return `https://testnet.arcscan.app/address/${wallet}`;
  if (chain.name === 'solanadevnet') return `https://explorer.solana.com/address/${wallet}?cluster=devnet`;
  throw 'Unhandled Chain in GetWalletUrl';
};

export const megaeth: Chain = {
  name: 'megaeth',
  displayName: 'MegaETH',
  isEvm: true,
  isSolana: false,
};

export const arctestnet: Chain = {
  name: 'arctestnet',
  displayName: 'Arc Testnet',
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
  arctestnet,
  megaeth,
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
