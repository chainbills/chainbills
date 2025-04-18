import { NextFunction, Request, Response } from 'express';
import { evmVerify, solanaVerify } from '../utils';

export const AUTH_MESSAGE = 'Authentication';

export const validateAuth = async (
  { headers }: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chain } = res.locals;
    let { 'wallet-address': walletAddress, signature } = headers;

    if (!walletAddress || typeof walletAddress != 'string') {
      throw 'Provide wallet-address in headers';
    }

    if (!signature || typeof signature != 'string') {
      throw 'Provide signature in headers';
    }

    let verify: Function = () => {
      throw 'Invalid Chain in Verifying Auth';
    };
    if (chain.isSolana) verify = solanaVerify;
    if (chain.isEvm) verify = evmVerify;

    const isVerified = await verify(AUTH_MESSAGE, signature, walletAddress);
    if (!isVerified) throw 'Unauthorized. Signature and Address Not Matching.';

    if (chain.isEvm) walletAddress = walletAddress.toLowerCase();
    res.locals.walletAddress = walletAddress;
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
