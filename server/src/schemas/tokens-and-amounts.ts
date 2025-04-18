import { PublicKey } from '@solana/web3.js';
import { Chain, ChainName } from '../utils';

export const contracts: Record<ChainName, string> = {
  megaethtestnet: '0x92e67bfe49466b18ccdf2a3a28b234ab68374c60',
  solanadevnet: '25DUdGkxQgDF7uN58viq6Mjegu3Ajbq2tnQH3zmgX2ND'
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

export const tokens: Token[] = [
  {
    name: 'USDC',
    details: {
      solanadevnet: {
        address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        decimals: 6
      }
    }
  },
  {
    name: 'ETH',
    details: {
      megaethtestnet: {
        address: contracts.megaethtestnet,
        decimals: 18
      }
    }
  },
  {
    name: 'SOL',
    details: {
      solanadevnet: {
        address: contracts.solanadevnet,
        decimals: 9
      }
    }
  }
];
