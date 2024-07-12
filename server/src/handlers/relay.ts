import {
  Network,
  UniversalAddress,
  signSendWait,
  wormhole
} from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import solana from '@wormhole-foundation/sdk/solana';
import { PayloadMessage } from '../schemas/payload-message';
import { readContract, relayInitializePayable } from '../utils';
import { solanaWallet } from '../utils/signers';

export const relay = async (body: any, network: Network) => {
  const { txHash, functionName } = body;
  if (!txHash) throw 'Missing required txHash';
  if (!functionName) throw 'Missing required functionName';
  if (!['initializePayable', 'pay', 'withdraw'].includes(functionName)) {
    throw 'Invalid functionName';
  }

  const wh = await wormhole(network, [evm, solana]);
  const vaa = await wh.getVaa(txHash, 'Uint8Array');
  if (!vaa) throw 'Failed to get VAA or Invalid txHash';

  let payload: PayloadMessage;
  try {
    const raw = await readContract('decodePayloadMessage', [
      '0x' + Buffer.from(vaa.payload).toString('hex')
    ]);
    payload = new PayloadMessage(raw);
  } catch (e) {
    console.error(e);
    throw `Failed to decode payload message: ${e}`;
  }

  // TODO: Ensure this verify VAA block of Solana is working
  const solanaChainCtx = wh.getChain('Solana');
  const solanaWhCore = await solanaChainCtx.getWormholeCore();
  const relayer = new UniversalAddress(
    solanaWallet.publicKey.toBase58(),
    'base58'
  );
  const verifyTxs = solanaWhCore.verifyMessage(relayer, vaa);
  const solanaRpc = await solanaChainCtx.getRpc();
  const solanaKey = process.env.SOLANA_KEY!;
  const signer = await (await solana()).getSigner(solanaRpc, solanaKey);
  await signSendWait(solanaChainCtx, verifyTxs, signer);
  console.log('Verified VAA');
  console.log(verifyTxs);

  if (functionName === 'initializePayable') {
    return await relayInitializePayable(network, payload, vaa);
  } else {
    throw 'Not implemented';
  }
};
