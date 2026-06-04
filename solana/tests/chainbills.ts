/**
 * Chainbills Solana — integration tests.
 *
 * Test runner: anchor test (uses Anchor workspace + local validator).
 * Assertions: Jest (not chai — chai is not in devDependencies).
 */

import { AnchorProvider, Program, setProvider, workspace } from '@coral-xyz/anchor';
import { SendTransactionError } from '@solana/web3.js';
import { Chainbills } from '../target/types/chainbills';
import { config, senderAuthority, stats } from './accounts';

describe('Chainbills', () => {
  setProvider(AnchorProvider.env());
  const program = workspace.Chainbills as Program<Chainbills>;

  describe('initialize', () => {
    it('creates Config with correct owner and fee_bps', async () => {
      await program.methods.initialize().rpc();

      const fetched = await program.account.config.fetch(config);
      expect(fetched.owner.toString()).toBe(AnchorProvider.env().wallet.publicKey.toString());
      expect(fetched.feeBps).toBe(200);
      expect(fetched.hasWormhole).toBe(true);
      expect(fetched.hasCctp).toBe(true);
    });

    it('creates Stats with all counters at zero', async () => {
      const fetched = await program.account.stats.fetch(stats);
      expect(fetched.totalUsers.toNumber()).toBe(0);
      expect(fetched.totalPayables.toNumber()).toBe(0);
      expect(fetched.totalActivities.toNumber()).toBe(0);
    });

    it('creates SenderAuthority PDA', async () => {
      const info = await AnchorProvider.env().connection.getAccountInfo(senderAuthority);
      expect(info).not.toBeNull();
    });

    it(`can't be initialized twice`, async () => {
      await expect(program.methods.initialize().rpc()).rejects.toBeInstanceOf(SendTransactionError);
    });
  });
});
