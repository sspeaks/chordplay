import { describe, it, expect } from 'vitest';
import { chordTextToRoman, chordToRomanDisplayName, romanTextToStandard } from './romanConverter';
import { parseChordSequence } from './parser';
import type { ChordSymbol, KeySignature } from '../types';

const Cmaj: KeySignature = { root: 'C', quality: 'major' };
const Dmaj: KeySignature = { root: 'D', quality: 'major' };
const Gmaj: KeySignature = { root: 'G', quality: 'major' };
const Amin: KeySignature = { root: 'A', quality: 'minor' };

function parsedChord(input: string): ChordSymbol {
  const [result] = parseChordSequence(input);
  expect(result?.ok).toBe(true);
  if (!result?.ok) throw new Error(`Expected ${input} to parse`);
  return result.value;
}

describe('chordToRomanDisplayName', () => {
  it('labels G7 as I7 in G major', () => {
    expect(chordToRomanDisplayName(parsedChord('G7'), Gmaj)).toBe('I7');
  });

  it('labels standard chords relative to the selected key', () => {
    expect(chordToRomanDisplayName(parsedChord('Fmaj7'), Cmaj)).toBe('IVmaj7');
  });

  it('preserves slash bass notes', () => {
    expect(chordToRomanDisplayName(parsedChord('G7/B'), Cmaj)).toBe('V7/B');
  });

  it('labels secondary dominants when a next chord is provided', () => {
    expect(chordToRomanDisplayName(parsedChord('D7'), Cmaj, parsedChord('G'))).toBe('V7/V');
  });

  it('returns null for warning and unqualified spelled chords', () => {
    expect(chordToRomanDisplayName(parsedChord('(C D E F)'), Cmaj)).toBeNull();
    expect(chordToRomanDisplayName(parsedChord('(A7)'), Cmaj)).toBeNull();
  });
});

describe('chordTextToRoman', () => {
  it('C Am G F in C major = I vi V IV', () => {
    expect(chordTextToRoman('C Am G F', Cmaj)).toBe('I vi V IV');
  });
  it('D A Bm G in D major = I V vi IV', () => {
    expect(chordTextToRoman('D A Bm G', Dmaj)).toBe('I V vi IV');
  });
  it('handles Dom7', () => {
    expect(chordTextToRoman('G7', Cmaj)).toBe('V7');
  });
  it('handles Maj7', () => {
    expect(chordTextToRoman('Fmaj7', Cmaj)).toBe('IVmaj7');
  });
  it('handles chromatic chords with accidentals', () => {
    expect(chordTextToRoman('Bb', Cmaj)).toBe('bVII');
  });
  it('preserves whitespace', () => {
    expect(chordTextToRoman('C  G', Cmaj)).toBe('I  V');
  });
  it('passes invalid tokens through unchanged', () => {
    expect(chordTextToRoman('C XYZ G', Cmaj)).toBe('I XYZ V');
  });
  it('handles empty input', () => {
    expect(chordTextToRoman('', Cmaj)).toBe('');
  });
  it('detects V7/V: D7 → G in C major', () => {
    expect(chordTextToRoman('D7 G', Cmaj)).toBe('V7/V V');
  });
  it('detects V7/ii: A7 → Dm in C major', () => {
    expect(chordTextToRoman('A7 Dm', Cmaj)).toBe('V7/ii ii');
  });
  it('does NOT label diatonic V7 as V7/I', () => {
    expect(chordTextToRoman('G7 C', Cmaj)).toBe('V7 I');
  });
});

