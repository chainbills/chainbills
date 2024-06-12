import { ChainId } from '@wormhole-foundation/sdk';
import { NextFunction, Request, Response } from 'express';

import { Auth } from '../schemas';
import {
  evmVerify,
  solanaVerify,
  WH_CHAIN_ID_ETH_SEPOLIA,
  WH_CHAIN_ID_SOLANA
} from '../utils';

const isChainId = (chainId: any): chainId is ChainId =>
  (<ChainId[]>[WH_CHAIN_ID_SOLANA, WH_CHAIN_ID_ETH_SEPOLIA]).includes(chainId);

export const AUTH_MESSAGE = 'Authentication';

export const validateAuth = async (
  { body }: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chainId, walletAddress, signature } = body;

    if (!chainId || !isChainId(chainId)) throw 'Provide Valid chainId';
    if (!walletAddress) throw 'Provide walletAddress';
    if (!signature) throw 'Provide signature';

    const verify = chainId == WH_CHAIN_ID_SOLANA ? solanaVerify : evmVerify;
    const isVerified = await verify(AUTH_MESSAGE, signature, walletAddress);
    if (!isVerified) throw 'Unauthorized. Signature and Address Not Matching.';

    res.locals.auth = new Auth(chainId, walletAddress);
    next();
  } catch (e: any) {
    console.log(body);
    console.error('Error at validating auth ... ');
    console.error(e);
    res.status(400).json({
      success: false,
      message: e['shortMessage'] ?? e['message'] ?? `${e}`
    });
  }
};
