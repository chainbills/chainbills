import { testnetChainInfo } from '@burnt-labs/constants';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { verifyADR36Amino } from '@keplr-wallet/cosmos';
import fetch from 'node-fetch';

const XION_CONTRACT_ADDRESS =
  'xion1cena9wnyd2wudh5g7zrx2wwtr46wl2g3ahaargzt3gypufqd8s5sp6xpu3';

const recursiveToCamel = (item: unknown): unknown => {
  if (Array.isArray(item)) {
    return item.map((el: unknown) => recursiveToCamel(el));
  } else if (typeof item === 'function' || item !== Object(item)) {
    return item;
  }
  return Object.fromEntries(
    Object.entries(item as Record<string, unknown>).map(
      ([key, value]: [string, unknown]) => [
        key.replace(/([-_][a-z])/gi, (c) =>
          c.toUpperCase().replace(/[-_]/g, '')
        ),
        recursiveToCamel(value)
      ]
    )
  );
};

export const cosmwasmFetch = async (entity: string, id: string) => {
  return recursiveToCamel(
    await (
      await CosmWasmClient.connect('https://rpc.xion-testnet-1.burnt.com:443')
    ).queryContractSmart(XION_CONTRACT_ADDRESS, { [entity]: { msg: { id } } })
  );
};

const verifyGrants = async (
  granter: string,
  grantee: string
): Promise<boolean> => {
  try {
    const url =
      `${testnetChainInfo.rest}/cosmos/authz/v1beta1/grants` +
      `?granter=${granter}&grantee=${grantee}`;
    const data = await (await fetch(url, { cache: 'no-store' } as any)).json();
    return data && data.grants.length > 0;
  } catch (e) {
    console.error('Error at verifying grants ... ');
    console.error(e);
    return false;
  }
};

export const cosmwasmVerify = async (
  message: string,
  signature: any,
  address: any,
  grantee: any,
  pubkey: any
) => {
  const isValid = verifyADR36Amino(
    'xion',
    grantee,
    message,
    new Uint8Array(Buffer.from(pubkey, 'base64')),
    new Uint8Array(Buffer.from(signature, 'base64'))
  );
  if (!isValid) return false;
  return await verifyGrants(address, grantee);
};
