import { User } from '@/schemas/user';
import {
  AnchorProvider,
  BN,
  Program,
  web3,
  type Idl,
} from '@project-serum/anchor';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useAnchorWallet } from 'solana-wallets-vue';
import idl from './idl.json';
import { useServerStore } from './server';

export const PROGRAM_ID = '4BTSkx71TpMMScc4QpVPr5ebH1rfsQojPSmcCALsq45d';

export interface TokenAndAmount {
  token: string | PublicKey;
  amount: number | BN;
}
export const tokens = [
  {
    name: 'USDC',
    address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    decimals: 6,
  },
  {
    name: 'SOL',
    address: 'So11111111111111111111111111111111111111112',
    decimals: 9,
  },
];

export const useSolanaProgramStore = defineStore('solana-program', () => {
  const connection = new Connection(clusterApiUrl('devnet'));
  const server = useServerStore();
  const toast = useToast();
  const wallet = useAnchorWallet();

  const userAccountPublicKey = () =>
    PublicKey.findProgramAddressSync(
      [wallet.value!.publicKey.toBuffer()],
      new PublicKey(PROGRAM_ID),
    )[0];
  const globalStats = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    new PublicKey(PROGRAM_ID),
  )[0];
  const systemProgram = new PublicKey(web3.SystemProgram.programId);

  const provider = () => new AnchorProvider(connection, wallet.value!, {});
  const program = () => new Program(idl as Idl, PROGRAM_ID, provider()!);

  const isUserInitialized = async (): Promise<boolean> => {
    const key = userAccountPublicKey();
    try {
      await program().account.user.fetch(key);
      return true;
    } catch (e) {
      return !`${e}`.includes(
        `Error: Account does not exist or has no data ${key}`,
      );
    }
  };

  const userData = async (): Promise<User> => {
    const address = userAccountPublicKey().toBase58();
    return new User(address, await program().account.user.fetch(address));
  };

  const initializeUserInstruction = () =>
    program()
      .methods.initializeUser()
      .accounts({
        user: userAccountPublicKey()!,
        signer: wallet.value?.publicKey,
        globalStats,
        systemProgram,
      })
      .instruction();

  const initializePayable = async (
    email: string,
    description: string,
    tokensAndAmounts: TokenAndAmount[],
    allowsAnyToken: boolean,
  ): Promise<string | null> => {
    if (!wallet.value) return null;

    tokensAndAmounts.forEach((taa) => {
      taa.amount = new BN(taa.amount);
      taa.token = new PublicKey(taa.token);
    });

    const isExistingUser = await isUserInitialized();
    let hostCount = 1;
    if (isExistingUser) hostCount = (await userData()).payablesCount + 1;

    const payable = PublicKey.findProgramAddressSync(
      [
        wallet.value!.publicKey.toBuffer(),
        Buffer.from('payable'),
        new BN(hostCount).toArrayLike(Buffer, 'le', 8),
      ],
      new PublicKey(PROGRAM_ID),
    )[0];
    const call = program()
      .methods.initializePayable(description, tokensAndAmounts, allowsAnyToken)
      .accounts({
        payable,
        host: userAccountPublicKey(),
        globalStats,
        signer: wallet.value?.publicKey,
        systemProgram,
      });

    if (!isExistingUser) {
      call.preInstructions([await initializeUserInstruction()]);
    }

    try {
      const txHash = await call.rpc();
      console.log(
        `Create Payable Transaction Details: https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
      );
      await server.createdPayable(payable.toBase58(), email);
      return payable.toBase58();
    } catch (e) {
      console.error(e);
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `${e}`,
        life: 5000,
      });
      return null;
    }
  };

  return { initializePayable };
});
