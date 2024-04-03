import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';

export const tokens = [
  {
    name: 'USDC',
    address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    decimals: 6
  },
  {
    name: 'wSOL',
    address: 'So11111111111111111111111111111111111111112',
    decimals: 9
  }
];

export interface TokenAndAmountOnChain {
  token: PublicKey;
  amount: BN;
}

export interface TokenAndAmountOffChain {
  name: string;
  amount: number;
}

export const convertTokens = (
  taasOnC: TokenAndAmountOnChain[]
): TokenAndAmountOffChain[] => {
  return taasOnC.map((taa) => {
    const address = taa.token.toBase58();
    const filtered = tokens.filter((t) => t.address == address);
    if (filtered.length == 0) {
      console.warn(`Couldn't find token details for ${address}`);
    }
    const name = filtered.length == 0 ? address : filtered[0].name;
    const amount =
      filtered.length == 0
        ? taa.amount.toNumber()
        : parseFloat(
            (taa.amount.toNumber() / 10 ** filtered[0].decimals).toFixed(18)
            // 18 is max decimals
          );
    return { name, amount };
  });
};
