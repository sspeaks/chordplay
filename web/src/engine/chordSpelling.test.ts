import { describe, it, expect } from 'vitest';
import { hasChordQuality, isSpelledChord } from '../types';
import { parseNoteName, parseSpelledNoteToken, identifyChord, parseSpelledChord } from './chordSpelling';

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

describe('parseSpelledNoteToken', () => {
  it('parses pitch-class-only spelled notes', () => {
    expect(parseSpelledNoteToken('A')).toEqual({ pitchClass: 'A' });
    expect(parseSpelledNoteToken('Bb')).toEqual({ pitchClass: 'As' });
    expect(parseSpelledNoteToken('C#')).toEqual({ pitchClass: 'Cs' });
  });

  it('parses optional octave suffixes', () => {
    expect(parseSpelledNoteToken('A3')).toEqual({ pitchClass: 'A', octave: 3 });
    expect(parseSpelledNoteToken('Bb12')).toEqual({ pitchClass: 'As', octave: 12 });
    expect(parseSpelledNoteToken('C#4')).toEqual({ pitchClass: 'Cs', octave: 4 });
  });

  it('rejects invalid spelled note tokens', () => {
    expect(parseSpelledNoteToken('')).toBeNull();
    expect(parseSpelledNoteToken('H3')).toBeNull();
    expect(parseSpelledNoteToken('A-1')).toBeNull();
    expect(parseSpelledNoteToken('A3b')).toBeNull();
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

  it('identifies three-note triads', () => {
    expect(id(['C', 'E', 'G'])).toEqual({ root: 'C', quality: 'Major', inversion: 0 });
    expect(id(['A', 'C', 'E'])).toEqual({ root: 'A', quality: 'Minor', inversion: 0 });
    expect(id(['G', 'C', 'E'])).toEqual({ root: 'C', quality: 'Major', inversion: 2 });
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
    expect(isSpelledChord(result.value)).toBe(true);
    expect(hasChordQuality(result.value)).toBe(true);
    if (!hasChordQuality(result.value)) return;
    expect(result.value.root).toBe('C');
    expect(result.value.quality).toBe('Maj7');
    expect(result.value.inversion).toBe(0);
    expect(result.value.explicitVoicing).toEqual(['C', 'E', 'G', 'B']);
    if (!isSpelledChord(result.value)) return;
    expect(result.value.notes).toEqual([
      { pitchClass: 'C' },
      { pitchClass: 'E' },
      { pitchClass: 'G' },
      { pitchClass: 'B' },
    ]);
    expect(result.value.warning).toBeFalsy();
  });

  it('parses a chord with flats', () => {
    const result = parseSpelledChord('(F A C Eb)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hasChordQuality(result.value)).toBe(true);
    if (!hasChordQuality(result.value)) return;
    expect(result.value.root).toBe('F');
    expect(result.value.quality).toBe('Dom7');
    expect(result.value.explicitVoicing).toEqual(['F', 'A', 'C', 'Ds']);
  });

  it('detects inversion from note order', () => {
    const result = parseSpelledChord('(E G C E)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hasChordQuality(result.value)).toBe(true);
    if (!hasChordQuality(result.value)) return;
    expect(result.value.root).toBe('C');
    expect(result.value.quality).toBe('Major');
    expect(result.value.inversion).toBe(1);
  });

  it('parses a single note event', () => {
    const result = parseSpelledChord('(A)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isSpelledChord(result.value)).toBe(true);
    expect(hasChordQuality(result.value)).toBe(false);
    expect(result.value.root).toBe('A');
    expect(result.value.inversion).toBeNull();
    expect(result.value.explicitVoicing).toEqual(['A']);
    expect(result.value.warning).toBeFalsy();
    if (!isSpelledChord(result.value)) return;
    expect(result.value.notes).toEqual([{ pitchClass: 'A' }]);
  });

  it('parses a single octave-qualified note event', () => {
    const result = parseSpelledChord('(A7)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hasChordQuality(result.value)).toBe(false);
    expect(result.value.root).toBe('A');
    expect(result.value.explicitVoicing).toEqual(['A']);
    if (!isSpelledChord(result.value)) return;
    expect(result.value.notes).toEqual([{ pitchClass: 'A', octave: 7 }]);
  });

  it('parses dyads without warning', () => {
    const result = parseSpelledChord('(C#4 G)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hasChordQuality(result.value)).toBe(false);
    expect(result.value.warning).toBeFalsy();
    expect(result.value.explicitVoicing).toEqual(['Cs', 'G']);
    if (!isSpelledChord(result.value)) return;
    expect(result.value.notes).toEqual([{ pitchClass: 'Cs', octave: 4 }, { pitchClass: 'G' }]);
  });

  it('parses three-note recognized chords', () => {
    const result = parseSpelledChord('(C E G)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hasChordQuality(result.value)).toBe(true);
    if (!hasChordQuality(result.value)) return;
    expect(result.value.root).toBe('C');
    expect(result.value.quality).toBe('Major');
    expect(result.value.explicitVoicing).toEqual(['C', 'E', 'G']);
  });

  it('preserves mixed octave anchors', () => {
    const result = parseSpelledChord('(F A3 C E)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hasChordQuality(result.value)).toBe(true);
    expect(result.value.explicitVoicing).toEqual(['F', 'A', 'C', 'E']);
    if (!isSpelledChord(result.value)) return;
    expect(result.value.notes).toEqual([
      { pitchClass: 'F' },
      { pitchClass: 'A', octave: 3 },
      { pitchClass: 'C' },
      { pitchClass: 'E' },
    ]);
  });

  it('preserves fully anchored spellings', () => {
    const result = parseSpelledChord('(F3 A3 C4 Eb4)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hasChordQuality(result.value)).toBe(true);
    if (!isSpelledChord(result.value)) return;
    expect(result.value.notes).toEqual([
      { pitchClass: 'F', octave: 3 },
      { pitchClass: 'A', octave: 3 },
      { pitchClass: 'C', octave: 4 },
      { pitchClass: 'Ds', octave: 4 },
    ]);
  });

  it('sets warning for unrecognized spellings', () => {
    const result = parseSpelledChord('(C D E F)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warning).toBe(true);
    expect(result.value.root).toBe('C');
    expect(result.value.explicitVoicing).toEqual(['C', 'D', 'E', 'F']);
    expect(hasChordQuality(result.value)).toBe(false);
  });

  it('sets warning for too few distinct pitch classes', () => {
    const result = parseSpelledChord('(C C C E)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warning).toBe(true);
  });

  it('fails for too many notes', () => {
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
    expect(hasChordQuality(sharp.value)).toBe(false);
    expect(hasChordQuality(flat.value)).toBe(false);
    expect(sharp.value.root).toBe(flat.value.root);
    expect(sharp.value.explicitVoicing).toEqual(flat.value.explicitVoicing);
    expect(sharp.value.warning).toBe(true);
    expect(flat.value.warning).toBe(true);
  });
});
