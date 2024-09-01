import {
  ContractFunctionName,
  createPublicClient,
  http,
  verifyMessage
} from 'viem';
import { sepolia } from 'viem/chains';
import { abi } from './abi';

export const CONTRACT_ADDRESS = '0xA825FFC41e91992d159F465cAA06bF973CdEdAF6';

export const evmVerify = async (
  message: string,
  signature: any,
  address: any
) => await verifyMessage({ address, message, signature });

export const evmReadContract = async (
  functionName: ContractFunctionName<typeof abi, 'pure' | 'view'>,
  args: any[] = []
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
