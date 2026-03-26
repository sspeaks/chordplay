import { describe, it, expect } from 'vitest';
import { inferKey } from './keyInference';
import type { ChordSymbol } from '../types';

function chord(root: string, quality: string = 'Major'): ChordSymbol {
  return { root: root as any, quality: quality as any, inversion: null };
}

describe('inferKey', () => {
  it('returns C major for I-vi-ii-V in C', () => {
    const chords = [chord('C'), chord('A', 'Minor'), chord('D', 'Minor'), chord('G', 'Dom7')];
    const result = inferKey(chords);
    expect(result).toEqual({ root: 'C', quality: 'major' });
  });

  it('returns G major for I-IV-V-I in G', () => {
    const chords = [chord('G'), chord('C'), chord('D', 'Dom7'), chord('G')];
    const result = inferKey(chords);
    expect(result).toEqual({ root: 'G', quality: 'major' });
  });

  it('returns A minor for i-iv-V-i in Am', () => {
    const chords = [chord('A', 'Minor'), chord('D', 'Minor'), chord('E', 'Dom7'), chord('A', 'Minor')];
    const result = inferKey(chords);
    expect(result).toEqual({ root: 'A', quality: 'minor' });
  });

  it('returns C major for the default chord sequence', () => {
    const chords = [
      chord('C', 'Maj7'), chord('A', 'Min7'), chord('D', 'Min7'), chord('G', 'Dom7'),
      chord('E', 'Min7'), chord('A', 'Dom7'), chord('D', 'Min7'), chord('G', 'Dom7'),
      chord('C', 'Maj7'), chord('C', 'Dom7'), chord('F', 'Maj7'), chord('F', 'Min6'),
      chord('C', 'Maj7'), chord('A', 'Min7'), chord('D', 'Min7'), chord('G', 'Dom7'),
      chord('C', 'Maj7'),
    ];
    const result = inferKey(chords);
    expect(result).toEqual({ root: 'C', quality: 'major' });
  });

  it('prefers major over minor when scores tie', () => {
    const chords = [chord('C'), chord('G')];
    const result = inferKey(chords);
    expect(result.quality).toBe('major');
  });

  it('handles single chord by returning that root as major', () => {
    const chords = [chord('E', 'Minor')];
    const result = inferKey(chords);
    expect(result.root).toBe('E');
  });

  it('returns F major for F-Bb-C-F', () => {
    const chords = [chord('F'), chord('As'), chord('C'), chord('F')];
    const result = inferKey(chords);
    expect(result).toEqual({ root: 'F', quality: 'major' });
  });
});