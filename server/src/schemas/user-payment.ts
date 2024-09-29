import { ChainId, encoding, Network } from '@wormhole-foundation/sdk';
import { Timestamp } from 'firebase-admin/firestore';
import { Chain, denormalizeBytes, getChain, getChainId } from '../utils';
import { TokenAndAmount, TokenAndAmountDB } from './tokens-and-amounts';

export class UserPayment {
  id: string;
  chain: Chain;
  chainId: ChainId | 50;
  chainCount: number;
  network: Network;
  payer: string;
  payerCount: number;
  payableId: string;
  payableChain: Chain;
  payableCount: number;
  timestamp: Timestamp;
  details: TokenAndAmountDB;

  constructor(id: string, chain: Chain, network: Network, onChainData: any) {
    this.id = id;
    this.chain = chain;
    this.chainId = getChainId(chain);
    this.network = network;
    this.chainCount = Number(onChainData.chainCount);
    this.payableChain = getChain(onChainData.payableChainId);

    if (chain == 'Ethereum Sepolia' || chain == 'Burnt Xion') {
      this.payer = onChainData.payer.toLowerCase();

      if (this.payableChain == 'Ethereum Sepolia') {
        this.payableId = onChainData.payableId.toLowerCase();
      } else if (this.payableChain == 'Burnt Xion') {
        this.payableId = encoding.hex.encode(
          Uint8Array.from(onChainData.payableId),
          false
        );
      } else if (this.payableChain == 'Solana') {
        this.payableId = denormalizeBytes(onChainData.payableId, 'Solana');
      } else throw `Unknown payableChain: ${this.payableChain}`;
    } else if (chain == 'Solana') {
      this.payer = onChainData.payer.toBase58();
      // TODO: Review this denormalization if destination chain is Burnt Xion
      this.payableId = denormalizeBytes(
        onChainData.payableId,
        this.payableChain
      );
    } else throw `Unknown chain: ${chain}`;

    this.payerCount = Number(onChainData.payerCount);
    this.payableCount = Number(onChainData.payableCount);
    const taa = TokenAndAmount.fromOnChain(onChainData.details, chain);
    this.details = { token: taa.name, amount: taa.format(chain) };
    this.timestamp = Timestamp.fromMillis(Number(onChainData.timestamp) * 1000);
  }
}
