import { PublicKey } from '@solana/web3.js';
import { Chain, ChainName } from '../utils';

export const contracts: Record<ChainName, string> = {
  arctestnet: '0x535a2C8A5fa922B7a905B5a784A80401535B4eC1',
  megaeth: '0x92e67bfe49466b18ccdf2a3a28b234ab68374c60',
  sepolia: '0x676FfD548E993E64018Ee23Ba039BBDB15f84699',
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
