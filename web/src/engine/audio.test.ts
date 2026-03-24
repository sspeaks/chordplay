import { describe, it, expect } from 'vitest';
import { envelope, HARMONICS, SAMPLE_RATE } from './audio';

describe('envelope', () => {
  it('starts at 0', () => {
    expect(envelope(1.0, 0)).toBeCloseTo(0, 5);
  });
  it('reaches ~1.0 at end of attack (20ms)', () => {
    expect(envelope(1.0, 0.020)).toBeCloseTo(1.0, 1);
  });
  it('settles to sustain level (0.7) after decay', () => {
    expect(envelope(1.0, 0.150)).toBeCloseTo(0.7, 1);
  });
  it('sustains at 0.7 in middle', () => {
    expect(envelope(1.0, 0.5)).toBeCloseTo(0.7, 1);
  });
  it('reaches 0 at end of release', () => {
    expect(envelope(1.0, 1.0)).toBeCloseTo(0.0, 5);
  });
  it('is 0 after duration', () => {
    expect(envelope(1.0, 1.1)).toBe(0.0);
  });
});

describe('constants', () => {
  it('sample rate is 44100', () => {
    expect(SAMPLE_RATE).toBe(44100);
  });
  it('has 8 harmonics', () => {
    expect(HARMONICS).toHaveLength(8);
  });
  it('fundamental has amplitude 1.0', () => {
    expect(HARMONICS[0]).toEqual([1, 1.0]);
  });
  it('H7 is boosted to 0.18 for septimal 7th', () => {
    expect(HARMONICS[6]).toEqual([7, 0.18]);
  });
});