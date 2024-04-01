import { AnchorProvider, Program, web3, type Idl } from '@project-serum/anchor';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useAnchorWallet } from 'solana-wallets-vue';
import idl from './idl.json';

export const PROGRAM_ID = '4BTSkx71TpMMScc4QpVPr5ebH1rfsQojPSmcCALsq45d';

export const useSolanaStore = defineStore('solana', () => {
  const wallet = useAnchorWallet();
  const globalStats = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    new PublicKey(PROGRAM_ID),
  )[0];
  const program = () =>
    new Program(
      idl as Idl,
      PROGRAM_ID,
      new AnchorProvider(
        new Connection(clusterApiUrl('devnet')),
        wallet.value!,
        {},
      ),
    );
  const systemProgram = new PublicKey(web3.SystemProgram.programId);

  return { systemProgram, program, globalStats };
});
