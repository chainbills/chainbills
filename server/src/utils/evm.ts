import {
  ContractFunctionArgs,
  ContractFunctionName,
  createPublicClient,
  http,
  verifyMessage
} from 'viem';
import { sepolia } from 'viem/chains';
import { abi } from './abi';

export const CONTRACT_ADDRESS = '0x5c9c9e008e73689b37575e36c4ad654f16799bef';

export const evmVerify = async (
  message: string,
  signature: any,
  address: any
) => await verifyMessage({ address, message, signature });

export type AbiFunctionName = ContractFunctionName<typeof abi, 'pure' | 'view'>;

export const evmReadContract = async (
  functionName: AbiFunctionName,
  args: ContractFunctionArgs<typeof abi, 'pure' | 'view', AbiFunctionName> = []
) =>
  await createPublicClient({
    chain: sepolia,
    transport: http()
  }).readContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName,
    args
  });

export const evmFetchPayable = async (id: string) => {
  const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
  const raw = (await evmReadContract('payables', [xId])) as any;
  const [host, chainCount, hostCount, createdAt] = raw;
  return { host, chainCount, hostCount, createdAt };
};

export const evmFetchUserPayment = async (id: string) => {
  const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
  const raw = (await evmReadContract('userPayments', [xId])) as any;
  const details: any = await evmReadContract('getUserPaymentDetails', [xId]);
  const [payableId, payer, payableChainId, chainCount, payerCount] = raw;
  const [payableCount, timestamp] = raw.splice(5);
  return {
    ...{ payableId, payer, payableChainId, chainCount, payerCount },
    ...{ payableCount, timestamp, details }
  };
};

export const evmFetchPayablePayment = async (id: string) => {
  const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
  const raw = (await evmReadContract('payablePayments', [xId])) as any;
  const details: any = await evmReadContract('getPayablePaymentDetails', [xId]);
  const [payableId, payer, payerChainId, localChainCount, payableCount] = raw;
  const [payerCount, timestamp] = raw.splice(5);
  return {
    ...{ payableId, payer, payerChainId, localChainCount, payableCount },
    ...{ payerCount, timestamp, details }
  };
};

export const evmFetchWithdrawal = async (id: string) => {
  const xId = (!id.startsWith('0x') ? `0x${id}` : id) as `0x${string}`;
  const raw = (await evmReadContract('withdrawals', [xId])) as any;
  const details: any = await evmReadContract('getWithdrawalDetails', [xId]);
  if (!raw || !details) return null;
  const [payableId, host, chainCount, hostCount, payableCount, timestamp] = raw;
  return {
    ...{ payableId, host, chainCount, hostCount, payableCount, timestamp },
    details
  };
};