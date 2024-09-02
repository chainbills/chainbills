import type { Chain } from '@/stores/chain';
import { PublicKey } from '@solana/web3.js';

export const CONTRACT_ADDRESS = '0x5c9c9e008e73689b37575e36c4ad654f16799bef';

export interface TokenChainDetails {
  address: string;
  decimals: number;
}

export interface Token {
  name: string;
  details: { [key in Chain]: TokenChainDetails };
}

export interface TokenAndAmountOnChain {
  token: string;
  amount: bigint;
}

export class TokenAndAmount {
  name: string;
  details: { [key in Chain]: TokenChainDetails };
  amount: number;

  constructor(token: Token, amount: number) {
    this.name = token.name;
    this.details = token.details;
    this.amount = amount;
  }

  static fromOnChain(
    { token, amount }: TokenAndAmountOnChain,
    chain: Chain
  ): TokenAndAmount {
    let found: Token | undefined;
    if (chain == 'Ethereum Sepolia') {
      found = tokens.find(
        (t) => `${t.details['Ethereum Sepolia'].address}` == token.toLowerCase()
      );
    } else if (chain == 'Solana') {
      if ((token as any) instanceof PublicKey) {
        token = (token as unknown as PublicKey).toBase58();
      }
      found = tokens.find((t) => t.details.Solana.address == token);
    } else throw `Unknown Chain: ${chain}`;

    if (!found) throw `Couldn't find token details for ${token}`;
    return new TokenAndAmount(found, Number(amount));
  }

  display(chain: Chain) {
    return this.format(chain) + ' ' + this.name;
  }

  format(chain: Chain) {
    return this.amount / 10 ** this.details[chain].decimals;
  }

  token(): Token {
    return {
      name: this.name,
      details: this.details,
    };
  }

  toOnChain(chain: Chain): TokenAndAmountOnChain {
    // if (chain == 'Ethereum Sepolia') {
    //   return [this.details[chain].address, BigInt(this.amount)];
    // } else {
    return {
      token: this.details[chain].address,
      amount: BigInt(this.amount),
    };
    // }
  }
}

export const tokens: Token[] = [
  {
    name: 'USDC',
    details: {
      Solana: {
        address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        decimals: 6,
      },
      'Ethereum Sepolia': {
        address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
        decimals: 6,
      },
    },
  },
  {
    name: 'ETH',
    details: {
      Solana: {
        address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        decimals: 6,
      },
      'Ethereum Sepolia': {
        address: CONTRACT_ADDRESS,
        decimals: 18,
      },
    },
  },
];
