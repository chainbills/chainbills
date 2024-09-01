import { ChainId, Network } from '@wormhole-foundation/sdk';
import { Timestamp } from 'firebase-admin/firestore';
import { Chain, getChainId } from '../utils';

export class Payable {
  id: string;
  chain: Chain;
  chainId: ChainId;
  chainCount: number;
  network: Network;
  host: string;
  hostCount: number;
  createdAt: Timestamp;
  paymentsCount: number;
  withdrawalsCount: number;

  constructor(id: string, chain: Chain, network: Network, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainId = getChainId(chain);
    this.network = network;
    this.chainCount = Number(onChainData.chainCount);

    if (chain == 'Ethereum Sepolia') this.host = onChainData.host;
    else if (chain == 'Solana') this.host = onChainData.host.toBase58();
    else throw `Unknown chain: ${chain}`;

    this.hostCount = Number(onChainData.hostCount);
    this.createdAt = Timestamp.fromMillis(Number(onChainData.createdAt) * 1000);
    this.paymentsCount = Number(onChainData.paymentsCount);
    this.withdrawalsCount = Number(onChainData.withdrawalsCount);
  }
}
