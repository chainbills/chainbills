import { OnChainSuccess, TokenAndAmount, User, contracts, solanadevnet, type Token } from '@/schemas';
import { IDL, useAnalyticsStore, type Chainbills } from '@/stores';
import { AnchorProvider, BN, Program, web3 } from '@project-serum/anchor';
import type { AllAccountsMap } from '@project-serum/anchor/dist/cjs/program/namespace/types';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction as createATAIx,
  getAssociatedTokenAddressSync as getATA,
  getAccount,
} from '@solana/spl-token';
import { Connection, PublicKey, TransactionInstruction, clusterApiUrl } from '@solana/web3.js';
import bs58 from 'bs58';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useAnchorWallet, useWallet as useSolanaWallet } from 'solana-wallets-vue';

const PROGRAM_ID = contracts.solanadevnet;

export const useSolanaStore = defineStore('solana', () => {
  const getPDA = (seeds: (Buffer | Uint8Array)[]): string =>
    PublicKey.findProgramAddressSync(seeds, new PublicKey(PROGRAM_ID))[0].toBase58();

  const analytics = useAnalyticsStore();
  const anchorWallet = useAnchorWallet();
  const chainStats = getPDA([Buffer.from('chain')]);
  const connection = new Connection(clusterApiUrl('devnet'), 'finalized');
  const solanaWallet = useSolanaWallet();
  const systemProgram = new PublicKey(web3.SystemProgram.programId);
  const toast = useToast();
  const tokenProgram = new PublicKey(TOKEN_PROGRAM_ID);

  /** Returns UI-Formatted balance (Accounts for Decimals) */
  const balance = async (token: Token): Promise<number | null> => {
    try {
      if (!anchorWallet.value) return null;
      if (!token.details.solanadevnet) return null;
      if (token.details.solanadevnet.address == PROGRAM_ID) {
        return (await connection.getBalance(anchorWallet.value!.publicKey)) / 10 ** 9;
      } else {
        return (
          await connection.getTokenAccountBalance(
            getATA(new PublicKey(token.details.solanadevnet.address), anchorWallet.value!.publicKey)
          )
        ).value.uiAmount;
      }
    } catch (e) {
      if (`${e}`.includes('could not find account')) return 0;
      toastError(`Couldn't fetch ${token.name} balance: ${e}`);
      return null;
    }
  };

  const callContractWrapper = async (call: Promise<string>, created: string): Promise<OnChainSuccess | null> => {
    try {
      analytics.recordEvent('initiated_solana_transaction');
      const txHash = await call;
      analytics.recordEvent('completed_solana_transaction');
      return new OnChainSuccess({ created, txHash, chain: solanadevnet });
    } catch (e) {
      if (!`${e}`.includes('rejected')) {
        toastError(`${e}`);
        analytics.recordEvent('failed_solana_transaction');
        console.error(e);
      } else {
        analytics.recordEvent('rejected_solana_transaction');
      }
      return null;
    }
  };

  const createPayable = async (tokensAndAmounts: TokenAndAmount[]): Promise<OnChainSuccess | null> => {
    if (!anchorWallet.value) {
      toastError('Connect Solana Wallet First!');
      return null;
    }

    const currentUser = (await getCurrentUser())!;
    const isExistingUser = currentUser.chainCount > 0;
    let hostCount = 1;
    if (isExistingUser) hostCount = currentUser.payablesCount + 1;

    const payable = getPDA(getSeeds('payable', hostCount));
    const payableChainCounter = getPDA([
      new PublicKey(payable).toBuffer(),
      new BN(1).toArrayLike(Buffer, 'le', 2), // TODO: 1 should be come zero for current chain
    ]);
    const call = program()
      .methods.createPayable(tokensAndAmounts.map((t) => t.toOnChain(solanadevnet)) as any)
      .accounts({
        payable,
        payableChainCounter,
        host: getCurrentUserPDA(),
        chainStats,
        signer: anchorWallet.value!.publicKey,
        systemProgram,
      });

    if (!isExistingUser) call.preInstructions([(await initializeUserIx())!]);

    return await callContractWrapper(call.rpc({ preflightCommitment: 'confirmed' }), payable);
  };

  const doesATAExists = async (ata: PublicKey): Promise<boolean> => {
    let exists = false;
    try {
      exists = !!(await getAccount(connection, ata));
    } catch (_) {}
    return exists;
  };

  const fetchEntity = async (entity: keyof AllAccountsMap<Chainbills>, id: string) =>
    await program().account[entity].fetch(new PublicKey(id));

  const initializeUserIx = async (): Promise<TransactionInstruction> =>
    program()
      .methods.initializeUser()
      .accounts({
        user: getCurrentUserPDA(),
        signer: anchorWallet.value!.publicKey,
        chainStats,
        systemProgram,
      })
      .instruction();

  const getCurrentUser = async () => {
    if (!anchorWallet.value) return null;
    const wallet = anchorWallet.value.publicKey.toBase58();
    const pdaAddr = getCurrentUserPDA();
    try {
      return new User(solanadevnet, wallet, await fetchEntity('user', pdaAddr));
    } catch (_) {
      // TODO: Check for network errors and throw and return null if need be
      // Return empty/new user
      return new User(solanadevnet, wallet, null);
    }
  };

  const getCurrentUserPDA = (): string => getPDA([anchorWallet.value!.publicKey.toBuffer()]);

  const getPayablePaymentId = (payableId: string, count: number): string =>
    getPDA(getSeeds('payable_payment', count, new PublicKey(payableId)));

  const getPayableWithdrawalId = async (payableId: string, count: number): Promise<string | null> => {
    const pyblWtdlId = getPDA(getSeeds('payable_withdrawal_counter', count, new PublicKey(payableId)));

    let pyblWtdl;
    try {
      pyblWtdl = await fetchEntity('payableWithdrawalCounter', pyblWtdlId);
    } catch (e) {
      toastError(`Couldn't fetch payable withdrawal counter: ${e}`);
      return null;
    }

    let payable;
    try {
      payable = await fetchEntity('payable', payableId);
    } catch (e) {
      toastError(`Couldn't fetch payable details: ${e}`);
      return null;
    }

    const { hostCount } = pyblWtdl;
    const { host } = payable;

    return getPDA(getSeeds('withdrawal', hostCount.toNumber(), host));
  };

  const getSeeds = (prefix: string, count: number, pubkey?: PublicKey): Uint8Array[] => {
    return [
      (pubkey ?? anchorWallet.value!.publicKey).toBuffer(),
      Buffer.from(prefix),
      new BN(count).toArrayLike(Buffer, 'le', 8),
    ];
  };

  const getUserPayableId = (count: number): string => getPDA(getSeeds('payable', count));

  const getUserPaymentId = (count: number): string => getPDA(getSeeds('user_payment', count));

  const getUserWithdrawalId = (count: number): string => getPDA(getSeeds('withdrawal', count));

  const pay = async (
    payableId: string,
    { amount, details, name: tokenName }: TokenAndAmount
  ): Promise<OnChainSuccess | null> => {
    if (amount == 0) {
      toastError('Cannot withdraw zero');
      return null;
    }

    if (!anchorWallet.value) {
      toastError('Connect Solana Wallet First!');
      return null;
    }

    if (!details.solanadevnet) {
      toastError('Token not supported on Solana for now');
      return null;
    }

    const currentUser = (await getCurrentUser())!;
    const isExistingUser = currentUser.chainCount > 0;
    let payerCount = 1;
    if (isExistingUser) payerCount = currentUser.paymentsCount + 1;

    const userPayment = getPDA(getSeeds('user_payment', payerCount));
    const payable = await fetchEntity('payable', payableId);
    const payableCount = Number(payable.paymentsCount) + 1;
    const payablePayment = getPDA(getSeeds('payable_payment', payableCount, new PublicKey(payableId)));
    const payableChainCounter = getPDA([
      new PublicKey(payableId).toBuffer(),
      new BN(1).toArrayLike(Buffer, 'le', 2), // TODO: 1 should be come zero for current chain
    ]);
    const signer = anchorWallet.value.publicKey;
    const mint = new PublicKey(details.solanadevnet.address);
    const maxWithdrawalFeeDetails = getPDA([Buffer.from('max_withdrawal_fee'), mint.toBuffer()]);

    const isNativePayment = details.solanadevnet.address == PROGRAM_ID;
    let splAccounts = {};
    if (!isNativePayment) {
      const payerTokenAccount = getATA(mint, signer, true);
      if (!(await doesATAExists(payerTokenAccount))) {
        throw `You don't have any ${tokenName}`;
      }
      const chainTokenAccount = getATA(mint, new PublicKey(chainStats), true);
      splAccounts = {
        mint,
        payerTokenAccount,
        chainTokenAccount,
        tokenProgram,
      };
    }

    const method = isNativePayment ? 'payNative' : 'pay';
    const call = program()
      .methods[method](new BN(amount))
      .accounts({
        userPayment,
        payablePayment,
        payableChainCounter,
        payable: new PublicKey(payableId),
        payer: getCurrentUserPDA(),
        chainStats,
        maxWithdrawalFeeDetails,
        signer,
        systemProgram,
        ...(!isNativePayment ? splAccounts : {}),
      });

    call.preInstructions([...(!isExistingUser ? [(await initializeUserIx())!] : [])]);

    return await callContractWrapper(call.rpc({ preflightCommitment: 'confirmed' }), userPayment);
  };

  const program = () =>
    new Program<Chainbills>(
      IDL,
      PROGRAM_ID,
      ...(anchorWallet.value ? [new AnchorProvider(connection, anchorWallet.value!, {})] : [{ connection }])
    );

  const sign = async (message: string): Promise<string | null> => {
    if (!solanaWallet.connected.value) {
      toastError('Connect Solana Wallet First!');
      return null;
    }
    return bs58.encode(await solanaWallet.signMessage.value!(new TextEncoder().encode(message)));
  };

  const toastError = (detail: string) => toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  const tryFetchEntity = async (entity: keyof AllAccountsMap<Chainbills>, id: string, ignoreErrors = false) => {
    try {
      return await program().account[entity].fetch(new PublicKey(id));
    } catch (e) {
      if (!ignoreErrors) {
        console.error(e);
        toastError(`${e}`);
      }
      return null;
    }
  };

  const withdraw = async (payableId: string, { amount, details }: TokenAndAmount): Promise<OnChainSuccess | null> => {
    if (amount == 0) {
      toastError('Cannot withdraw zero');
      return null;
    }

    if (!anchorWallet.value) {
      toastError('Connect Solana Wallet First!');
      return null;
    }

    if (!details.solanadevnet) {
      toastError('Token not supported on Solana for now');
      return null;
    }

    const config = getPDA([Buffer.from('config')]);
    const withdrawal = getPDA(getSeeds('withdrawal', (await getCurrentUser())!.withdrawalsCount + 1));
    const payable = await fetchEntity('payable', payableId);
    const payableCount = Number(payable.withdrawalsCount) + 1;
    const payableWithdrawalCounter = getPDA(
      getSeeds('payable_withdrawal_counter', payableCount, new PublicKey(payableId))
    );
    const mint = new PublicKey(details.solanadevnet.address);
    const maxWithdrawalFeeDetails = getPDA([Buffer.from('max_withdrawal_fee'), mint.toBuffer()]);
    const signer = anchorWallet.value!.publicKey;
    const configData = await fetchEntity('config', config);
    const feeCollector = configData.chainbillsFeeCollector;

    const isNativePayment = details.solanadevnet.address == PROGRAM_ID;
    let splAccounts = {};
    if (!isNativePayment) {
      const hostTokenAccount = getATA(mint, signer, false);
      const chainTokenAccount = getATA(mint, new PublicKey(chainStats), true);
      const feesTokenAccount = getATA(mint, feeCollector, false);
      splAccounts = {
        mint,
        hostTokenAccount,
        chainTokenAccount,
        feesTokenAccount,
        tokenProgram,
      };
    }

    const method = isNativePayment ? 'withdrawNative' : 'withdraw';
    const call = program()
      .methods[method](new BN(amount))
      .accounts({
        withdrawal,
        payableWithdrawalCounter,
        payable: payableId,
        host: getCurrentUserPDA(),
        chainStats,
        config,
        maxWithdrawalFeeDetails,
        feeCollector,
        signer,
        systemProgram,
        ...(!isNativePayment ? splAccounts : {}),
      });

    if (!isNativePayment) {
      const hostTokenAccount = getATA(mint, signer, false);
      const hostTAExists = await doesATAExists(hostTokenAccount);
      if (!hostTAExists) {
        call.preInstructions([createATAIx(signer, hostTokenAccount, signer, mint)]);
      }
    }

    return await callContractWrapper(call.rpc({ preflightCommitment: 'confirmed' }), withdrawal);
  };

  return {
    balance,
    createPayable,
    fetchEntity,
    getCurrentUser,
    getPayablePaymentId,
    getPayableWithdrawalId,
    getUserPayableId,
    getUserPaymentId,
    getUserWithdrawalId,
    pay,
    program,
    sign,
    tryFetchEntity,
    withdraw,
  };
});
