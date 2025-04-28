import {
  ContractFunctionArgs,
  ContractFunctionName,
  createPublicClient,
  http,
  verifyMessage
} from 'viem';
import { megaethTestnet } from 'viem/chains';
import { contracts } from '../schemas';
import { abi } from './abi';

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
  // @ts-ignore
  createPublicClient({
    chain: megaethTestnet,
    transport: http()
  }).readContract({
    address: contracts.megaethtestnet as `0x${string}`,
    abi,
    functionName,
    args
  });

export const evmFetch = async (
  entity: 'Payable' | 'PayablePayment' | 'UserPayment' | 'Withdrawal',
  id: string
) => {
  return await evmReadContract(`get${entity}` as AbiFunctionName, [
    id as `0x${string}`
  ]);
};
