import { PublicKey } from '@solana/web3.js';
import { Chain, ChainName } from '../utils';

export const contracts: Record<ChainName, string> = {
  arctestnet: '0x0bA837eF7358981967FB2cFcB79bf649b7cACbf4',
  megaeth: '0xc38d1681d34DA821E46508C084D673477E455570',
  sepolia: '0x48353Ab7662Bc8218811Fbbdf247cCc8602fba8A',
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
    },
  },
  {
    name: 'ETH',
    details: {
      megaeth: {
        address: contracts.megaeth,
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
