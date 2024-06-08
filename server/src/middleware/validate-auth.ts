import { Cluster } from '@solana/web3.js';
import { ChainId } from '@wormhole-foundation/sdk';
import { NextFunction, Request, Response } from 'express';

import { Auth } from '../schemas/auth';
import { WH_CHAIN_ID_ETH_SEPOLIA, WH_CHAIN_ID_SOLANA } from '../utils/chain';
import { verify as evmVerify } from '../utils/evm';
import { verify as solanaVerify } from '../utils/solana';

const isChainId = (chainId: string): chainId is ChainId =>
  chainId == WH_CHAIN_ID_SOLANA || chainId == WH_CHAIN_ID_ETH_SEPOLIA;

const isSolanaCluster = (cluster: string): cluster is Cluster =>
  cluster == 'devnet' || cluster == 'testnet' || cluster == 'mainnet-beta';

export const AUTH_MESSAGE = 'Authentication';

export const validateAuth = async (
  { headers }: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const chainId = headers['chain-id'];
    const walletAddress = headers['wallet-address'];
    const signature = headers['signature'];
    const solanaCluster = headers['solana-cluster'];

    if (!chainId || !isChainId(chainId)) throw 'Provide Valid chain-id header';
    if (!walletAddress) throw 'Provide wallet-address header';
    if (!signature) throw 'Provide signature header';
    if (
      chainId == WH_CHAIN_ID_SOLANA &&
      (!solanaCluster || !isSolanaCluster(solanaCluster))
    ) {
      throw 'Provide Valid solana-cluster header';
    }

    const verify = chainId == WH_CHAIN_ID_SOLANA ? solanaVerify : evmVerify;
    const isVerified = await verify(AUTH_MESSAGE, signature, walletAddress);
    if (!isVerified) throw 'Unauthorized. Signature and Address Not Matching.';

    res.locals.auth = new Auth(
      chainId,
      walletAddress,
      chainId == WH_CHAIN_ID_SOLANA ? solanaCluster : null
    );
    next();
  } catch (e) {
    console.log(headers);
    console.error(`Error at validating auth ... `);
    console.error(e);
    return res.status(400).json({
      success: false,
      message: e['shortMessage'] ?? e['message'] ?? `${e}`
    });
  }
};
