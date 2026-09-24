// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Amount formatting
//
// Raw on-chain amounts are uint256 integers, stored as `Decimal @db.Decimal(78, 0)`
// (SPEC.md §7) and surfaced as strings everywhere (SPEC.md §12.1) — never a
// JS `number`, which loses precision above 2^53 and cannot represent typical
// 18-decimal token amounts safely. This module does the raw-integer-string +
// decimals -> human decimal-string conversion with plain string arithmetic,
// so it is exact for amounts of any size.
// ──────────────────────────────────────────────────────────────────────────────

const INTEGER_STRING = /^-?\d+$/;

/**
 * Formats a raw integer amount string (e.g. `"1500000"`) with `decimals`
 * (e.g. `6`) into a human decimal string (e.g. `"1.5"`), trimming trailing
 * fractional zeros and never using floating point. Accepts a leading `-` for
 * amounts that may legitimately be negative in a caller's context (none in
 * this phase, but the helper stays general).
 *
 * Throws on a malformed `raw` string rather than silently returning `"0"`,
 * since a bad raw amount almost always signals a bug upstream (e.g. a
 * `number` that already lost precision before reaching here).
 */
export function formatAmount(raw: string, decimals: number): string {
  if (!INTEGER_STRING.test(raw)) {
    throw new Error(`formatAmount: not an integer string: ${raw}`);
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`formatAmount: decimals must be a non-negative integer: ${decimals}`);
  }

  const negative = raw.startsWith('-');
  const digits = negative ? raw.slice(1) : raw;

  if (decimals === 0) {
    const value = stripLeadingZeros(digits);
    return negative && value !== '0' ? `-${value}` : value;
  }

  const padded = digits.padStart(decimals + 1, '0');
  const integerPart = stripLeadingZeros(padded.slice(0, padded.length - decimals));
  const fractionPart = padded.slice(padded.length - decimals).replace(/0+$/, '');

  const magnitude = fractionPart.length > 0 ? `${integerPart}.${fractionPart}` : integerPart;
  const isZero = integerPart === '0' && fractionPart.length === 0;
  return negative && !isZero ? `-${magnitude}` : magnitude;
}

function stripLeadingZeros(digits: string): string {
  const stripped = digits.replace(/^0+/, '');
  return stripped.length > 0 ? stripped : '0';
}
