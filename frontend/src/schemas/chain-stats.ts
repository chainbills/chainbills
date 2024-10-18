import type { Chain } from '@/stores';

export class ChainStats {
  chain: Chain;
  usersCount: number;
  payablesCount: number;
  paymentsCount: number;
  withdrawalsCount: number;

  constructor(chain: Chain, input: any) {
    this.chain = chain;
    this.usersCount = Number(input['usersCount']);
    this.payablesCount = Number(input['payablesCount']);
    this.paymentsCount = Number(input['paymentsCount']);
    this.withdrawalsCount = Number(input['withdrawalsCount']);
  }

  static empty(chain: Chain): ChainStats {
    return new ChainStats(chain, {
      usersCount: 0,
      payablesCount: 0,
      paymentsCount: 0,
      withdrawalsCount: 0,
    });
  }
}
