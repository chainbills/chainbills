import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';

export const tokens = [
  {
    name: 'USDC',
    address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    decimals: 6,
  },
  {
    name: 'wSOL',
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

export const convertTokensToOffChain = (
  taasOnC: TokenAndAmountOnChain[],
): TokenAndAmountOffChain[] => {
  return taasOnC.map((taa) => {
    const address = new PublicKey(taa.token).toBase58();
    const found = tokens.find((t) => t.address == address);
    if (!found) console.warn(`Couldn't find token details for ${address}`);
    const name = found ? found.name : address;
    const amount = found
      ? parseFloat(
          (taa.amount.toNumber() / 10 ** found.decimals).toFixed(18),
          // 18 is max decimals
        )
      : taa.amount.toNumber();
    const decimals = found ? found.decimals : 1;
    return { address, amount, decimals, name };
  });
};
