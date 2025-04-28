import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { type Chain, type ChainName } from './chain';

export const getTokenLogo = (chain: Chain, token: Token) => {
  let logo = token.name;
  if (chain.name == 'megaethtestnet' && token.name == 'ETH') logo = 'MegaETH';
  return `/assets/tokens/${logo}.png`;
};

export const contracts: Record<ChainName, string> = {
  megaethtestnet: '0x92e67bfe49466b18ccdf2a3a28b234ab68374c60',
  solanadevnet: '25DUdGkxQgDF7uN58viq6Mjegu3Ajbq2tnQH3zmgX2ND',
};

export interface TokenChainDetails {
  address: string;
  decimals: number;
}

export interface Token {
  name: string;
  details: { [key in ChainName]?: TokenChainDetails };
}

export const getTokenDetails = (token: string | PublicKey, chain: Chain) => {
  let found: Token | undefined;

  if (chain.isEvm) {
    found = tokens.find(
      // TODO: Also check other EVM chains when added
      (t) => t.details.megaethtestnet?.address == `${token}`.toLowerCase()
    );
  } else if (chain.isSolana) {
    if ((token as any) instanceof PublicKey) {
      token = (token as unknown as PublicKey).toBase58();
    }
    found = tokens.find((t) => t.details.solanadevnet?.address == token);
  } else throw `Unknown Chain: ${chain}`;

  if (!found) throw `Couldn't find token details for ${token}`;
  return found;
};

export interface TokenAndAmountOnChain {
  token: string | PublicKey;
  amount: bigint | BN | number | string;
}

export class TokenAndAmount {
  name: string;
  details: { [key in ChainName]?: TokenChainDetails };
  amount: number;

  constructor(token: Token, amount: number) {
    this.name = token.name;
    this.details = token.details;
    this.amount = amount;
  }

  static fromOnChain({ token, amount }: TokenAndAmountOnChain, chain: Chain) {
    return new TokenAndAmount(getTokenDetails(token, chain), Number(amount));
  }

  display(chain: Chain) {
    return this.format(chain) + ' ' + this.name;
  }

  format(chain: Chain) {
    return this.amount / 10 ** (this.details[chain.name]?.decimals ?? 0);
  }

  token(): Token {
    return {
      name: this.name,
      details: this.details,
    };
  }

  toOnChain(chain: Chain): TokenAndAmountOnChain {
    let token: any = this.details[chain.name]?.address ?? '';
    if (!!token && chain.isSolana) token = new PublicKey(token);
    let amount: any = this.amount;
    if (chain.isSolana) amount = new BN(this.amount);
    if (chain.isEvm) amount = BigInt(this.amount);
    return { token, amount };
  }
}

export const tokens: Token[] = [
  {
    name: 'USDC',
    details: {
      solanadevnet: {
        address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        decimals: 6,
      },
    },
  },
  {
    name: 'ETH',
    details: {
      megaethtestnet: {
        address: contracts.megaethtestnet,
        decimals: 18,
      },
    },
  },
  {
    name: 'SOL',
    details: {
      solanadevnet: {
        address: contracts.solanadevnet,
        decimals: 9,
      },
    },
  },
];
