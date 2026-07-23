import { describe, it, expect } from 'vitest';
import {
  CENTS_NEAR_PURE_THRESHOLD,
  CENTS_LARGE_THRESHOLD,
  centsDeviationClass,
} from './centsClassification';

describe('centsDeviationClass', () => {
  it('returns cents-near-pure for exactly 0¢', () => {
    expect(centsDeviationClass(0)).toBe('cents-near-pure');
  });

  it('returns cents-near-pure at the near-pure threshold boundary', () => {
    expect(centsDeviationClass(CENTS_NEAR_PURE_THRESHOLD)).toBe('cents-near-pure');
    expect(centsDeviationClass(-CENTS_NEAR_PURE_THRESHOLD)).toBe('cents-near-pure');
  });

  it('returns cents-moderate just above the near-pure threshold', () => {
    expect(centsDeviationClass(2.1)).toBe('cents-moderate');
    expect(centsDeviationClass(-2.1)).toBe('cents-moderate');
  });

  it('returns cents-moderate at the large threshold boundary', () => {
    expect(centsDeviationClass(CENTS_LARGE_THRESHOLD)).toBe('cents-moderate');
    expect(centsDeviationClass(-CENTS_LARGE_THRESHOLD)).toBe('cents-moderate');
  });

  it('returns cents-large just above the large threshold', () => {
    expect(centsDeviationClass(8.1)).toBe('cents-large');
    expect(centsDeviationClass(-8.1)).toBe('cents-large');
  });

  it('returns cents-large for typical major third deviation (~13.7¢)', () => {
    // Just major third (5:4) vs equal temperament is ~13.69¢ flat
    expect(centsDeviationClass(-13.69)).toBe('cents-large');
  });

  it('returns cents-near-pure for typical perfect fifth deviation (~1.96¢)', () => {
    // Just fifth (3:2) vs equal temperament is ~1.96¢ sharp
    expect(centsDeviationClass(1.96)).toBe('cents-near-pure');
  });
});
