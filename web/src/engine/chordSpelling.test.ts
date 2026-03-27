import { describe, it, expect } from 'vitest';
import { parseNoteName } from './chordSpelling';

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
