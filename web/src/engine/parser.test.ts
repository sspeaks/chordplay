import { describe, it, expect } from 'vitest';
import { parseChord, parseChordSequence, tokenizeChordInput } from './parser';
import type { ChordSymbol } from '../types';

function expectChord(input: string, expected: ChordSymbol) {
  const result = parseChord(input);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value).toEqual(expected);
  }
}

function expectFail(input: string) {
  const result = parseChord(input);
  expect(result.ok).toBe(false);
}

describe('parseChord', () => {
  it('C → C Major', () => {
    expectChord('C', { root: 'C', quality: 'Major', inversion: null });
  });
  it('Am → A Minor', () => {
    expectChord('Am', { root: 'A', quality: 'Minor', inversion: null });
  });
  it('Bb7 → Bb Dom7', () => {
    expectChord('Bb7', { root: 'As', quality: 'Dom7', inversion: null });
  });
  it('F#m7 → F# Min7', () => {
    expectChord('F#m7', { root: 'Fs', quality: 'Min7', inversion: null });
  });
  it('Ebmaj7 → Eb Maj7', () => {
    expectChord('Ebmaj7', { root: 'Ds', quality: 'Maj7', inversion: null });
  });
  it('Gdim7 → G Dim7', () => {
    expectChord('Gdim7', { root: 'G', quality: 'Dim7', inversion: null });
  });
  it('C+ → C Aug', () => {
    expectChord('C+', { root: 'C', quality: 'Aug', inversion: null });
  });
  it('Caug → C Aug', () => {
    expectChord('Caug', { root: 'C', quality: 'Aug', inversion: null });
  });
  it('Cm7b5 → C HalfDim7', () => {
    expectChord('Cm7b5', { root: 'C', quality: 'HalfDim7', inversion: null });
  });
  it('Csus4 → C Sus4', () => {
    expectChord('Csus4', { root: 'C', quality: 'Sus4', inversion: null });
  });
  it('CmMaj7 → C MinMaj7', () => {
    expectChord('CmMaj7', { root: 'C', quality: 'MinMaj7', inversion: null });
  });
  it('C6 → C Maj6', () => {
    expectChord('C6', { root: 'C', quality: 'Maj6', inversion: null });
  });
  it('Cm6 → C Min6', () => {
    expectChord('Cm6', { root: 'C', quality: 'Min6', inversion: null });
  });
  // 9th chords: bare 9 is invalid (5 notes), must specify omission
  it('A9 (bare) fails — must specify omission', () => {
    expectFail('A9');
  });
  it('Cmaj9 (bare) fails', () => {
    expectFail('Cmaj9');
  });
  it('Cm9 (bare) fails', () => {
    expectFail('Cm9');
  });

  // Dominant 9th omissions
  it('C9-1 → C Dom9no1', () => {
    expectChord('C9-1', { root: 'C', quality: 'Dom9no1', inversion: null });
  });
  it('C9-3 → C Dom9no3', () => {
    expectChord('C9-3', { root: 'C', quality: 'Dom9no3', inversion: null });
  });
  it('C9-5 → C Dom9no5', () => {
    expectChord('C9-5', { root: 'C', quality: 'Dom9no5', inversion: null });
  });
  it('C9-7 → C Dom9no7', () => {
    expectChord('C9-7', { root: 'C', quality: 'Dom9no7', inversion: null });
  });

  // Major 9th omissions
  it('Cmaj9-1 → C Maj9no1', () => {
    expectChord('Cmaj9-1', { root: 'C', quality: 'Maj9no1', inversion: null });
  });
  it('Cmaj9-3 → C Maj9no3', () => {
    expectChord('Cmaj9-3', { root: 'C', quality: 'Maj9no3', inversion: null });
  });
  it('Cmaj9-5 → C Maj9no5', () => {
    expectChord('Cmaj9-5', { root: 'C', quality: 'Maj9no5', inversion: null });
  });
  it('Cmaj9-7 → C Maj9no7', () => {
    expectChord('Cmaj9-7', { root: 'C', quality: 'Maj9no7', inversion: null });
  });

  // Minor 9th omissions
  it('Cm9-1 → C Min9no1', () => {
    expectChord('Cm9-1', { root: 'C', quality: 'Min9no1', inversion: null });
  });
  it('Cm9-3 → C Min9no3', () => {
    expectChord('Cm9-3', { root: 'C', quality: 'Min9no3', inversion: null });
  });
  it('Cm9-5 → C Min9no5', () => {
    expectChord('Cm9-5', { root: 'C', quality: 'Min9no5', inversion: null });
  });
  it('Cm9-7 → C Min9no7', () => {
    expectChord('Cm9-7', { root: 'C', quality: 'Min9no7', inversion: null });
  });

  // Aliases
  it('Cadd9 → C Dom9no7', () => {
    expectChord('Cadd9', { root: 'C', quality: 'Dom9no7', inversion: null });
  });
  it('Cmadd9 → C Min9no7', () => {
    expectChord('Cmadd9', { root: 'C', quality: 'Min9no7', inversion: null });
  });

  // 13th chords
  it('C13 → C Dom13', () => {
    expectChord('C13', { root: 'C', quality: 'Dom13', inversion: null });
  });
  it('Bb13 → Bb Dom13', () => {
    expectChord('Bb13', { root: 'As', quality: 'Dom13', inversion: null });
  });
  it('1C13 → C Dom13, inversion 1', () => {
    expectChord('1C13', { root: 'C', quality: 'Dom13', inversion: 1 });
  });

  // 9th with accidentals and inversions
  it('Bb9-5 → Bb Dom9no5', () => {
    expectChord('Bb9-5', { root: 'As', quality: 'Dom9no5', inversion: null });
  });
  it('1C9-1 → C Dom9no1, inversion 1', () => {
    expectChord('1C9-1', { root: 'C', quality: 'Dom9no1', inversion: 1 });
  });

  // Inversions
  it('1G7 → G Dom7, inversion 1', () => {
    expectChord('1G7', { root: 'G', quality: 'Dom7', inversion: 1 });
  });
  it('2Eb → Eb Major, inversion 2', () => {
    expectChord('2Eb', { root: 'Ds', quality: 'Major', inversion: 2 });
  });
  it('-1G7 → G Dom7, inversion -1', () => {
    expectChord('-1G7', { root: 'G', quality: 'Dom7', inversion: -1 });
  });
  it('0C → C Major, inversion 0', () => {
    expectChord('0C', { root: 'C', quality: 'Major', inversion: 0 });
  });

  // Errors
  it('empty string fails', () => {
    expectFail('');
  });
  it('invalid root fails', () => {
    expectFail('X7');
  });

  // Slash chords
  it('C/E → C Major, bass=E', () => {
    expectChord('C/E', { root: 'C', quality: 'Major', inversion: null, bass: 'E' });
  });
  it('Eb/C → Eb Major, bass=C', () => {
    expectChord('Eb/C', { root: 'Ds', quality: 'Major', inversion: null, bass: 'C' });
  });
  it('Am7/G → A Min7, bass=G', () => {
    expectChord('Am7/G', { root: 'A', quality: 'Min7', inversion: null, bass: 'G' });
  });
  it('C/Bb → C Major, bass=Bb', () => {
    expectChord('C/Bb', { root: 'C', quality: 'Major', inversion: null, bass: 'As' });
  });
  it('C7/Bb → C Dom7, bass=Bb', () => {
    expectChord('C7/Bb', { root: 'C', quality: 'Dom7', inversion: null, bass: 'As' });
  });
  it('C13/Bb → C Dom13, bass=Bb', () => {
    expectChord('C13/Bb', { root: 'C', quality: 'Dom13', inversion: null, bass: 'As' });
  });
  it('1C/E → slash overrides inversion, bass=E', () => {
    expectChord('1C/E', { root: 'C', quality: 'Major', inversion: null, bass: 'E' });
  });
  it('F#m7/E → F# Min7, bass=E', () => {
    expectChord('F#m7/E', { root: 'Fs', quality: 'Min7', inversion: null, bass: 'E' });
  });
});

