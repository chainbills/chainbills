import { OnChainSuccess, TokenAndAmount, User, contracts, solanadevnet, type Chain, type Token } from '@/schemas';
import { useAnalyticsStore } from '@/stores/analytics';
import { IDL } from '@/stores/idl';
import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync as getATA,
  getAccount,
} from '@solana/spl-token';
import { Connection, PublicKey, SystemProgram, clusterApiUrl } from '@solana/web3.js';
import bs58 from 'bs58';
import { defineStore } from 'pinia';
import { useToast } from 'primevue/usetoast';
import { useAnchorWallet, useWallet as useSolanaWallet } from 'solana-wallets-vue';

const PROGRAM_ID = new PublicKey(contracts.solanadevnet);
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// ── PDA derivation helpers ─────────────────────────────────────────────────────

const pda = (seeds: (Uint8Array | Buffer)[]): PublicKey => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

const le8 = (n: bigint): Buffer => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
};

const configPDA = () => pda([Buffer.from('config')]);
const statsPDA = () => pda([Buffer.from('stats')]);
const senderAuthorityPDA = () => pda([Buffer.from('sender_authority')]);
const userRecordPDA = (wallet: PublicKey) => pda([Buffer.from('user'), wallet.toBuffer()]);
const payablePDA = (host: PublicKey, hostCount: bigint) =>
  pda([Buffer.from('payable'), host.toBuffer(), le8(hostCount)]);
const vaultAuthorityPDA = (payable: PublicKey) => pda([Buffer.from('vault'), payable.toBuffer()]);
const tokenConfigPDA = (mint: PublicKey) => pda([Buffer.from('token_config'), mint.toBuffer()]);
const userPaymentPDA = (payerWallet: PublicKey, paymentsCount: bigint) =>
  pda([Buffer.from('user_payment'), payerWallet.toBuffer(), le8(paymentsCount)]);
const payablePaymentPDA = (payableKey: PublicKey, paymentsCount: bigint) =>
  pda([Buffer.from('payable_payment'), payableKey.toBuffer(), le8(paymentsCount)]);
const withdrawalPDA = (payableKey: PublicKey, withdrawalsCount: bigint) =>
  pda([Buffer.from('withdrawal'), payableKey.toBuffer(), le8(withdrawalsCount)]);
const activityRecordPDA = (totalActivities: bigint) =>
  pda([Buffer.from('activity'), Buffer.from('global'), le8(totalActivities)]);
const userActivityPointerPDA = (wallet: PublicKey, activitiesCount: bigint) =>
  pda([Buffer.from('activity'), Buffer.from('user'), wallet.toBuffer(), le8(activitiesCount)]);
const payableActivityPointerPDA = (payableKey: PublicKey, activitiesCount: bigint) =>
  pda([Buffer.from('activity'), Buffer.from('payable'), payableKey.toBuffer(), le8(activitiesCount)]);
const chainRegistryPDA = (cbChainIdBytes: Buffer) => pda([Buffer.from('chain_registry'), cbChainIdBytes]);
const foreignPayablePDA = (payableIdBytes: Buffer) => pda([Buffer.from('foreign_payable'), payableIdBytes]);

// ── Helpers ────────────────────────────────────────────────────────────────────

function hexToBytes32(hex: string): Buffer {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(clean.padStart(64, '0'), 'hex');
}

