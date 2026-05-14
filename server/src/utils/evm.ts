import { ContractFunctionArgs, ContractFunctionName, createPublicClient, http, verifyMessage } from 'viem';
import { arcTestnet, megaeth, Chain as ViemChain } from 'viem/chains';
import { gettersAbi } from './abis';
import { ChainName } from './chain';

const getters: Record<ChainName, string> = {
  arctestnet: '0x92e67bfe49466b18ccdf2a3a28b234ab68374c60',
  megaeth: '0x92e67bfe49466b18ccdf2a3a28b234ab68374c60',
  sepolia: '0xC4d4fcB77230FE1eB1ad3d257673FC9Dca707feD',
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
