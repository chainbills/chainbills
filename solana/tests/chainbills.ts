import * as anchor from '@coral-xyz/anchor';
import { Program, web3 } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { Chainbills } from '../target/types/chainbills';
export const PROGRAM_ID = '381yy2z6SFe7prqkF55WWnerFE19w6Fb5AfxcYhm2R78';

describe('chainbills', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Chainbills as Program<Chainbills>;
  const globalStats = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    new PublicKey(PROGRAM_ID)
  )[0];
  const systemProgram = new PublicKey(web3.SystemProgram.programId);
  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.methods
      .initializeGlobalStats()
      .accounts({
        globalStats,
        thisProgramData: 'G9oohY5eggJg1VHofjKhQMPhxPECEPFHqS78BtpzaFqR',
        thisProgram: PROGRAM_ID,
        systemProgram
      })
      .rpc();
    console.log('Your transaction signature', tx);
  });
});
