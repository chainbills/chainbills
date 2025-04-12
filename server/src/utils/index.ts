export * from './abi';
export * from './chain';
export * from './evm';
export * from './firebase';
export * from './notify-host';
export * from './solana';

import { encoding } from '@wormhole-foundation/sdk-base';
import { Chain } from './chain';

export const denormalizeBytes = (bytes: Uint8Array, chain: Chain) => {
  bytes = Uint8Array.from(bytes);
  if (chain == 'Solana') return encoding.b58.encode(bytes);
  else if (chain == 'Ethereum Sepolia') {
    return (
      '0x' + encoding.hex.encode(bytes, false).replace(/^0+/, '')
    ).toLowerCase();
  } else throw `Unknown Chain: ${chain}`;
};
