import { type TokenAndAmount } from '@/schemas';
import { type Chain } from '@/stores';

export interface Payment {
  id: string;
  chain: Chain;
  payer: string;
  payerCount: number;
  payableId: string;
  payableCount: number;
  timestamp: number;
  details: TokenAndAmount;
}
