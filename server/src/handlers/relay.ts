import { wormhole } from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import solana from '@wormhole-foundation/sdk/solana';
import { readContract } from '../utils';

export const relay = async (body: any) => {
  const { txHash, functionName } = body;
  if (!txHash) throw 'Missing required txHash';
  if (!functionName) throw 'Missing required functionName';
  if (!['initializePayable', 'pay', 'withdraw'].includes(functionName)) {
    throw 'Invalid functionName';
  }

  const wh = await wormhole('Testnet', [evm, solana]);
  const vaa = await wh.getVaa(txHash, 'Uint8Array');
  if (!vaa) throw 'Failed to get VAA or Invalid txHash';

  return await readContract('decodePayloadMessage', [
    Buffer.from(vaa.payload).toString('hex')
  ]);
};