describe('tokenizeChordInput', () => {
  it('tokenizes plain chord sequence', () => {
    expect(tokenizeChordInput('Cmaj7 Am7')).toEqual(['Cmaj7', ' ', 'Am7']);
  });

  it('groups parenthesized notes as single tokens', () => {
    expect(tokenizeChordInput('Cmaj7 (F A C Eb) Dm7')).toEqual([
      'Cmaj7', ' ', '(F A C Eb)', ' ', 'Dm7'
    ]);
  });

  it('handles adjacent spelled chords', () => {
    expect(tokenizeChordInput('(C E G B) (F A C Eb)')).toEqual([
      '(C E G B)', ' ', '(F A C Eb)'
    ]);
  });

  it('handles unclosed paren as single failed token', () => {
    const tokens = tokenizeChordInput('(C E G');
    expect(tokens).toEqual(['(C E G']);
  });

  it('handles empty parens', () => {
    expect(tokenizeChordInput('()')).toEqual(['()']);
  });

  it('preserves multiple spaces', () => {
    expect(tokenizeChordInput('C   Am')).toEqual(['C', '   ', 'Am']);
  });
});

describe('parseChordSequence', () => {
  it('parses space-separated chords', () => {
    const result = parseChordSequence('C Am7 G7');
    expect(result).toHaveLength(3);
    expect(result[0]!.ok).toBe(true);
    expect(result[1]!.ok).toBe(true);
    expect(result[2]!.ok).toBe(true);
  });
  it('marks invalid chords as errors', () => {
    const result = parseChordSequence('C XYZ G');
    expect(result).toHaveLength(3);
    expect(result[0]!.ok).toBe(true);
    expect(result[1]!.ok).toBe(false);
    expect(result[2]!.ok).toBe(true);
  });
  it('handles empty input', () => {
    const result = parseChordSequence('');
    expect(result).toHaveLength(0);
  });
  it('handles jazzy Happy Birthday progression', () => {
    const result = parseChordSequence('Cmaj7 Am7 Dm7 G7 Em7 A7 Dm7 G7 Cmaj7 C7 Fmaj7 Fm6 Cmaj7 Am7 Dm7 G7 Cmaj7');
    expect(result).toHaveLength(17);
    expect(result.every(r => r.ok)).toBe(true);
  });
  it('parses sequence with slash chords', () => {
    const result = parseChordSequence('C/E Am7/G F C13');
    expect(result).toHaveLength(4);
    expect(result.every(r => r.ok)).toBe(true);
    if (result[0]!.ok) {
      expect(result[0]!.value.bass).toBe('E');
    }
    if (result[3]!.ok) {
      expect(result[3]!.value.quality).toBe('Dom13');
    }
  });
});

