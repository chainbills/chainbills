import { type Chain } from '@/stores';

export class User {
  chain!: Chain;
  chainCount!: number;
  explorerUrl!: string;
  payablesCount!: number;
  paymentsCount!: number;
  walletAddress!: string;
  withdrawalsCount!: number;

  static fromEvm(
    walletAddress: string,
    explorerUrl: string,
    onChainData: any
  ): User {
    return {
      chain: 'Ethereum Sepolia',
      chainCount: Number(onChainData[0]),
      explorerUrl,
      payablesCount: Number(onChainData[1]),
      paymentsCount: Number(onChainData[2]),
      walletAddress,
      withdrawalsCount: Number(onChainData[3]),
    };
  }

  static fromSolana(
    walletAddress: string,
    explorerUrl: string,
    onChainData: any
  ): User {
    return {
      chain: 'Solana',
      chainCount: Number(onChainData.chainCount),
      explorerUrl,
      payablesCount: Number(onChainData.payablesCount),
      paymentsCount: Number(onChainData.paymentsCount),
      walletAddress,
      withdrawalsCount: Number(onChainData.withdrawalsCount),
    };
  }

  static newUser(
    chain: Chain,
    walletAddress: string,
    explorerUrl: string
  ): User {
    return {
      chain,
      chainCount: 0,
      explorerUrl,
      payablesCount: 0,
      paymentsCount: 0,
      walletAddress,
      withdrawalsCount: 0,
    };
  }
}
