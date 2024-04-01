import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';

export const tokens = [
  {
    name: 'USDC',
    address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    decimals: 6,
  },
  {
    name: 'SOL',
    address: 'So11111111111111111111111111111111111111112',
    decimals: 9,
  },
];

export interface TokenAndAmountOnChain {
  token: PublicKey;
  amount: BN;
}

export interface TokenAndAmountOffChain {
  name: string;
  address: string;
  amount: number;
  decimals: number;
}

export const convertTokensForOnChain = (
  taasOffC: TokenAndAmountOffChain[],
): TokenAndAmountOnChain[] => {
  return taasOffC.map((taa) => ({
    amount: new BN(taa.amount * 10 ** taa.decimals),
    token: new PublicKey(taa.address),
  }));
};
