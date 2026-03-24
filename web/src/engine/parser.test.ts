import { describe, it, expect } from 'vitest';
import { parseChord, parseChordSequence } from './parser';
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
  it('A9 → A Dom9 (rootless)', () => {
    expectChord('A9', { root: 'A', quality: 'Dom9', inversion: null });
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
});