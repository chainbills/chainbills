import { type TokenAndAmount } from '@/schemas';
import { type Chain } from '@/stores';

export interface Receipt {
  id: string;
  chain: Chain;
  payableId: string;
  timestamp: number;
  details: TokenAndAmount;

  displayDetails(): string;
  user(): string; // payer or host
}
