import { Timestamp } from 'firebase-admin/firestore';
import { Chain, ChainName, ChainNetworkType, cbChainIdToChain } from '../utils';
import { getTokenDetails } from './tokens';

export class UserPayment {
  id: string;
  chainName: ChainName;
  chainCount: number;
  chainNetworkType: ChainNetworkType;
  payer: string;
  payerCount: number;
  payableId: string;
  payableChainName: ChainName;
  timestamp: Timestamp;
  token: string;
  amount: number;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chainName = chain.name;
    this.chainNetworkType = chain.networkType;
    this.chainCount = Number(onChainData.chainCount);

    if (chain.isEvm) this.payer = onChainData.payer.toLowerCase();
    else if (chain.isSolana) this.payer = onChainData.payer.toBase58();
    else this.payer = onChainData.payer;

    const payableChain = cbChainIdToChain[onChainData.payableChainId];
    if (!payableChain) throw new Error(`Unknown cbChainId: ${onChainData.payableChainId}`);
    this.payableChainName = payableChain.name;

    if (chain.isEvm) this.payableId = onChainData.payableId.toLowerCase();
    else if (chain.isSolana) this.payableId = onChainData.payableId.toBase58();
    else this.payableId = onChainData.payableId;

    this.payerCount = Number(onChainData.payerCount);
    const { name: token, details } = getTokenDetails(onChainData.token, chain);
    this.token = token;
    this.amount = Number(onChainData.amount) / 10 ** (details[chain.name]?.decimals ?? 0);
    this.timestamp = Timestamp.fromMillis(Number(onChainData.timestamp) * 1000);
  }
}
