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
  if (!whNetwork || !isWhNetwork(whNetwork)) {
    console.error('Error at validating network environment ... ');
    console.error('Provide Valid wh-network in headers');
    res.status(400).json({
      success: false,
      message: 'Provide Valid wh-network in headers'
    });
  } else {
    res.locals.whNetwork = whNetwork;
    next();
  }
};
