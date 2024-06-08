import { verifyMessage } from 'viem';

export const evmVerify = async (
  message: string,
  signature: string,
  address: string
) => await verifyMessage({ address, message, signature });
