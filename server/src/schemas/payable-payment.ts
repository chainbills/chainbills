import { Timestamp } from 'firebase-admin/firestore';
import { Chain, ChainName, ChainNetworkType, cbChainIdToChain, denormalizeBytes } from '../utils';
import { getTokenDetails } from './tokens';

export class PayablePayment {
  id: string;
  chainName: ChainName;
  chainNetworkType: ChainNetworkType;
  payableId: string;
  payableCount: number;
  localChainCount: number;
  payer: string;
  payerChainName: ChainName;
  timestamp: Timestamp;
  token: string;
  amount: number;

  constructor(id: string, chain: Chain, onChainData: any) {
    this.id = id;
    this.chainName = chain.name;
    this.chainNetworkType = chain.networkType;

    if (chain.isEvm) this.payableId = onChainData.payableId.toLowerCase();
    else if (chain.isSolana) this.payableId = onChainData.payableId.toBase58();
    else this.payableId = onChainData.payableId;

    const payerChain: Chain = cbChainIdToChain[onChainData.payerChainId];
    if (!payerChain) throw new Error(`Unknown cbChainId: ${onChainData.payerChainId}`);
    this.payerChainName = payerChain.name;

    if (chain.isEvm && chain.name == payerChain.name) {
      // This because of the "toWormholeFormat" conversion in EVM contract
      this.payer = '0x' + onChainData.payer.split('0x')[1].replace(/^0+/, '');
    } else {
      // Use payerChain for denormalization when cross-chain
      this.payer = denormalizeBytes(onChainData.payer, payerChain);
    }

    this.payableCount = Number(onChainData.payableCount);
    this.localChainCount = Number(onChainData.localChainCount);
    const { name: token, details } = getTokenDetails(onChainData.token, chain);
    this.token = token;
    this.amount = Number(onChainData.amount) / 10 ** (details[chain.name]?.decimals ?? 0);
    this.timestamp = Timestamp.fromMillis(Number(onChainData.timestamp) * 1000);
  }
}
