import { ChainId, Network } from '@wormhole-foundation/sdk';
import { Timestamp } from 'firebase-admin/firestore';
import { Chain, denormalizeBytes, getChain, getChainId } from '../utils';
import { TokenAndAmount } from './tokens-and-amounts';

export class PayablePayment {
  id: string;
  chain: Chain;
  chainId: ChainId;
  chainCount: number;
  network: Network;
  payableId: string;
  payableCount: number;
  localChainCount: number;
  payer: string;
  payerChain: Chain;
  payerCount: number;
  timestamp: Timestamp;
  details: TokenAndAmount;

  constructor(id: string, chain: Chain, network: Network, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainId = getChainId(chain);
    this.chainCount = Number(onChainData.chainCount);
    this.network = network;

    if (chain == 'Ethereum Sepolia') this.payableId = onChainData.payableId;
    else if (chain == 'Solana') {
      this.payableId = onChainData.payableId.toBase58();
    } else throw `Unknown chain: ${chain}`;

    this.payableCount = Number(onChainData.payableCount);
    this.localChainCount = Number(onChainData.localChainCount);
    this.payerChain = getChain(onChainData.payerChainId);
    this.payer = denormalizeBytes(onChainData.payer, this.payerChain);
    this.payerCount = Number(onChainData.payerCount);
    this.details = TokenAndAmount.fromOnChain(onChainData.details, chain);
    this.timestamp = Timestamp.fromMillis(Number(onChainData.timestamp) * 1000);
  }
}
