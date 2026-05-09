import {
  ContractFunctionArgs,
  ContractFunctionName,
  createPublicClient,
  http,
  verifyMessage
} from 'viem';
import { megaeth as megaethViem, Chain as ViemChain } from 'viem/chains';
import { contracts } from '../schemas';
import { abi } from './abi';
import { ChainName } from './chain';

export const evmVerify = async (message: string, signature: any, address: any) =>
  await verifyMessage({ address, message, signature });

export type AbiFunctionName = ContractFunctionName<typeof abi, 'pure' | 'view'>;

export const evmReadContract = async (
  functionName: AbiFunctionName,
  args: ContractFunctionArgs<typeof abi, 'pure' | 'view', AbiFunctionName> = [],
  chainName: ChainName
) => {
  let chain: ViemChain;
  if (chainName == 'megaeth') chain = megaethViem;
  else throw new Error(`Unsupported chain: ${chainName}`);

  // @ts-ignore
  return await createPublicClient({ chain, transport: http() }).readContract({
    address: contracts[chainName] as `0x${string}`,
    abi,
    functionName,
    args
  });
};

export const evmFetch = async (
  entity: 'Payable' | 'PayablePayment' | 'UserPayment' | 'Withdrawal',
  id: string,
  chainName: ChainName
) => {
  return await evmReadContract(`get${entity}` as AbiFunctionName, [id as `0x${string}`], chainName);
};
