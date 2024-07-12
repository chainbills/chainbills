import { AnchorProvider, Program } from '@project-serum/anchor';
import {
  Connection,
  PublicKey,
  SystemProgram,
  clusterApiUrl
} from '@solana/web3.js';
import {
  Network,
  VAA,
  getContracts,
  toChainId
} from '@wormhole-foundation/sdk';
import BN from 'bn.js';
import bs58 from 'bs58';
import 'dotenv/config';
import nacl from 'tweetnacl';

import { PayloadMessage } from '../schemas/payload-message';
import { WH_CHAIN_ID_ETH_SEPOLIA } from './chain';
import { CONTRACT_ADDRESS } from './evm';
import { IDL, type Chainbills } from './idl';
import { solanaWallet } from './signers';
import { canonical } from './wallet';

export const PROGRAM_ID = 'p7Lu1yPzMRYLfLxWbEePx8kn3LNevFTbGVC5ghyADF9';

const getConnection = (network: Network) =>
  new Connection(
    clusterApiUrl(network == 'Mainnet' ? 'mainnet-beta' : 'devnet')
  );

export const program = (network: Network) =>
  new Program<Chainbills>(IDL, PROGRAM_ID, {
    connection: getConnection(network)
  });

export const solanaVerify = (
  message: string,
  signature: string,
  publicKey: string
) =>
  nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    bs58.decode(signature),
    bs58.decode(publicKey)
  );

const pda = (...seeds: any[]) =>
  PublicKey.findProgramAddressSync([...seeds], new PublicKey(PROGRAM_ID))[0];

const getHostCount = async (
  caller: Uint8Array,
  network: Network
): Promise<BN> => {
  const user = pda(caller);
  try {
    return (await program(network).account.user.fetch(user)).payablesCount;
  } catch (e) {
    return new BN(0);
  }
};

export const relayInitializePayable = async (
  network: Network,
  payload: PayloadMessage,
  vaa: VAA<'Uint8Array'>
) => {
  const { actionId, caller } = payload;
  const { emitterAddress, emitterChain, hash, sequence } = vaa;

  if (actionId !== 1) throw 'Invalid actionId for initializePayable';
  if (
    canonical(emitterAddress.address, 'Ethereum Sepolia').toLowerCase() !=
    CONTRACT_ADDRESS.toLowerCase()
  ) {
    throw 'Invalid emitterAddress';
  }

  const { coreBridge } = getContracts(network, 'Solana');
  if (!coreBridge) throw 'Got Invalid Solana coreBridge from Wormhole';
  const wormholeProgram = new PublicKey(coreBridge);
  const vaaAccount = PublicKey.findProgramAddressSync(
    [Buffer.from('PostedVaa'), hash],
    wormholeProgram
  )[0];

  const hostCount = await getHostCount(caller, network);
  const payable = pda(caller, Buffer.from('payable'), hostCount);
  const host = pda(caller);
  const wormholeReceived = pda(
    Buffer.from('wormhole_received'),
    new BN(toChainId(emitterChain)).toArrayLike(Buffer, 'le', 2),
    new BN(Number(sequence)).toArrayLike(Buffer, 'le', 8)
  );
  const foreignContract = pda(
    Buffer.from('foreign_contract'),
    new BN(WH_CHAIN_ID_ETH_SEPOLIA).toArrayLike(Buffer, 'le', 2)
  );
  const chainStats = pda(
    Buffer.from('chain'),
    new BN(WH_CHAIN_ID_ETH_SEPOLIA).toArrayLike(Buffer, 'le', 2)
  );
  const config = pda(Buffer.from('config'));
  const globalStats = pda(Buffer.from('global'));
  const systemProgram = new PublicKey(SystemProgram.programId);

  const accounts = {
    payable,
    host,
    globalStats,
    chainStats,
    signer: solanaWallet.publicKey,
    config,
    wormholeProgram,
    vaa: vaaAccount,
    foreignContract,
    wormholeReceived,
    systemProgram
  };

  const program = new Program<Chainbills>(
    IDL,
    PROGRAM_ID,
    new AnchorProvider(getConnection(network), solanaWallet, {})
  );
  return await program.methods
    .initializePayableReceived(Array.from(hash), Array.from(caller), hostCount)
    .accounts(accounts)
    .rpc();
};
