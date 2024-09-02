import { ChainId } from '@wormhole-foundation/sdk';
import { NextFunction, Request, Response } from 'express';
import { WH_CHAIN_ID_ETH_SEPOLIA, WH_CHAIN_ID_SOLANA } from '../utils';

const isChainId = (chainId: any): chainId is ChainId =>
  +chainId === WH_CHAIN_ID_ETH_SEPOLIA || +chainId === WH_CHAIN_ID_SOLANA;

export const validateChain = async (
  { headers }: Request,
  res: Response,
  next: NextFunction
) => {
  const { 'chain-id': chainId } = headers;
  let message = '';
  if (!chainId) message = 'Provide Valid chain-id in headers.';
  if (!isChainId(chainId)) message = `Unsupported chain-id: ${chainId}`;
  if (message) {
    console.error('Error at validating chain ...');
    console.error(message);
    res.status(400).json({ success: false, message });
  } else {
    res.locals.chainId = +chainId!;
    res.locals.chain =
      +chainId! === WH_CHAIN_ID_ETH_SEPOLIA ? 'Ethereum Sepolia' : 'Solana';
    next();
  }
};
