import type { Chain } from '@/stores/chain';
import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';

export interface TokenChainDetails {
  address: string;
  decimals: number;
}

export interface Token {
  name: string;
  details: { [key in Chain]: TokenChainDetails };
}

export interface TokenAndAmountOnChain {
  token: Uint8Array;
  amount: BN;
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

  // TODO: Add a reconcile method for decimals of Ethereum
  // When there will be tokens with difference in decimals in both chains

  static fromOnChain({ token, amount }: TokenAndAmountOnChain): TokenAndAmount {
    const address = new PublicKey(token).toBase58();
    const found = tokens.find((t) => t.details.Solana.address == address);
    if (!found) throw `Couldn't find token details for ${address}`;
    return new TokenAndAmount(found, amount.toNumber());
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

  toOnChain(): TokenAndAmountOnChain {
    return {
      token: new PublicKey(this.details.Solana.address).toBytes(),
      amount: new BN(this.amount),
    };
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
      Ethereum: {
        address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        decimals: 6,
      },
    },
  },
];
