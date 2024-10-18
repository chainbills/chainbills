import { PublicKey } from '@solana/web3.js';
import { Chain, PROGRAM_ID, SEPOLIA_CONTRACT_ADDRESS } from '../utils';

export interface TokenChainDetails {
  address: string;
  decimals: number;
}

export interface Token {
  name: string;
  details: { [key in Chain]?: TokenChainDetails };
}

export interface TokenAndAmountDB {
  token: string;
  amount: number;
}

export interface TokenAndAmountOnChain {
  token: string;
  amount: bigint;
}

export class TokenAndAmount {
  name: string;
  details: { [key in Chain]?: TokenChainDetails };
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
        (t) => t.details['Ethereum Sepolia']?.address == token.toLowerCase()
      );
    } else if (chain == 'Solana') {
      if ((token as any) instanceof PublicKey) {
        token = (token as unknown as PublicKey).toBase58();
      }
      found = tokens.find((t) => t.details.Solana?.address == token);
    } else if (chain == 'Burnt Xion') {
      found = tokens.find((t) => t.details['Burnt Xion']?.address == token);
    } else throw `Unknown Chain: ${chain}`;

    if (!found) throw `Couldn't find token details for ${token}`;
    return new TokenAndAmount(found, Number(amount));
  }

  format(chain: Chain) {
    return this.amount / 10 ** (this.details[chain]?.decimals ?? 0);
  }
}

export const tokens: Token[] = [
  {
    name: 'USDC',
    details: {
      Solana: {
        address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        decimals: 6
      },
      'Ethereum Sepolia': {
        address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
        decimals: 6
      },
      'Burnt Xion': {
        address:
          'ibc/57097251ED81A232CE3C9D899E7C8096D6D87EF84BA203E12E424AA4C9B57A64',
        decimals: 6
      }
    }
  },
  {
    name: 'ETH',
    details: {
      'Ethereum Sepolia': {
        address: SEPOLIA_CONTRACT_ADDRESS,
        decimals: 18
      }
    }
  },
  {
    name: 'SOL',
    details: {
      Solana: {
        address: PROGRAM_ID,
        decimals: 9
      }
    }
  },
  {
    name: 'XION',
    details: {
      'Burnt Xion': {
        address: 'uxion',
        decimals: 6
      }
    }
  }
];
