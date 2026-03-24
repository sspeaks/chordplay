import { describe, it, expect } from 'vitest';
import { encodeUrlState, decodeUrlState, DEFAULTS, AppState } from './urlState';

describe('urlState', () => {
  it('round-trips full state', () => {
    const state: AppState = {
      ...DEFAULTS,
      chordText: 'Am F C G',
      tuning: 'just',
      tempo: 1.5,
    };
    const hash = encodeUrlState(state);
    const decoded = decodeUrlState(hash);
    expect(decoded.chordText).toBe('Am F C G');
    expect(decoded.tuning).toBe('just');
    expect(decoded.tempo).toBe(1.5);
  });

  it('all-defaults produces empty hash', () => {
    expect(encodeUrlState(DEFAULTS)).toBe('');
  });

  it('only encodes non-default values', () => {
    const state = { ...DEFAULTS, tuning: 'just' as const };
    const hash = encodeUrlState(state);
    const decoded = decodeUrlState(hash);
    expect(decoded.tuning).toBe('just');
    expect(decoded.chordText).toBeUndefined();
  });

  it('corrupted input returns empty object', () => {
    expect(decodeUrlState('#garbage!!!')).toEqual({});
  });

  it('empty hash returns empty object', () => {
    expect(decodeUrlState('')).toEqual({});
    expect(decodeUrlState('#')).toEqual({});
  });

  it('round-trips selectedKey', () => {
    const state = { ...DEFAULTS, selectedKey: { root: 'A' as const, quality: 'minor' as const } };
    const hash = encodeUrlState(state);
    const decoded = decodeUrlState(hash);
    expect(decoded.selectedKey).toEqual({ root: 'A', quality: 'minor' });
  });
});