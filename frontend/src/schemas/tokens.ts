// schemas/tokens.ts
//
// Defines the tokens Chainbills knows about, the per-chain contract address
// of the Chainbills proxy, and `TokenAndAmount`: the value class that pairs
// a token with a raw on-chain integer amount. Every amount in the app flows
// through this file so that decimal math never touches a floating-point
// JavaScript `number` — all amounts are `bigint` and are formatted for
// display (or parsed from user input) with viem's `formatUnits`/`parseUnits`.
//
// Used by: every store that reads or writes a payable/payment/withdrawal
// amount (`stores/evm.ts`, `stores/payable.ts`, `stores/payment.ts`,
// `stores/withdrawal.ts`, `stores/activity.ts`), and every view that lets a
// user type in or review an amount (`CreatePayableView`, `PayView`,
// `PayableDetailView`).
import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { formatUnits, parseUnits } from 'viem';
import { type Chain, type ChainName } from './chain';

/** Builds the local asset path for a token's logo, on a given chain. */
export const getTokenLogo = (chain: Chain, token: Token) => {
  let logo = token.name;
  // MegaETH's native token is ETH, but it is branded with the chain's own logo.
  if (chain.name == 'megaeth' && token.name == 'ETH') logo = 'MegaETH';
  return `/assets/tokens/${logo}.png`;
};

/** The Chainbills proxy contract address on each chain. Native tokens use this as their "token address". */
export const contracts: Record<ChainName, string> = {
  arctestnet: '0x3E473E5812542A865086Cb5Cb80D8f3DD3D692A7',
  megaeth: '0xc38d1681d34DA821E46508C084D673477E455570',
  basesepolia: '0x3E473E5812542A865086Cb5Cb80D8f3DD3D692A7',
  solanadevnet: 'DWhfdyzTiD2Jpkh3FhS2PreTSraqh3jWGfiTAoFG5wNk',
};

/** A token's address and decimal count on one specific chain. */
export interface TokenChainDetails {
  address: string;
  decimals: number;
}

/** A token Chainbills supports, with its address/decimals on every chain it exists on. */
export interface Token {
  name: string;
  details: { [key in ChainName]?: TokenChainDetails };
}

/** Looks up the known `Token` whose address on `chain` matches `token`. Throws if none is found. */
export const getTokenDetails = (token: string | PublicKey, chain: Chain) => {
  let found: Token | undefined;

  if (chain.isEvm) {
    found = tokens.find((t) => t.details[chain.name]?.address == `${token}`);
  } else if (chain.isSolana) {
    if ((token as any) instanceof PublicKey) {
      token = (token as unknown as PublicKey).toBase58();
    }
    found = tokens.find((t) => t.details.solanadevnet?.address == token);
  } else throw `Unknown Chain: ${chain}`;

  if (!found) throw `Couldn't find token details for ${token}`;
  return found;
};

/** The on-chain shape of a (token, amount) pair, as accepted/returned by contract calls. */
export interface TokenAndAmountOnChain {
  token: string | PublicKey;
  amount: bigint | BN | number | string;
}

/**
 * Formats a raw on-chain integer amount as a human-readable decimal string,
 * e.g. `formatTokenAmount(1_500_000n, 6)` → `"1.5"`. Never loses precision:
 * unlike `Number(amount) / 10 ** decimals`, this stays exact for amounts
 * bigger than `Number.MAX_SAFE_INTEGER`.
 */
export const formatTokenAmount = (amount: bigint, decimals: number): string => formatUnits(amount, decimals);

/**
 * Parses a human-typed decimal string (or number) into the raw on-chain
 * integer amount for a token with `decimals` decimal places. This is the
 * inverse of `formatTokenAmount` and is how every UI amount input becomes
 * the `bigint` a contract call expects.
 */
export const parseTokenAmount = (value: string | number, decimals: number): bigint => parseUnits(`${value}`, decimals);

/**
 * Rounds a raw on-chain amount to `precision` decimal digits and returns it
 * as a `number`, purely for compact UI display (for example "12.34567" next
 * to a wallet icon). This is a display-only convenience: the precision loss
 * it introduces must never feed back into a comparison or a transaction —
 * those must keep using the `bigint` amount directly.
 */
export const roundedTokenAmount = (amount: bigint, decimals: number, precision = 5): number => {
  const asNumber = Number(formatTokenAmount(amount, decimals));
  return Math.trunc(asNumber * 10 ** precision) / 10 ** precision;
};

/** Pairs a `Token` with a raw on-chain integer `amount` (always a `bigint`, never a floating-point number). */
export class TokenAndAmount {
  name: string;
  details: { [key in ChainName]?: TokenChainDetails };
  amount: bigint;

  constructor(token: Token, amount: bigint) {
    this.name = token.name;
    this.details = token.details;
    this.amount = amount;
  }

  /** Builds a `TokenAndAmount` from a contract's raw `{token, amount}` tuple on a given chain. */
  static fromOnChain({ token, amount }: TokenAndAmountOnChain, chain: Chain) {
    return new TokenAndAmount(getTokenDetails(token, chain), BigInt(amount as any));
  }

  /** Builds a `TokenAndAmount` from a human-typed decimal amount (e.g. from a form input) for a given chain. */
  static parse(token: Token, humanAmount: string | number, chain: Chain): TokenAndAmount {
    return new TokenAndAmount(token, parseTokenAmount(humanAmount, token.details[chain.name]?.decimals ?? 0));
  }

  /** Human-readable "amount name", e.g. "1.5 USDC", formatted using `chain`'s decimals for this token. */
  display(chain: Chain) {
    return this.format(chain) + ' ' + this.name;
  }

  /** Human-readable decimal amount only (no token name), e.g. "1.5". */
  format(chain: Chain) {
    return formatTokenAmount(this.amount, this.details[chain.name]?.decimals ?? 0);
  }

  /** Strips the amount off, returning just the `Token` (name + per-chain details). */
  token(): Token {
    return {
      name: this.name,
      details: this.details,
    };
  }

  /** Converts back to the on-chain tuple shape a contract call expects on `chain`. */
  toOnChain(chain: Chain): TokenAndAmountOnChain {
    let token: any = this.details[chain.name]?.address ?? '';
    if (!!token && chain.isSolana) token = new PublicKey(token);
    let amount: any = this.amount;
    if (chain.isSolana) amount = new BN(this.amount.toString());
    return { token, amount };
  }
}

/** Every token Chainbills knows about, with its address and decimals per chain. */
export const tokens: Token[] = [
  {
    name: 'USDC',
    details: {
      arctestnet: {
        // Arc exposes USDC as both a native gas token (18 dp) and an ERC-20 (6 dp)
        // at 0x3600...0000. Chainbills always uses the ERC-20 interface so
        // decimals stay 6 across every chain and `pay()` goes through the
        // standard ERC-20 transferFrom path (this address is what the on-chain
        // deploy registers as USDC_ADDRESS for Arc Testnet — see evm/DEPLOYED.md).
        address: '0x3600000000000000000000000000000000000000',
        decimals: 6,
      },
      basesepolia: {
        address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        decimals: 6,
      },
      solanadevnet: {
        address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        decimals: 6,
      },
    },
  },
  {
    name: 'ETH',
    details: {
      megaeth: {
        address: contracts.megaeth,
        decimals: 18,
      },
      // basesepolia native ETH not yet allowed on the contract — add NATIVE to
      // evm/script/env/tokens.json and run AllowPaymentsForToken to enable it
    },
  },
  {
    name: 'SOL',
    details: {
      solanadevnet: {
        address: contracts.solanadevnet,
        decimals: 9,
      },
    },
  },
];
