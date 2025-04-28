import { Timestamp } from 'firebase-admin/firestore';
import { Chain, ChainName, ChainNetworkType } from '../utils';
import { getTokenDetails } from './tokens-and-amounts';

export class Withdrawal {
  id: string;
  chainName: ChainName;
  chainCount: number;
  chainNetworkType: ChainNetworkType;
  payableId: string;
  payableCount: number;
  host: string;
  hostCount: number;
  timestamp: Timestamp;
  token: string;
  amount: number;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chainName = chain.name;
    this.chainNetworkType = chain.networkType;
    this.chainCount = Number(onChainData.chainCount);

    if (chain.isEvm) this.host = onChainData.host.toLowerCase();
    else if (chain.isSolana) this.host = onChainData.host.toBase58();
    else this.host = onChainData.host;

    this.hostCount = Number(onChainData.hostCount);

    if (chain.isEvm) this.payableId = onChainData.payableId.toLowerCase();
    else if (chain.isSolana) this.payableId = onChainData.payableId.toBase58();
    else this.payableId = onChainData.payableId;

    this.payableCount = Number(onChainData.payableCount);
    const { name: token, details } = getTokenDetails(onChainData.token, chain);
    this.token = token;
    this.amount =
      Number(onChainData.amount) / 10 ** (details[chain.name]?.decimals ?? 0);
    this.timestamp = Timestamp.fromMillis(Number(onChainData.timestamp) * 1000);
  }
}
