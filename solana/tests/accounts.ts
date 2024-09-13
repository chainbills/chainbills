import {
  AnchorProvider,
  BN,
  Program,
  web3,
  workspace
} from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getContracts } from '@wormhole-foundation/sdk';
import { Chainbills } from '../target/types/chainbills';

const program = workspace.Chainbills as Program<Chainbills>;
export const systemProgram = new PublicKey(web3.SystemProgram.programId);
export const owner = AnchorProvider.env().wallet.publicKey;
export const chainbillsFeeCollector = Keypair.generate();
export const user1 = Keypair.generate();
export const getPDA = (seeds: (Uint8Array | Buffer)[]) =>
  PublicKey.findProgramAddressSync(seeds, new PublicKey(program.programId))[0];
export const config = getPDA([Buffer.from('config')]);
export const chainStats = getPDA([Buffer.from('chain')]);
const { coreBridge } = getContracts('Testnet', 'Solana');
export const wormholeProgram = new PublicKey(coreBridge);
export const getWhPDA = (seeds: (Uint8Array | Buffer)[]) =>
  PublicKey.findProgramAddressSync(seeds, wormholeProgram)[0];
export const wormholeBridge = getWhPDA([Buffer.from('Bridge')]);
export const wormholeEmitter = getPDA([Buffer.from('emitter')]);
export const wormholeFeeCollector = getWhPDA([Buffer.from('fee_collector')]);
export const wormholeSequence = getWhPDA([
  Buffer.from('Sequence'),
  wormholeEmitter.toBuffer()
]);
export const wormholeMessage = getPDA([
  Buffer.from('sent'),
  new BN(1).toArrayLike(Buffer, 'le', 8) // 1 represents 1st Wormhole Sequence
]);

export const initializeAccs = {
  owner,
  chainStats,
  config,
  chainbillsFeeCollector: chainbillsFeeCollector.publicKey,
  wormholeProgram,
  wormholeBridge,
  wormholeEmitter,
  wormholeFeeCollector,
  wormholeSequence,
  wormholeMessage,
  systemProgram
};