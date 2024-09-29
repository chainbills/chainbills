import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';

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
