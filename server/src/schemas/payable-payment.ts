import { ChainId, Network, UniversalAddress } from '@wormhole-foundation/sdk';
import { Timestamp } from 'firebase-admin/firestore';
import { Chain, denormalizeBytes, getChain, getChainId } from '../utils';
import { TokenAndAmount, TokenAndAmountDB } from './tokens-and-amounts';

export class PayablePayment {
  id: string;
  chain: Chain;
  chainId: ChainId;
  network: Network;
  payableId: string;
  payableCount: number;
  localChainCount: number;
  payer: string;
  payerChain: Chain;
  timestamp: Timestamp;
  details: TokenAndAmountDB;

  constructor(id: string, chain: Chain, network: Network, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainId = getChainId(chain);
    this.network = network;
    this.payerChain = getChain(onChainData.payerChainId);

    if (chain == 'Ethereum Sepolia') {
      this.payableId = onChainData.payableId.toLowerCase();

      if (this.payerChain == 'Ethereum Sepolia') {
        this.payer = new UniversalAddress(onChainData.payer, 'hex')
          .toNative('Sepolia')
          .address.toLowerCase();
      } else if (this.payerChain == 'Solana') {
        this.payer = denormalizeBytes(onChainData.payer, this.payerChain);
      } else throw `Unknown payerChain: ${this.payerChain}`;
    } else if (chain == 'Solana') {
      this.payableId = onChainData.payableId.toBase58();
      this.payer = denormalizeBytes(onChainData.payer, this.payerChain);
    } else throw `Unknown chain: ${chain}`;

    this.payableCount = Number(onChainData.payableCount);
    this.localChainCount = Number(onChainData.localChainCount);
    const taa = TokenAndAmount.fromOnChain(onChainData.details, chain);
    this.details = { token: taa.name, amount: taa.format(chain) };
    this.timestamp = Timestamp.fromMillis(Number(onChainData.timestamp) * 1000);
  }
}
