import { ChainId, Network } from '@wormhole-foundation/sdk';
import { Timestamp } from 'firebase-admin/firestore';
import { Chain, getChainId } from '../utils';
import { TokenAndAmount, TokenAndAmountDB } from './tokens-and-amounts';

export class Withdrawal {
  id: string;
  chain: Chain;
  chainId: ChainId | 50;
  chainCount: number;
  network: Network;
  payableId: string;
  payableCount: number;
  host: string;
  hostCount: number;
  timestamp: Timestamp;
  details: TokenAndAmountDB;

  constructor(id: string, chain: Chain, network: Network, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainId = getChainId(chain);
    this.network = network;
    this.chainCount = Number(onChainData.chainCount);

    if (chain == 'Ethereum Sepolia' || chain == 'Burnt Xion') {
      this.host = onChainData.host.toLowerCase();
    } else if (chain == 'Solana') this.host = onChainData.host.toBase58();
    else throw `Unknown chain: ${chain}`;

    this.hostCount = Number(onChainData.hostCount);

    if (chain == 'Ethereum Sepolia' || chain == 'Burnt Xion') {
      this.payableId = onChainData.payableId.toLowerCase();
    } else if (chain == 'Solana') {
      this.payableId = onChainData.payableId.toBase58();
    } else throw `Unknown chain: ${chain}`;

    this.payableCount = Number(onChainData.payableCount);
    const taa = TokenAndAmount.fromOnChain(onChainData.details, chain);
    this.details = { token: taa.name, amount: taa.format(chain) };
    this.timestamp = Timestamp.fromMillis(Number(onChainData.timestamp) * 1000);
  }
}
