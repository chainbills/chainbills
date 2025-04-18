export type ChainName = 'megaethtestnet' | 'solanadevnet';
export const chainNames: ChainName[] = ['megaethtestnet', 'solanadevnet'];

export interface Chain {
  name: ChainName;
  displayName: string;
  isEvm: boolean;
  isSolana: boolean;
}

export const getTxUrl = (txHash: string, chain: Chain) => {
  if (chain.isEvm) return `https://megaexplorer.xyz/tx/${txHash}`;
  else if (chain.isSolana)
    return `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
  else throw 'Unhandled Chain Type';
};

export const getWalletUrl = (wallet: string, chain: Chain) => {
  if (chain.isEvm) return `https://megaexplorer.xyz/address/${wallet}`;
  else if (chain.isSolana)
    return `https://explorer.solana.com/address/${wallet}?cluster=devnet`;
  else throw 'Unhandled Chain Type';
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
