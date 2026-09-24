// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Amount formatting tests
// ──────────────────────────────────────────────────────────────────────────────

import { formatAmount } from './format-amount';

describe('formatAmount', () => {
  it('formats a whole-unit amount', () => {
    expect(formatAmount('1000000', 6)).toBe('1');
  });

  it('formats a fractional amount, trimming trailing zeros', () => {
    expect(formatAmount('1500000', 6)).toBe('1.5');
  });

  it('formats an amount smaller than one unit', () => {
    expect(formatAmount('1', 6)).toBe('0.000001');
  });

  it('formats zero', () => {
    expect(formatAmount('0', 6)).toBe('0');
    expect(formatAmount('0', 0)).toBe('0');
  });

  it('formats with 0 decimals unchanged', () => {
    expect(formatAmount('123', 0)).toBe('123');
  });

  it('formats a negative integer with 0 decimals', () => {
    expect(formatAmount('-123', 0)).toBe('-123');
  });

  it('strips leading zeros from the raw integer', () => {
    expect(formatAmount('007', 0)).toBe('7');
    expect(formatAmount('000000', 6)).toBe('0');
  });

  it('handles 18-decimal amounts exactly (no floating point drift)', () => {
    // 1.000000000000000001 ETH in wei — a value `Number` cannot represent exactly.
    expect(formatAmount('1000000000000000001', 18)).toBe('1.000000000000000001');
  });

  it('handles very large amounts exactly (beyond Number.MAX_SAFE_INTEGER)', () => {
    expect(formatAmount('123456789012345678901234567890', 18)).toBe('123456789012.34567890123456789');
  });

  it('formats a negative amount', () => {
    expect(formatAmount('-1500000', 6)).toBe('-1.5');
  });

  it('never renders "-0" for a negative amount that rounds to zero magnitude', () => {
    expect(formatAmount('-0', 6)).toBe('0');
  });

  it('throws on a non-integer string', () => {
    expect(() => formatAmount('1.5', 6)).toThrow(/not an integer string/);
    expect(() => formatAmount('abc', 6)).toThrow(/not an integer string/);
    expect(() => formatAmount('', 6)).toThrow(/not an integer string/);
  });

  it('throws on invalid decimals', () => {
    expect(() => formatAmount('100', -1)).toThrow(/decimals must be a non-negative integer/);
    expect(() => formatAmount('100', 1.5)).toThrow(/decimals must be a non-negative integer/);
  });
});
