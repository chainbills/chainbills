import { Timestamp } from 'firebase-admin/firestore';
import { Chain, ChainName, ChainNetworkType } from '../utils';

export class Payable {
  id: string;
  chainName: ChainName;
  chainCount: number;
  chainNetworkType: ChainNetworkType;
  host: string;
  hostCount: number;
  createdAt: Timestamp;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chainName = chain.name;
    this.chainNetworkType = chain.networkType;
    this.chainCount = Number(onChainData.chainCount);

    if (chain.isEvm) this.host = onChainData.host.toLowerCase();
    else if (chain.isSolana) this.host = onChainData.host.toBase58();
    else this.host = onChainData.host;

    this.hostCount = Number(onChainData.hostCount);
    this.createdAt = Timestamp.fromMillis(Number(onChainData.createdAt) * 1000);
  }
}
