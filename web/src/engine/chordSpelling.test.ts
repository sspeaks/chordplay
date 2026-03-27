import { describe, it, expect } from 'vitest';
import { parseNoteName, identifyChord } from './chordSpelling';
import type { PitchClass } from '../types';

describe('parseNoteName', () => {
  it('parses natural notes', () => {
    expect(parseNoteName('C')).toBe('C');
    expect(parseNoteName('D')).toBe('D');
    expect(parseNoteName('E')).toBe('E');
    expect(parseNoteName('F')).toBe('F');
    expect(parseNoteName('G')).toBe('G');
    expect(parseNoteName('A')).toBe('A');
    expect(parseNoteName('B')).toBe('B');
  });

  it('parses sharp notes', () => {
    expect(parseNoteName('C#')).toBe('Cs');
    expect(parseNoteName('F#')).toBe('Fs');
    expect(parseNoteName('G#')).toBe('Gs');
  });

  it('parses flat notes', () => {
    expect(parseNoteName('Eb')).toBe('Ds');
    expect(parseNoteName('Bb')).toBe('As');
    expect(parseNoteName('Ab')).toBe('Gs');
    expect(parseNoteName('Db')).toBe('Cs');
    expect(parseNoteName('Gb')).toBe('Fs');
  });

  it('returns null for invalid input', () => {
    expect(parseNoteName('')).toBeNull();
    expect(parseNoteName('H')).toBeNull();
    expect(parseNoteName('Cx')).toBeNull();
    expect(parseNoteName('123')).toBeNull();
  });

  it('is case-sensitive (lowercase fails)', () => {
    expect(parseNoteName('c')).toBeNull();
    expect(parseNoteName('eb')).toBeNull();
  });
});

describe('identifyChord', () => {
  function id(notes: string[]) {
    const pcs = notes.map(n => parseNoteName(n)!);
    return identifyChord(pcs);
  }

  it('identifies root position 7th chords', () => {
    expect(id(['C', 'E', 'G', 'B'])).toEqual({ root: 'C', quality: 'Maj7', inversion: 0 });
    expect(id(['F', 'A', 'C', 'Eb'])).toEqual({ root: 'F', quality: 'Dom7', inversion: 0 });
    expect(id(['D', 'F', 'A', 'C'])).toEqual({ root: 'D', quality: 'Min7', inversion: 0 });
    expect(id(['C', 'Eb', 'Gb', 'A'])).toEqual({ root: 'C', quality: 'Dim7', inversion: 0 });
    expect(id(['B', 'D', 'F', 'A'])).toEqual({ root: 'B', quality: 'HalfDim7', inversion: 0 });
    expect(id(['C', 'Eb', 'G', 'B'])).toEqual({ root: 'C', quality: 'MinMaj7', inversion: 0 });
  });

  it('identifies root position 6th chords', () => {
    expect(id(['C', 'E', 'G', 'A'])).toEqual({ root: 'C', quality: 'Maj6', inversion: 0 });
    expect(id(['C', 'Eb', 'G', 'A'])).toEqual({ root: 'C', quality: 'Min6', inversion: 0 });
  });

  it('identifies triads with doubled note', () => {
    expect(id(['C', 'E', 'G', 'C'])).toEqual({ root: 'C', quality: 'Major', inversion: 0 });
    expect(id(['A', 'C', 'E', 'A'])).toEqual({ root: 'A', quality: 'Minor', inversion: 0 });
    expect(id(['C', 'E', 'G', 'E'])).toEqual({ root: 'C', quality: 'Major', inversion: 0 });
  });

  it('detects inversions', () => {
    expect(id(['E', 'G', 'C', 'E'])).toEqual({ root: 'C', quality: 'Major', inversion: 1 });
    expect(id(['G', 'C', 'E', 'G'])).toEqual({ root: 'C', quality: 'Major', inversion: 2 });
    expect(id(['E', 'G', 'Bb', 'C'])).toEqual({ root: 'C', quality: 'Dom7', inversion: 1 });
    expect(id(['Bb', 'C', 'E', 'G'])).toEqual({ root: 'C', quality: 'Dom7', inversion: 3 });
  });

  it('returns null for unrecognized spellings', () => {
    expect(id(['C', 'D', 'E', 'F'])).toBeNull();
  });

  it('returns null for fewer than 3 distinct pitch classes', () => {
    expect(id(['C', 'C', 'C', 'E'])).toBeNull();
  });

  it('prefers root position over inversions', () => {
    expect(id(['C', 'E', 'G', 'A'])).toEqual({ root: 'C', quality: 'Maj6', inversion: 0 });
  });
});
