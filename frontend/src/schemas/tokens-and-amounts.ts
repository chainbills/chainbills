import type { Chain } from '@/stores/chain';
import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';

export const SEPOLIA_CONTRACT_ADDRESS =
  '0x77eb76be1b283145ebc49d7d40e904b70c3b06ab';
export const PROGRAM_ID = '25DUdGkxQgDF7uN58viq6Mjegu3Ajbq2tnQH3zmgX2ND';
export const XION_CONTRACT_ADDRESS =
  'xion1cena9wnyd2wudh5g7zrx2wwtr46wl2g3ahaargzt3gypufqd8s5sp6xpu3';
export const XION_USDC_ADDRESS =
  'ibc/57097251ED81A232CE3C9D899E7C8096D6D87EF84BA203E12E424AA4C9B57A64';

export interface TokenChainDetails {
  address: string;
  decimals: number;
}

export interface Token {
  name: string;
  details: { [key in Chain]?: TokenChainDetails };
}

export interface TokenAndAmountOnChain {
  token: string | PublicKey;
  amount: bigint | BN | number | string;
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
        (t) =>
          t.details['Ethereum Sepolia']?.address == `${token}`.toLowerCase()
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

  display(chain: Chain) {
    return this.format(chain) + ' ' + this.name;
  }

  format(chain: Chain) {
    return this.amount / 10 ** (this.details[chain]?.decimals ?? 0);
  }

  token(): Token {
    return {
      name: this.name,
      details: this.details,
    };
  }

  toOnChain(chain: Chain): TokenAndAmountOnChain {
    let token: any = this.details[chain]?.address ?? '';
    if (!!token && chain == 'Solana') token = new PublicKey(token);
    let amount: any = this.amount;
    if (chain == 'Solana') amount = new BN(amount);
    if (chain == 'Ethereum Sepolia') amount = BigInt(this.amount);
    if (chain == 'Burnt Xion') amount = `${this.amount}`;
    return { token, amount };
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
      'Burnt Xion': {
        address: XION_USDC_ADDRESS,
        decimals: 6,
      },
    },
  },
  {
    name: 'ETH',
    details: {
      'Ethereum Sepolia': {
        address: SEPOLIA_CONTRACT_ADDRESS,
        decimals: 18,
      },
    },
  },
  {
    name: 'SOL',
    details: {
      Solana: {
        address: PROGRAM_ID,
        decimals: 9,
      },
    },
  },
  {
    name: 'XION',
    details: {
      'Burnt Xion': {
        address: 'uxion',
        decimals: 6,
      },
    },
  },
];
