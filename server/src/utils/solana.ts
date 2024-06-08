import { Program } from '@project-serum/anchor';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { SOLANA_CLUSTER } from './chain';
import { IDL, type Chainbills } from './idl';

export const PROGRAM_ID = 'p7Lu1yPzMRYLfLxWbEePx8kn3LNevFTbGVC5ghyADF9';

export const program = new Program<Chainbills>(IDL, PROGRAM_ID, {
  connection: new Connection(clusterApiUrl(SOLANA_CLUSTER))
});
