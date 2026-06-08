import { describe, it, expect } from 'vitest';
import { inflateSync } from 'fflate';
import { encodeUrlState, decodeUrlState, DEFAULTS, AppState } from './urlState';

function decodeRawUrlState(hash: string): Record<string, unknown> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const padded = raw.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(inflateSync(bytes)));
}

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

  it('uses organ as the omitted default sound mode', () => {
    expect(DEFAULTS.soundMode).toBe('organ');
    expect({ ...DEFAULTS, ...decodeUrlState('') }.soundMode).toBe('organ');
    expect(encodeUrlState({ ...DEFAULTS, soundMode: 'organ' })).toBe('');
  });

  it('only encodes non-default values', () => {
    const state = { ...DEFAULTS, tuning: 'just' as const };
    const hash = encodeUrlState(state);
    const decoded = decodeUrlState(hash);
    expect(decoded.tuning).toBe('just');
    expect(decoded.chordText).toBeUndefined();
    expect(decoded.soundMode).toBeUndefined();
    expect(decodeRawUrlState(hash)).not.toHaveProperty('m');
  });

  it('round-trips human sound mode using the compact m key', () => {
    const state = { ...DEFAULTS, soundMode: 'human' as const };
    const hash = encodeUrlState(state);
    const decoded = decodeUrlState(hash);

    expect(decoded.soundMode).toBe('human');
    expect(decodeRawUrlState(hash)).toEqual({ m: 'human' });
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
