import { ChainId, Network } from '@wormhole-foundation/sdk';
import { Timestamp } from 'firebase-admin/firestore';
import { Chain, denormalizeBytes, getChain, getChainId } from '../utils';
import { TokenAndAmount } from './tokens-and-amounts';

export class UserPayment {
  id: string;
  chain: Chain;
  chainId: ChainId;
  chainCount: number;
  network: Network;
  payer: string;
  payerCount: number;
  payableId: string;
  payableChain: Chain;
  payableCount: number;
  timestamp: Timestamp;
  details: TokenAndAmount;

  constructor(id: string, chain: Chain, network: Network, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainId = getChainId(chain);
    this.network = network;
    this.chainCount = Number(onChainData.chainCount);

    if (chain == 'Ethereum Sepolia') this.payer = onChainData.payer;
    else if (chain == 'Solana') this.payer = onChainData.payer.toBase58();
    else throw `Unknown chain: ${chain}`;

    this.payerCount = Number(onChainData.payerCount);
    this.payableChain = getChain(onChainData.payableChainId);
    this.payableId = denormalizeBytes(onChainData.payable, this.payableChain);
    this.payableCount = Number(onChainData.payableCount);
    this.details = TokenAndAmount.fromOnChain(onChainData.details, chain);
    this.timestamp = Timestamp.fromMillis(Number(onChainData.timestamp) * 1000);
  }
}