function isNativeSol(tokenAddress: string): boolean {
  return tokenAddress === contracts.solanadevnet;
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useSolanaStore = defineStore('solana', () => {
  const analytics = useAnalyticsStore();
  const anchorWallet = useAnchorWallet();
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const solanaWallet = useSolanaWallet();
  const toast = useToast();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = (): any => {
    const provider = anchorWallet.value
      ? new AnchorProvider(connection, anchorWallet.value, { commitment: 'confirmed' })
      : new AnchorProvider(connection, {} as any, { commitment: 'confirmed' });
    return new Program(IDL, provider);
  };

  const acct = (prog: any) => prog.account as Record<string, any>;

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

  /** Raw on-chain balance (lamports, or the SPL token's smallest unit) of the given token for the connected wallet. Returns null on error. */
  const balance = async (token: Token): Promise<bigint | null> => {
    try {
      if (!anchorWallet.value) return null;
      if (!token.details.solanadevnet) return null;
      const addr = token.details.solanadevnet.address;
      if (isNativeSol(addr)) {
        return BigInt(await connection.getBalance(anchorWallet.value.publicKey));
      }
      const ata = getATA(new PublicKey(addr), anchorWallet.value.publicKey);
      return BigInt((await connection.getTokenAccountBalance(ata)).value.amount);
    } catch (e) {
      if (`${e}`.includes('could not find account')) return 0n;
      toastError(`Couldn't fetch balance: ${e}`);
      return null;
    }
  };

  /** Create a new payable. */
  const createPayable = async (
    tokensAndAmounts: TokenAndAmount[],
    isAutoWithdraw: boolean
  ): Promise<OnChainSuccess | null> => {
    if (!anchorWallet.value) {
      toastError('Connect Solana Wallet First!');
      return null;
    }
    const signer = anchorWallet.value.publicKey;
    const prog = program();

    const [statsData, userRecDataOrNull] = await Promise.all([
      acct(prog)['stats'].fetch(statsPDA()),
      acct(prog)
        ['userRecord'].fetch(userRecordPDA(signer))
        .catch(() => null),
    ]);

    const hostCount = userRecDataOrNull ? BigInt((userRecDataOrNull as any).payablesCount.toString()) : 0n;
    const userActivities = userRecDataOrNull ? BigInt((userRecDataOrNull as any).activitiesCount.toString()) : 0n;
    const totalActivities = BigInt((statsData as any).totalActivities.toString());

    const payableKey = payablePDA(signer, hostCount);
    const vaultAuthority = vaultAuthorityPDA(payableKey);
    const activityRecord = activityRecordPDA(totalActivities);
    const userActivityPointer = userActivityPointerPDA(signer, userActivities);
    const payableActivityPointer = payableActivityPointerPDA(payableKey, 0n);
    const ataa = tokensAndAmounts.map((t) => t.toOnChain(solanadevnet)) as any;

    return callContractWrapper(
      prog.methods
        .createPayable(ataa, isAutoWithdraw)
        .accounts({
          host: signer,
          userRecord: userRecordPDA(signer),
          payable: payableKey,
          vaultAuthority,
          config: configPDA(),
          stats: statsPDA(),
          activityRecord,
          userActivityPointer,
          payableActivityPointer,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ preflightCommitment: 'confirmed' }),
      payableKey.toBase58()
    );
  };

  /** Close a payable (stop accepting payments). */
  const closePayable = async (payableId: string): Promise<OnChainSuccess | null> => {
    if (!anchorWallet.value) {
      toastError('Connect Solana Wallet First!');
      return null;
    }
    return _payableAction('closePayable', payableId);
  };

  /** Reopen a closed payable. */
  const reopenPayable = async (payableId: string): Promise<OnChainSuccess | null> => {
    if (!anchorWallet.value) {
      toastError('Connect Solana Wallet First!');
      return null;
    }
    return _payableAction('reopenPayable', payableId);
  };

  /** Update the allowed tokens and amounts on a payable. */
  const updatePayableATAA = async (
    payableId: string,
    tokensAndAmounts: TokenAndAmount[]
  ): Promise<OnChainSuccess | null> => {
    if (!anchorWallet.value) {
      toastError('Connect Solana Wallet First!');
      return null;
    }
    const signer = anchorWallet.value.publicKey;
    const prog = program();
    const payableKey = new PublicKey(payableId);

    const [statsData, userRecData, payableData] = await Promise.all([
      acct(prog)['stats'].fetch(statsPDA()),
      acct(prog)['userRecord'].fetch(userRecordPDA(signer)),
      acct(prog)['payable'].fetch(payableKey),
    ]);
    const accounts = _activityAccounts(signer, payableKey, statsData, userRecData, payableData);

    return callContractWrapper(
      prog.methods
        .updatePayableAtaa(tokensAndAmounts.map((t) => t.toOnChain(solanadevnet)) as any)
        .accounts({
          host: signer,
          userRecord: userRecordPDA(signer),
          payable: payableKey,
          ...accounts,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ preflightCommitment: 'confirmed' }),
      payableId
    );
  };

  /** Pay to a Solana-chain payable using an SPL token or native SOL. */
  const pay = async (
    payableId: string,
    { amount, details, name: tokenName }: TokenAndAmount
  ): Promise<OnChainSuccess | null> => {
    if (!anchorWallet.value) {
      toastError('Connect Solana Wallet First!');
      return null;
    }
    if (!details.solanadevnet) {
      toastError('Token not supported on Solana');
      return null;
    }
    const signer = anchorWallet.value.publicKey;
    const prog = program();
    const payableKey = new PublicKey(payableId);

    const [statsData, userRecDataOrNull, payableData] = await Promise.all([
      acct(prog)['stats'].fetch(statsPDA()),
      acct(prog)
        ['userRecord'].fetch(userRecordPDA(signer))
        .catch(() => null),
      acct(prog)['payable'].fetch(payableKey),
    ]);

    const payerPayments = userRecDataOrNull ? BigInt((userRecDataOrNull as any).paymentsCount.toString()) : 0n;
    const userActivities = userRecDataOrNull ? BigInt((userRecDataOrNull as any).activitiesCount.toString()) : 0n;
    const payablePayments = BigInt((payableData as any).paymentsCount.toString());
    const payableActivities = BigInt((payableData as any).activitiesCount.toString());
    const totalActivities = BigInt((statsData as any).totalActivities.toString());

    const userPayment = userPaymentPDA(signer, payerPayments);
    const payablePayment = payablePaymentPDA(payableKey, payablePayments);
    const activityRecord = activityRecordPDA(totalActivities);
    const userActivityPointer = userActivityPointerPDA(signer, userActivities);
    const payableActivityPointer = payableActivityPointerPDA(payableKey, payableActivities);
    const vaultAuthority = vaultAuthorityPDA(payableKey);

    const tokenAddr = details.solanadevnet.address;

    if (isNativeSol(tokenAddr)) {
      return callContractWrapper(
        prog.methods
          .payNative(new BN(amount.toString()))
          .accounts({
            payer: signer,
            userRecord: userRecordPDA(signer),
            payable: payableKey,
            vaultAuthority,
            config: configPDA(),
            stats: statsPDA(),
            tokenConfig: tokenConfigPDA(SystemProgram.programId),
            userPayment,
            payablePayment,
            activityRecord,
            userActivityPointer,
            payableActivityPointer,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ preflightCommitment: 'confirmed' }),
        userPayment.toBase58()
      );
    }

    const mint = new PublicKey(tokenAddr);
    const payerTokenAccount = getATA(mint, signer, true);
    const vaultTokenAccount = getATA(mint, vaultAuthority, true);

    const ataExists = await _ataExists(payerTokenAccount);
    if (!ataExists) {
      toastError(`You don't have any ${tokenName}`);
      return null;
    }

    return callContractWrapper(
      prog.methods
        .pay(new BN(amount.toString()))
        .accounts({
          payer: signer,
          userRecord: userRecordPDA(signer),
          payable: payableKey,
          payerTokenAccount,
          vaultAuthority,
          vaultTokenAccount,
          tokenMint: mint,
          config: configPDA(),
          stats: statsPDA(),
          tokenConfig: tokenConfigPDA(mint),
          userPayment,
          payablePayment,
          activityRecord,
          userActivityPointer,
          payableActivityPointer,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ preflightCommitment: 'confirmed' }),
      userPayment.toBase58()
    );
  };

  /** Pay to a foreign (EVM) payable using USDC via CCTP + Wormhole. */
  const payForeignViaCctp = async (
    payableId: string,
    { amount, details }: TokenAndAmount,
    payableChain: Chain
  ): Promise<OnChainSuccess | null> => {
    if (!anchorWallet.value) {
      toastError('Connect Solana Wallet First!');
      return null;
    }
    if (!details.solanadevnet) {
      toastError('Only USDC supported for cross-chain payments');
      return null;
    }
    const signer = anchorWallet.value.publicKey;
    const prog = program();

    const foreignPayableIdBytes = hexToBytes32(payableId);
    const destCbChainIdBytes = hexToBytes32(payableChain.cbChainId);

    const [statsData, userRecDataOrNull] = await Promise.all([
      acct(prog)['stats'].fetch(statsPDA()),
      acct(prog)
        ['userRecord'].fetch(userRecordPDA(signer))
        .catch(() => null),
    ]);

    const payerPayments = userRecDataOrNull ? BigInt((userRecDataOrNull as any).paymentsCount.toString()) : 0n;
    const userActivities = userRecDataOrNull ? BigInt((userRecDataOrNull as any).activitiesCount.toString()) : 0n;
    const totalActivities = BigInt((statsData as any).totalActivities.toString());

    const senderAuthority = senderAuthorityPDA();
    const userPayment = userPaymentPDA(signer, payerPayments);
    const activityRecord = activityRecordPDA(totalActivities);
    const userActivityPointer = userActivityPointerPDA(signer, userActivities);
    const payerUsdcAta = getATA(USDC_MINT, signer, true);
    const programUsdcAta = getATA(USDC_MINT, senderAuthority, true);

    return callContractWrapper(
      prog.methods
        .payForeignViaCctp(
          Array.from(foreignPayableIdBytes),
          Array.from(destCbChainIdBytes),
          new BN(amount.toString()),
          new BN(0) // max_fee=0 → standard CCTP transfer
        )
        .accounts({
          payer: signer,
          userRecord: userRecordPDA(signer),
          foreignPayable: foreignPayablePDA(foreignPayableIdBytes),
          config: configPDA(),
          stats: statsPDA(),
          chainRegistry: chainRegistryPDA(destCbChainIdBytes),
          usdcMint: USDC_MINT,
          payerUsdcAta,
          senderAuthority,
          programUsdcAta,
          userPayment,
          activityRecord,
          userActivityPointer,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ preflightCommitment: 'confirmed' }),
      userPayment.toBase58()
    );
  };

  /** Withdraw from a Solana payable. */
  const withdraw = async (payableId: string, { amount, details }: TokenAndAmount): Promise<OnChainSuccess | null> => {
    if (!anchorWallet.value) {
      toastError('Connect Solana Wallet First!');
      return null;
    }
    if (!details.solanadevnet) {
      toastError('Token not supported on Solana');
      return null;
    }
    const signer = anchorWallet.value.publicKey;
    const prog = program();
    const payableKey = new PublicKey(payableId);

    const [statsData, userRecData, payableData, configData] = await Promise.all([
      acct(prog)['stats'].fetch(statsPDA()),
      acct(prog)['userRecord'].fetch(userRecordPDA(signer)),
      acct(prog)['payable'].fetch(payableKey),
      acct(prog)['config'].fetch(configPDA()),
    ]);

    const accounts = _activityAccounts(signer, payableKey, statsData, userRecData, payableData);
    const payableWithdrawals = BigInt((payableData as any).withdrawalsCount.toString());
    const withdrawal = withdrawalPDA(payableKey, payableWithdrawals);
    const feeCollector = new PublicKey((configData as any).feeCollector);
    const vaultAuthority = vaultAuthorityPDA(payableKey);
    const tokenAddr = details.solanadevnet.address;

    if (isNativeSol(tokenAddr)) {
      return callContractWrapper(
        prog.methods
          .withdrawNative(new BN(amount.toString()))
          .accounts({
            host: signer,
            userRecord: userRecordPDA(signer),
            payable: payableKey,
            vaultAuthority,
            feeCollector,
            config: configPDA(),
            tokenConfig: tokenConfigPDA(SystemProgram.programId),
            withdrawal,
            ...accounts,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ preflightCommitment: 'confirmed' }),
        withdrawal.toBase58()
      );
    }

    const mint = new PublicKey(tokenAddr);
    const vaultTokenAccount = getATA(mint, vaultAuthority, true);
    const hostTokenAccount = getATA(mint, signer, false);
    const feeCollectorTokenAccount = getATA(mint, feeCollector, false);

    return callContractWrapper(
      prog.methods
        .withdraw(new BN(amount.toString()))
        .accounts({
          host: signer,
          userRecord: userRecordPDA(signer),
          payable: payableKey,
          vaultAuthority,
          vaultTokenAccount,
          hostTokenAccount,
          feeCollectorTokenAccount,
          feeCollector,
          tokenMint: mint,
          config: configPDA(),
          tokenConfig: tokenConfigPDA(mint),
          withdrawal,
          ...accounts,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ preflightCommitment: 'confirmed' }),
      withdrawal.toBase58()
    );
  };

  /** Fetch any program account by Anchor account name and public key. */
  const fetchEntity = async (entity: string, id: string): Promise<any> =>
    await (program().account as Record<string, any>)[entity].fetch(new PublicKey(id));

  /** Same as fetchEntity but returns null instead of throwing. */
  const tryFetchEntity = async (entity: string, id: string, ignoreErrors = false): Promise<any> => {
    try {
      return await (program().account as Record<string, any>)[entity].fetch(new PublicKey(id));
    } catch (e) {
      if (!ignoreErrors) {
        console.error(e);
        toastError(`${e}`);
      }
      return null;
    }
  };

  /** Current user record (null if not initialized). */
  const getCurrentUser = async (): Promise<User | null> => {
    if (!anchorWallet.value) return null;
    const wallet = anchorWallet.value.publicKey.toBase58();
    const pdaAddr = userRecordPDA(anchorWallet.value.publicKey).toBase58();
    try {
      return new User(solanadevnet, wallet, await fetchEntity('userRecord', pdaAddr));
    } catch (_) {
      return new User(solanadevnet, wallet, null);
    }
  };

  /** ID of the nth payable created by the connected wallet (1-based). */
  const getUserPayableId = async (count: number): Promise<string | null> => {
    if (!anchorWallet.value) return null;
    const userRec = await tryFetchEntity('userRecord', userRecordPDA(anchorWallet.value.publicKey).toBase58(), true);
    if (!userRec) return null;
    return payablePDA(anchorWallet.value.publicKey, BigInt(count) - 1n).toBase58();
  };

  /** ID of the nth payment made by the connected wallet (1-based). */
  const getUserPaymentId = async (count: number): Promise<string | null> => {
    if (!anchorWallet.value) return null;
    return userPaymentPDA(anchorWallet.value.publicKey, BigInt(count) - 1n).toBase58();
  };

  /** ID of the nth payment received by a payable (1-based). */
  const getPayablePaymentId = (payableId: string, count: number): string =>
    payablePaymentPDA(new PublicKey(payableId), BigInt(count) - 1n).toBase58();

  /** Sign an arbitrary message with the connected wallet. */
  const sign = async (message: string): Promise<string | null> => {
    if (!solanaWallet.connected.value) {
      toastError('Connect Solana Wallet First!');
      return null;
    }
    return bs58.encode(await solanaWallet.signMessage.value!(new TextEncoder().encode(message)));
  };

  // ── Internal helpers ─────────────────────────────────────────────────────────

  const _ataExists = async (ata: PublicKey): Promise<boolean> => {
    try {
      return !!(await getAccount(connection, ata));
    } catch (_) {
      return false;
    }
  };

  /** Build the shared activity accounts for payable-mutating instructions. */
  const _activityAccounts = (
    signer: PublicKey,
    payableKey: PublicKey,
    statsData: any,
    userRecData: any,
    payableData: any
  ) => {
    const totalActivities = BigInt((statsData as any).totalActivities.toString());
    const userActivities = BigInt((userRecData as any).activitiesCount.toString());
    const payableActivities = BigInt((payableData as any).activitiesCount.toString());
    return {
      stats: statsPDA(),
      activityRecord: activityRecordPDA(totalActivities),
      userActivityPointer: userActivityPointerPDA(signer, userActivities),
      payableActivityPointer: payableActivityPointerPDA(payableKey, payableActivities),
    };
  };

  /** Shared logic for close/reopen payable. */
  const _payableAction = async (method: string, payableId: string): Promise<OnChainSuccess | null> => {
    const signer = anchorWallet.value!.publicKey;
    const prog = program();
    const payableKey = new PublicKey(payableId);

    const [statsData, userRecData, payableData] = await Promise.all([
      acct(prog)['stats'].fetch(statsPDA()),
      acct(prog)['userRecord'].fetch(userRecordPDA(signer)),
      acct(prog)['payable'].fetch(payableKey),
    ]);
    const accounts = _activityAccounts(signer, payableKey, statsData, userRecData, payableData);

    return callContractWrapper(
      (prog.methods as any)
        [method]()
        .accounts({
          host: signer,
          userRecord: userRecordPDA(signer),
          payable: payableKey,
          ...accounts,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ preflightCommitment: 'confirmed' }),
      payableId
    );
  };

  const toastError = (detail: string) => toast.add({ severity: 'error', summary: 'Error', detail, life: 12000 });

  return {
    balance,
    closePayable,
    createPayable,
    fetchEntity,
    getCurrentUser,
    getPayablePaymentId,
    getUserPayableId,
    getUserPaymentId,
    pay,
    payForeignViaCctp,
    program,
    reopenPayable,
    sign,
    tryFetchEntity,
    updatePayableATAA,
    withdraw,
  };
});
