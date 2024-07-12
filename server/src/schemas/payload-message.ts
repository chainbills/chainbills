import { UniversalAddress } from '@wormhole-foundation/sdk';
import BN from 'bn.js';
import { TokenAndAmountOnChain } from './tokens-and-amounts';

export class PayloadMessage {
  actionId: number;
  caller: Uint8Array;
  payableId: Uint8Array;
  token: Uint8Array;
  amount: BN;
  allowsFreePayments: boolean;
  tokensAndAmounts: TokenAndAmountOnChain[];
  description: string;

  constructor(input: any) {
    this.actionId = input.actionId;
    this.caller = new UniversalAddress(input.caller, 'hex').address;
    this.payableId = new UniversalAddress(input.payableId, 'hex').address;
    this.token = new UniversalAddress(input.token, 'hex').address;
    this.amount = input.amount;
    this.allowsFreePayments = input.allowsFreePayments;
    this.tokensAndAmounts = input.tokensAndAmounts;
    this.description = input.description;
  }
}
