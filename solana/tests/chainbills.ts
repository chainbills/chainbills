import {
  AnchorProvider,
  Program,
  setProvider,
  workspace
} from '@coral-xyz/anchor';
import { SendTransactionError } from '@solana/web3.js';
import { assert, expect } from 'chai';
import { Chainbills } from '../target/types/chainbills';
import { initializeAccs } from './accounts';

describe('Chainbills', () => {
  setProvider(AnchorProvider.env());
  const program = workspace.Chainbills as Program<Chainbills>;

  describe('initialize', () => {
    it('sets owner in config', async () => {
      await program.methods.initialize().accounts(initializeAccs).rpc();
      const fetched = await program.account.config.fetch(initializeAccs.config);
      expect(fetched.owner).to.eql(initializeAccs.owner);
    });

    it(`can't be initialized twice`, async () => {
      try {
        await program.methods.initialize().accounts(initializeAccs).rpc();
        assert(false, `didn't fail`); // ensure an error is thrown
      } catch (err) {
        expect(err).to.be.instanceOf(SendTransactionError);
      }
    });
  });
});
