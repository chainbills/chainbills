import { Network } from '@wormhole-foundation/sdk';
import { NextFunction, Request, Response } from 'express';

const isWhNetwork = (network: string): network is Network =>
  ['Devnet', 'Testnet', 'Mainnet'].includes(network);

export const validateNetwork = async (
  { body }: Request,
  res: Response,
  next: NextFunction
) => {
  let { whNetwork } = body;
  if (!whNetwork || !isWhNetwork(whNetwork)) whNetwork = 'Testnet';
  res.locals.whNetwork = whNetwork;
  next();
};
