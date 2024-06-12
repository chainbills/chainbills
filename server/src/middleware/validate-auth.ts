import { Cluster } from '@solana/web3.js';
import { ChainId } from '@wormhole-foundation/sdk';
import { NextFunction, Request, Response } from 'express';

import { Auth } from '../schemas/auth';
import { evmVerify, solanaVerify } from '../utils';
import { WH_CHAIN_ID_ETH_SEPOLIA, WH_CHAIN_ID_SOLANA } from '../utils/chain';

const isChainId = (chainId: number): chainId is ChainId =>
  chainId == WH_CHAIN_ID_SOLANA || chainId == WH_CHAIN_ID_ETH_SEPOLIA;

const isSolanaCluster = (cluster: string): cluster is Cluster =>
  cluster == 'devnet' || cluster == 'testnet' || cluster == 'mainnet-beta';

export const AUTH_MESSAGE = 'Authentication';

export const validateAuth = async (
  { body }: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chainId, walletAddress, signature, solanaCluster } = body;

    if (!chainId || !isChainId(chainId)) throw 'Provide Valid chainId';
    if (!walletAddress) throw 'Provide walletAddress';
    if (!signature) throw 'Provide signature';
    if (
      chainId == WH_CHAIN_ID_SOLANA &&
      (!solanaCluster || !isSolanaCluster(solanaCluster))
    ) {
      throw 'Provide Valid solanaCluster';
    }

    const verify = chainId == WH_CHAIN_ID_SOLANA ? solanaVerify : evmVerify;
    const isVerified = await verify(AUTH_MESSAGE, signature, walletAddress);
    if (!isVerified) throw 'Unauthorized. Signature and Address Not Matching.';

    res.locals.auth = new Auth(
      chainId,
      walletAddress,
      chainId == WH_CHAIN_ID_SOLANA ? solanaCluster : null
    );
    return next();
  } catch (e: any) {
    console.log(body);
    console.error('Error at validating auth ... ');
    console.error(e);
    return res.status(400).json({
      success: false,
      message: e['shortMessage'] ?? e['message'] ?? `${e}`
    });
  }
};
