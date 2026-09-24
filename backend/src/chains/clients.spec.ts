// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Chain client factory tests
//
// These factories only assemble client objects (no network I/O happens at
// construction time for viem's http transport or web3.js's Connection), so
// they are tested directly with real inputs rather than mocked.
// ──────────────────────────────────────────────────────────────────────────────

import { Keypair } from '@solana/web3.js';
import { sepolia as viemSepolia } from 'viem/chains';
import {
  createEvmPublicClient,
  createEvmWalletClient,
  createSolanaConnection,
  evmAccountFromPrivateKey,
  solanaKeypairFromSecretKey,
} from './clients';
import { sepolia } from './registry';

const RPC_URL = 'https://sepolia.example.com';
const PRIVATE_KEY = `0x${'1'.repeat(64)}` as const;

describe('createEvmPublicClient', () => {
  it('builds a viem public client bound to the given chain and RPC URL', () => {
    const client = createEvmPublicClient(sepolia, RPC_URL);
    expect(client.chain).toBe(viemSepolia);
    expect(client.transport.url).toBe(RPC_URL);
  });
});

describe('evmAccountFromPrivateKey', () => {
  it('derives a viem account with a checksummed address from a private key', () => {
    const account = evmAccountFromPrivateKey(PRIVATE_KEY);
    expect(account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(account.type).toBe('local');
  });
});

describe('createEvmWalletClient', () => {
  it('builds a viem wallet client bound to the chain, RPC URL and account', () => {
    const account = evmAccountFromPrivateKey(PRIVATE_KEY);
    const client = createEvmWalletClient(sepolia, RPC_URL, account);
    expect(client.chain).toBe(viemSepolia);
    expect(client.account).toBe(account);
    expect(client.transport.url).toBe(RPC_URL);
  });
});

describe('createSolanaConnection', () => {
  it('defaults to "confirmed" commitment', () => {
    const connection = createSolanaConnection('https://solana-devnet.example.com');
    expect(connection.commitment).toBe('confirmed');
    expect(connection.rpcEndpoint).toBe('https://solana-devnet.example.com');
  });

  it('honours an explicit commitment', () => {
    const connection = createSolanaConnection('https://solana-devnet.example.com', 'finalized');
    expect(connection.commitment).toBe('finalized');
  });
});

describe('solanaKeypairFromSecretKey', () => {
  it('builds a Keypair from a 64-byte secret key array', () => {
    const source = Keypair.generate();
    const rebuilt = solanaKeypairFromSecretKey(Array.from(source.secretKey));
    expect(rebuilt.publicKey.toBase58()).toBe(source.publicKey.toBase58());
  });
});
