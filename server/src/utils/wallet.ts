import { Cluster, PublicKey } from '@solana/web3.js';
import { encoding } from '@wormhole-foundation/sdk-base';
import { Chain, WH_CHAIN_ID_ETH_SEPOLIA, WH_CHAIN_ID_SOLANA } from './chain';
import { program } from './solana';

export const canonical = (bytes: Uint8Array, chain: Chain) => {
  if (chain == 'Solana') return encoding.b58.encode(Uint8Array.from(bytes));
  return (
    '0x' + encoding.hex.encode(Uint8Array.from(bytes), false).replace(/^0+/, '')
  );
};

export const owner = async (
  address: string,
  cluster: Cluster
): { chain: Chain; ownerWallet: string } => {
  const { chainId, ownerWallet: walletBytes } = await program(
    cluster
  ).account.user.fetch(new PublicKey(address));

  let chain: Chain;
  if (chainId == WH_CHAIN_ID_SOLANA) chain = 'Solana';
  else if (chainId == WH_CHAIN_ID_ETH_SEPOLIA) chain = 'Ethereum Sepolia';
  else throw `Unknown chainId: ${chainId}`;

  const ownerWallet = canonical(walletBytes, chain);
  return { chain, ownerWallet };
};