describe('romanTextToStandard', () => {
  it('I vi V IV in C major = C Am G F', () => {
    expect(romanTextToStandard('I vi V IV', Cmaj)).toBe('C Am G F');
  });
  it('I V vi IV in D major = D A Bm G', () => {
    expect(romanTextToStandard('I V vi IV', Dmaj)).toBe('D A Bm G');
  });
  it('handles quality suffixes', () => {
    expect(romanTextToStandard('V7', Cmaj)).toBe('G7');
  });
  it('preserves whitespace', () => {
    expect(romanTextToStandard('I  V', Cmaj)).toBe('C  G');
  });
  it('passes invalid tokens through unchanged', () => {
    expect(romanTextToStandard('I XYZ V', Cmaj)).toBe('C XYZ G');
  });
  it('handles empty input', () => {
    expect(romanTextToStandard('', Cmaj)).toBe('');
  });
  it('uses sharp spelling in sharp keys', () => {
    expect(romanTextToStandard('iii', Dmaj)).toBe('F#m');
  });
  it('uses flat spelling in flat keys', () => {
    const Bbmaj: KeySignature = { root: 'As', quality: 'major' };
    expect(romanTextToStandard('IV', Bbmaj)).toBe('Eb');
  });
  it('handles secondary dominants', () => {
    expect(romanTextToStandard('V7/V', Cmaj)).toBe('D7');
  });
});

describe('roundtrip: standard → roman → standard', () => {
  const testCases: [string, KeySignature, string][] = [
    ['C Am G F', Cmaj, 'standard I-vi-V-IV in C'],
    ['D A Bm G', Dmaj, 'standard I-V-vi-IV in D'],
    ['C G7 F Dm', Cmaj, 'with dom7 in C'],
    ['Am E7 F G', Amin, 'minor key progression'],
  ];

  for (const [input, key, label] of testCases) {
    it(`roundtrips: ${label}`, () => {
      const roman = chordTextToRoman(input, key);
      const backToStandard = romanTextToStandard(roman, key);
      const original = parseChordSequence(input).filter(r => r.ok).map(r => (r as any).value);
      const roundtripped = parseChordSequence(backToStandard).filter(r => r.ok).map(r => (r as any).value);
      expect(roundtripped).toEqual(original);
    });
  }
});

describe('spelled chords pass through notation conversion', () => {
  it('chordTextToRoman preserves spelled chords', () => {
    expect(chordTextToRoman('Cmaj7 (F A C Eb) Dm7', Cmaj)).toBe('Imaj7 (F A C Eb) iim7');
  });

  it('chordTextToRoman preserves single-note and anchored spellings', () => {
    expect(chordTextToRoman('A7 Dm (A7) (F A3 C E)', Cmaj)).toBe('V7/ii ii (A7) (F A3 C E)');
  });

  it('romanTextToStandard preserves spelled chords', () => {
    expect(romanTextToStandard('Imaj7 (F A C Eb) iim7', Cmaj)).toBe('Cmaj7 (F A C Eb) Dm7');
  });

  it('romanTextToStandard preserves single-note and anchored spellings', () => {
    expect(romanTextToStandard('V7 (A7) (F A3 C E)', Dmaj)).toBe('A7 (A7) (F A3 C E)');
  });

  it('roundtrips with mixed spelled and standard chords', () => {
    const input = 'Cmaj7 (F A C Eb) Dm7 G7';
    const roman = chordTextToRoman(input, Cmaj);
    const back = romanTextToStandard(roman, Cmaj);
    const originalChords = parseChordSequence(input).filter(r => r.ok).map(r => (r as any).value);
    const roundtrippedChords = parseChordSequence(back).filter(r => r.ok).map(r => (r as any).value);
    expect(roundtrippedChords).toEqual(originalChords);
  });
});

describe('slash chord conversion', () => {
  const key: KeySignature = { root: 'C', quality: 'major' };

  it('C/E → I/E (standard to roman)', () => {
    expect(chordTextToRoman('C/E', key)).toBe('I/E');
  });

  it('Am7/G → vim7/G (standard to roman)', () => {
    expect(chordTextToRoman('Am7/G', key)).toBe('vim7/G');
  });

  it('I/E → C/E (roman to standard)', () => {
    expect(romanTextToStandard('I/E', key)).toBe('C/E');
  });

  it('vim7/G → Am7/G (roman to standard)', () => {
    expect(romanTextToStandard('vim7/G', key)).toBe('Am7/G');
  });

  it('round-trip: G7/B ↔ V7/B', () => {
    const roman = chordTextToRoman('G7/B', key);
    expect(roman).toBe('V7/B');
    expect(romanTextToStandard(roman, key)).toBe('G7/B');
  });

  it('V7/V stays secondary dominant (not slash)', () => {
    const standard = romanTextToStandard('V7/V', key);
    expect(standard).toBe('D7');
  });
});