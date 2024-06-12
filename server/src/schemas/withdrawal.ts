import { Network } from '@wormhole-foundation/sdk';

import { Chain } from '../utils/chain';
import { TokenAndAmount, TokenAndAmountOffChain } from './tokens-and-amounts';

export class Withdrawal {
  id: string;
  globalCount: number;
  chain: Chain;
  chainCount: number;
  network: Network;
  payable: string;
  payableCount: number;
  host: string;
  hostCount: number;
  hostWallet: string;
  timestamp: number;
  details: TokenAndAmountOffChain;

  constructor(
    id: string,
    chain: Chain,
    network: Network,
    hostWallet: string,
    onChainData: any
  ) {
    this.id = id;
    this.globalCount = onChainData.globalCount.toNumber();
    this.chain = chain;
    this.chainCount = onChainData.chainCount.toNumber();
    this.network = network;
    this.host = onChainData.host.toBase58();
    this.hostCount = onChainData.hostCount.toNumber();
    this.hostWallet = hostWallet;
    this.payable = onChainData.payable.toBase58();
    this.payableCount = onChainData.payableCount.toNumber();
    this.details = TokenAndAmount.fromOnChain(onChainData.details, chain);
    this.timestamp = onChainData.timestamp.toNumber();
  }
}
