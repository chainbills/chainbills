import { type Receipt } from '@/schemas';

export interface Payment extends Receipt {
  payer: string;
}
