import { verifyMessage } from 'viem';

export const verify = async (
  message: string,
  signature: string,
  address: string
) => await verifyMessage({ address, message, signature });
