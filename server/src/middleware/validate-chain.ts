import { NextFunction, Request, Response } from 'express';
import { ChainName, chainNames, chainNamesToChains } from '../utils';

const isChainName = (chainName: any): chainName is ChainName =>
  chainNames.includes(chainName);

export const validateChain = async (
  { headers }: Request,
  res: Response,
  next: NextFunction
) => {
  const { ['chain-name']: chainName } = headers;
  let message = '';
  if (!chainName) message = 'Provide Valid chain-name in headers.';
  if (!isChainName(chainName)) message = `Unsupported chain-name: ${chainName}`;
  if (message) {
    console.error('Error at validating chain-name ...');
    console.error(message);
    res.status(400).json({ success: false, message });
  } else {
    res.locals.chain = chainNamesToChains[chainName as ChainName];
    next();
  }
};
