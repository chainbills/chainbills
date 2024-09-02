import { Network } from '@wormhole-foundation/sdk';
import { NextFunction, Request, Response } from 'express';

const isWhNetwork = (network: any): network is Network =>
  ['Devnet', 'Testnet', 'Mainnet'].includes(network);

export const validateNetwork = async (
  { headers }: Request,
  res: Response,
  next: NextFunction
) => {
  let { 'wh-network': whNetwork } = headers;
  if (!whNetwork || !isWhNetwork(whNetwork)) throw 'Provide Valid wh-network' //whNetwork = 'Testnet';
  res.locals.whNetwork = whNetwork;
  next();
};
