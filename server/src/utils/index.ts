export * from './abi';
export * from './chain';
export * from './evm';
export * from './firebase';
export * from './notify-host';
export * from './solana';

import { Chain } from './chain';
import * as encoding from './encoding';

export const denormalizeBytes = (bytes: Uint8Array, chain: Chain): string => {
  bytes = Uint8Array.from(bytes);
  if (chain.isSolana) return encoding.b58.encode(bytes);
  if (chain.isEvm) {
    return '0x' + encoding.hex.encode(bytes, false).replace(/^0+/, '');
  } else throw `Unknown chain: ${chain}`;
};
