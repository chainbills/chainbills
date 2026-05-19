import { ContractFunctionArgs, ContractFunctionName, createPublicClient, http, verifyMessage } from 'viem';
import { arcTestnet, megaeth, sepolia, Chain as ViemChain } from 'viem/chains';
import { gettersAbi } from './abis';
import { ChainName } from './chain';

const getters: Record<ChainName, string> = {
  arctestnet: '0x01656b5968C4b98F05F596344DA7066118d6738a',
  megaeth: '0x9885b3807f14Fe3DB010fB8BD98C60716f6468a8',
  sepolia: '0x325D77a09F267A7aF695aB5E68F7ddF0eC530a38',
  solanadevnet: '25DUdGkxQgDF7uN58viq6Mjegu3Ajbq2tnQH3zmgX2ND',
};

export const evmVerify = async (message: string, signature: any, address: any) =>
  await verifyMessage({ address, message, signature });

export type AbiFunctionName = ContractFunctionName<typeof gettersAbi, 'pure' | 'view'>;

export const evmReadContract = async (
  functionName: AbiFunctionName,
  args: ContractFunctionArgs<typeof gettersAbi, 'pure' | 'view', AbiFunctionName> = [],
  chainName: ChainName
) => {
  let chain: ViemChain;
  if (chainName == 'megaeth') chain = megaeth;
  else if (chainName == 'sepolia') chain = sepolia;
  else if (chainName == 'arctestnet') chain = arcTestnet;
  else throw new Error(`Unsupported chain: ${chainName}`);

  // @ts-ignore
  return await createPublicClient({ chain, transport: http() }).readContract({
    address: getters[chainName] as `0x${string}`,
    abi: gettersAbi,
    functionName,
    args,
  });
};

export const evmFetch = async (
  entity: 'Payable' | 'PayablePayment' | 'UserPayment' | 'Withdrawal',
  id: string,
  chainName: ChainName
) => {
  return await evmReadContract(`get${entity}` as AbiFunctionName, [id as `0x${string}`], chainName);
};
