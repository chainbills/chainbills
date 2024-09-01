import { ChainId } from '@wormhole-foundation/sdk';
import { NextFunction, Request, Response } from 'express';
import { WH_CHAIN_ID_ETH_SEPOLIA, WH_CHAIN_ID_SOLANA } from '../utils';

const isChainId = (chainId: any): chainId is ChainId =>
  (<ChainId[]>[WH_CHAIN_ID_SOLANA, WH_CHAIN_ID_ETH_SEPOLIA]).includes(chainId);

export const validateChain = async (
  { headers }: Request,
  res: Response,
  next: NextFunction
) => {
  const { chainId } = headers;
  let message = '';
  if (!chainId) message = 'Provide Valid chainId';
  console.log({chainId})
  if (!isChainId(chainId)) message = `Unsupported chainId: ${chainId}`;
  if (message) {
    console.error('Error at validating chain ...')
    console.log(message);
    res.status(400).json({ success: false, message });
  } else {
    res.locals.chainId;
    next();
  }
};
