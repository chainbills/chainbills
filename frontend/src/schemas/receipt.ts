import { type Chain, type Token } from '@/schemas';

export interface Receipt {
  id: string;
  chain: Chain;
  payableId: string;
  timestamp: number;
  token: Token;
  amount: number;

  displayDetails(): string;
  user(): string; // payer or host
  userChain(): Chain;
}
