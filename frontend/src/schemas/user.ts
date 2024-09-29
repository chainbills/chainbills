import { type Chain } from '@/stores/chain';

export class User {
  walletAddress!: string;
  chain!: Chain;
  chainCount!: number;
  payablesCount!: number;
  paymentsCount!: number;
  withdrawalsCount!: number;

  static fromCosmwasm(walletAddress: string, onChainData: any): User {
    return {
      walletAddress,
      chain: 'Burnt Xion',
      chainCount: onChainData.chain_count,
      payablesCount: onChainData.payables_count,
      paymentsCount: onChainData.payments_count,
      withdrawalsCount: onChainData.withdrawals_count,
    };
  }

  static fromEvm(walletAddress: string, onChainData: any): User {
    return {
      walletAddress,
      chain: 'Ethereum Sepolia',
      chainCount: Number(onChainData[0]),
      payablesCount: Number(onChainData[1]),
      paymentsCount: Number(onChainData[2]),
      withdrawalsCount: Number(onChainData[3]),
    };
  }

  static fromSolana(onChainData: any): User {
    return {
      walletAddress: onChainData.walletAddress,
      chain: 'Solana',
      chainCount: Number(onChainData.chainCount),
      payablesCount: Number(onChainData.payablesCount),
      paymentsCount: Number(onChainData.paymentsCount),
      withdrawalsCount: Number(onChainData.withdrawalsCount),
    };
  }

  static newUser(chain: Chain, walletAddress: string): User {
    return {
      walletAddress,
      chain,
      chainCount: 0,
      payablesCount: 0,
      paymentsCount: 0,
      withdrawalsCount: 0,
    };
  }
}
