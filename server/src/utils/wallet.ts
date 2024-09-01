import { encoding } from '@wormhole-foundation/sdk-base';
import { Chain } from './chain';

export const denormalizeBytes = (bytes: Uint8Array, chain: Chain) => {
  if (chain == 'Solana') return encoding.b58.encode(Uint8Array.from(bytes));
  if (chain == 'Ethereum Sepolia') {
    return (
      '0x' +
      encoding.hex.encode(Uint8Array.from(bytes), false).replace(/^0+/, '')
    );
  }
  throw `Unknown Chain: ${chain}`;
};
