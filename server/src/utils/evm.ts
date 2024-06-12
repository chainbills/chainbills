import { verifyMessage } from 'viem';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { abi } from './abi';

export const CONTRACT_ADDRESS = '0x89F1051407799805eac5aE9A40240dbCaaB55b98';

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
