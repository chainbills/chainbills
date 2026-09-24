// schemas/user.ts
//
// `User` mirrors CbGetters' `getUser(address)` struct: the per-chain,
// per-wallet counters the contract keeps (how many payables/payments/
// withdrawals/activities this wallet has on this chain). `auth.ts` holds
// the signed-in wallet's `User` in `currentUser`; `activity.ts` resolves a
// `User` for every `InitializedUser` activity record.
//
// Used by: `stores/auth.ts`, `stores/evm.ts` (`getCurrentUser`),
// `stores/activity.ts` (resolving `InitializedUser` entities).
import { getWalletUrl, type Chain } from './chain';

export class User {
  chain!: Chain;
  /** How many distinct chains this wallet has interacted with Chainbills on. */
  chainCount!: number;
  payablesCount!: number;
  paymentsCount!: number;
  walletAddress!: string;
  withdrawalsCount!: number;
  /** Total activity records recorded for this wallet on this chain (all activity types combined). */
  activitiesCount!: number;

  constructor(chain: Chain, walletAddress: string, onChainData: any) {
    this.chain = chain;
    this.walletAddress = walletAddress;
    this.chainCount = Number(onChainData?.chainCount ?? 0);
    this.payablesCount = Number(onChainData?.payablesCount ?? 0);
    this.paymentsCount = Number(onChainData?.paymentsCount ?? 0);
    this.withdrawalsCount = Number(onChainData?.withdrawalsCount ?? 0);
    this.activitiesCount = Number(onChainData?.activitiesCount ?? 0);
  }

  /** The block-explorer URL for this wallet, on its chain. */
  get explorerUrl() {
    return getWalletUrl(this.walletAddress, this.chain);
  }
}
