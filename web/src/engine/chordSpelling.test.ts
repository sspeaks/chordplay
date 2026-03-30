import { describe, it, expect } from 'vitest';
import { parseNoteName, identifyChord, parseSpelledChord } from './chordSpelling';

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

  it('identifies C Dom13 from [C, E, A, Bb]', () => {
    const result = identifyChord(['C', 'E', 'A', 'As']);
    expect(result).toEqual({ root: 'C', quality: 'Dom13', inversion: 0 });
  });
  it('identifies Bb Dom13 from [Bb, D, G, Ab]', () => {
    const result = identifyChord(['As', 'D', 'G', 'Gs']);
    expect(result).toEqual({ root: 'As', quality: 'Dom13', inversion: 0 });
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

describe('parseSpelledChord', () => {
  it('parses a recognized 7th chord', () => {
    const result = parseSpelledChord('(C E G B)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.root).toBe('C');
    expect(result.value.quality).toBe('Maj7');
    expect(result.value.inversion).toBe(0);
    expect(result.value.explicitVoicing).toEqual(['C', 'E', 'G', 'B']);
    expect(result.value.warning).toBeFalsy();
  });

  it('parses a chord with flats', () => {
    const result = parseSpelledChord('(F A C Eb)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.root).toBe('F');
    expect(result.value.quality).toBe('Dom7');
    expect(result.value.explicitVoicing).toEqual(['F', 'A', 'C', 'Ds']);
  });

  it('detects inversion from note order', () => {
    const result = parseSpelledChord('(E G C E)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.root).toBe('C');
    expect(result.value.quality).toBe('Major');
    expect(result.value.inversion).toBe(1);
  });

  it('sets warning for unrecognized spellings', () => {
    const result = parseSpelledChord('(C D E F)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warning).toBe(true);
    expect(result.value.root).toBe('C');
    expect(result.value.explicitVoicing).toEqual(['C', 'D', 'E', 'F']);
  });

  it('sets warning for too few distinct pitch classes', () => {
    const result = parseSpelledChord('(C C C E)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warning).toBe(true);
  });

  it('fails for wrong number of notes', () => {
    expect(parseSpelledChord('(C E G)').ok).toBe(false);
    expect(parseSpelledChord('(C D E F G)').ok).toBe(false);
  });

  it('fails for empty parens', () => {
    expect(parseSpelledChord('()').ok).toBe(false);
  });

  it('fails for invalid note names', () => {
    expect(parseSpelledChord('(C E G H)').ok).toBe(false);
  });

  it('handles sharps and flats producing same pitch class', () => {
    const sharp = parseSpelledChord('(C E G# B)');
    const flat = parseSpelledChord('(C E Ab B)');
    expect(sharp.ok).toBe(true);
    expect(flat.ok).toBe(true);
    if (!sharp.ok || !flat.ok) return;
    expect(sharp.value.quality).toBe(flat.value.quality);
    expect(sharp.value.root).toBe(flat.value.root);
  });
});
