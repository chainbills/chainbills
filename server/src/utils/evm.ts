import { verifyMessage } from 'viem';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { abi } from './abi';

export const CONTRACT_ADDRESS = '0xb52CB1AD5D67C5CD25180f8cdB48D22243291884';

export const evmVerify = async (
  message: string,
  signature: any,
  address: any
) => await verifyMessage({ address, message, signature });

export const readContract = async (functionName: string, args: any[] = []) =>
  await createPublicClient({
    chain: sepolia,
    transport: http()
  }).readContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName,
    args
  });
