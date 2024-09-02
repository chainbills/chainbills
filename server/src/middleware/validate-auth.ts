import { NextFunction, Request, Response } from 'express';
import {
  evmVerify,
  solanaVerify,
  WH_CHAIN_ID_ETH_SEPOLIA,
  WH_CHAIN_ID_SOLANA
} from '../utils';

export const AUTH_MESSAGE = 'Authentication';

export const validateAuth = async (
  { headers }: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chainId } = res.locals;
    const { 'wallet-address': walletAddress, signature } = headers;

    if (!walletAddress || typeof walletAddress != 'string') {
      throw 'Provide wallet-address in headers';
    } else if (!signature || typeof signature != 'string') {
      throw 'Provide signature in headers';
    }

    const verify = chainId == WH_CHAIN_ID_SOLANA ? solanaVerify : evmVerify;
    const isVerified = await verify(AUTH_MESSAGE, signature, walletAddress);
    if (!isVerified) throw 'Unauthorized. Signature and Address Not Matching.';

    res.locals.walletAddress =
      chainId == WH_CHAIN_ID_ETH_SEPOLIA
        ? walletAddress.toLowerCase()
        : walletAddress;
    next();
  } catch (e: any) {
    console.error('Error at validating auth ... ');
    console.error(e);
    res.status(400).json({
      success: false,
      message: e['shortMessage'] ?? e['message'] ?? `${e}`
    });
  }
};
