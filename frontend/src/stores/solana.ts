import { AnchorProvider, Program, web3, type Idl } from '@project-serum/anchor';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useAnchorWallet } from 'solana-wallets-vue';
import idl from './idl.json';

export const PROGRAM_ID = '4BTSkx71TpMMScc4QpVPr5ebH1rfsQojPSmcCALsq45d';

export const useSolanaStore = defineStore('solana', () => {
  const wallet = useAnchorWallet();
  const connection = new Connection(clusterApiUrl('devnet'), 'finalized');
  const toast = useToast();
  const balance = async (
    tokenAccount: PublicKey,
    tokenName: string,
  ): Promise<number | null> => {
    try {
      return (await connection.getTokenAccountBalance(tokenAccount)).value
        .uiAmount;
    } catch (e) {
      if (`${e}`.includes('could not find account')) return 0;
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `Couldn't fetch ${tokenName} balance: ${e}`,
        life: 12000,
      });
      return null;
    }
  };

  const createATAInstruction = (
    ata: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
  ) =>
    createAssociatedTokenAccountInstruction(
      wallet.value!.publicKey,
      ata,
      owner,
      mint,
    );

  const getATAAndExists = async (
    mint: PublicKey,
    owner: PublicKey,
  ): Promise<{ account: PublicKey; exists: boolean }> => {
    const account = getAssociatedTokenAddressSync(mint, owner, true);
    let exists = false;
    try {
      exists = !!(await getAccount(connection, account));
    } catch (_) {}
    return { account, exists };
  };

  const globalStats = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    new PublicKey(PROGRAM_ID),
  )[0];
  const program = () =>
    new Program(
      idl as Idl,
      PROGRAM_ID,
      new AnchorProvider(connection, wallet.value!, {}),
    );
  const systemProgram = new PublicKey(web3.SystemProgram.programId);
  const tokenProgram = new PublicKey(TOKEN_PROGRAM_ID);

  return {
    balance,
    createATAInstruction,
    getATAAndExists,
    globalStats,
    program,
    systemProgram,
    tokenProgram,
  };
});