describe('parseChordSequence with spelled chords', () => {
  it('parses mixed sequence', () => {
    const results = parseChordSequence('Cmaj7 (F A C Eb) Dm7');
    expect(results.length).toBe(3);
    expect(results[0]!.ok).toBe(true);
    if (results[0]!.ok) {
      expect(results[0]!.value.quality).toBe('Maj7');
      expect(results[0]!.value.explicitVoicing).toBeUndefined();
    }
    expect(results[1]!.ok).toBe(true);
    if (results[1]!.ok) {
      expect(results[1]!.value.root).toBe('F');
      expect(results[1]!.value.quality).toBe('Dom7');
      expect(results[1]!.value.explicitVoicing).toBeDefined();
    }
    expect(results[2]!.ok).toBe(true);
    if (results[2]!.ok) {
      expect(results[2]!.value.quality).toBe('Min7');
    }
  });

  it('parses all-spelled sequence', () => {
    const results = parseChordSequence('(C E G B) (F A C Eb)');
    expect(results.length).toBe(2);
    expect(results.every(r => r.ok)).toBe(true);
  });

  it('handles empty input', () => {
    expect(parseChordSequence('')).toEqual([]);
  });

  it('handles unclosed paren as parse error', () => {
    const results = parseChordSequence('(C E G');
    expect(results.length).toBe(1);
    expect(results[0]!.ok).toBe(false);
  });
});