import { Timestamp } from 'firebase-admin/firestore';
import { Chain, ChainName, ChainNetworkType } from '../utils';
import { getTokenDetails } from './tokens-and-amounts';

export class UserPayment {
  id: string;
  chainName: ChainName;
  chainCount: number;
  chainNetworkType: ChainNetworkType;
  payer: string;
  payerCount: number;
  payableId: string;
  payableChain: Chain;
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

    if (onChainData.payableChainId == 0) this.payableChain = chain;
    else throw `Unhandled payableChain: ${onChainData.payableChainId}`;

    if (chain.isEvm) this.payableId = onChainData.payableId.toLowerCase();
    else if (chain.isSolana) this.payableId = onChainData.payableId.toBase58();
    else this.payableId = onChainData.payableId;

    this.payerCount = Number(onChainData.payerCount);
    const { name: token, details } = getTokenDetails(onChainData.token, chain);
    this.token = token;
    this.amount =
      Number(onChainData.amount) / 10 ** (details[chain.name]?.decimals ?? 0);
    this.timestamp = Timestamp.fromMillis(Number(onChainData.timestamp) * 1000);
  }
}
