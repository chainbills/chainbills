import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { type Chain, type ChainName } from './chain';

export const getTokenLogo = (chain: Chain, token: Token) => {
  let logo = token.name;
  if (chain.name == 'megaeth' && token.name == 'ETH') logo = 'MegaETH';
  return `/assets/tokens/${logo}.png`;
};

export const contracts: Record<ChainName, string> = {
  arctestnet: '0x0bA837eF7358981967FB2cFcB79bf649b7cACbf4',
  megaeth: '0xc38d1681d34DA821E46508C084D673477E455570',
  sepolia: '0x48353Ab7662Bc8218811Fbbdf247cCc8602fba8A',
  solanadevnet: 'DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk',
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
    found = tokens.find((t) => t.details[chain.name]?.address == `${token}`);
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
      arctestnet: {
        address: '0x3600000000000000000000000000000000000000',
        decimals: 6,
      },
      sepolia: {
        address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        decimals: 6,
      },
      solanadevnet: {
        address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        decimals: 6,
      },
    },
  },
  {
    name: 'ETH',
    details: {
      megaeth: {
        address: contracts.megaeth,
        decimals: 18,
      },
      sepolia: {
        address: contracts.sepolia,
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
