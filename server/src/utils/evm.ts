import {
  ContractFunctionName,
  createPublicClient,
  http,
  verifyMessage
} from 'viem';
import { sepolia } from 'viem/chains';
import { abi } from './abi';

export const CONTRACT_ADDRESS = '0x080b7B61c9F7C28614c1BB1F3FeE9Cd36caFBce0';

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
