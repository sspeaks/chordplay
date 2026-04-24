import { describe, it, expect } from 'vitest';
import { parseRomanChord, parseRomanSequence } from './romanParser';
import type { ChordSymbol, KeySignature } from '../types';

const Cmaj: KeySignature = { root: 'C', quality: 'major' };
const Dmaj: KeySignature = { root: 'D', quality: 'major' };
const Amin: KeySignature = { root: 'A', quality: 'minor' };

function expectChord(input: string, key: KeySignature, expected: ChordSymbol) {
  const result = parseRomanChord(input, key);
  expect(result.ok, `Expected '${input}' to parse OK but got: ${result.ok ? '' : result.error}`).toBe(true);
  if (result.ok) {
    expect(result.value).toEqual(expected);
  }
}

function expectFail(input: string, key: KeySignature) {
  const result = parseRomanChord(input, key);
  expect(result.ok).toBe(false);
}

describe('parseRomanChord', () => {
  it('I in C = C Major', () => {
    expectChord('I', Cmaj, { root: 'C', quality: 'Major', inversion: null });
  });
  it('ii in C = D Minor', () => {
    expectChord('ii', Cmaj, { root: 'D', quality: 'Minor', inversion: null });
  });
  it('iii in C = E Minor', () => {
    expectChord('iii', Cmaj, { root: 'E', quality: 'Minor', inversion: null });
  });
  it('IV in C = F Major', () => {
    expectChord('IV', Cmaj, { root: 'F', quality: 'Major', inversion: null });
  });
  it('V in C = G Major', () => {
    expectChord('V', Cmaj, { root: 'G', quality: 'Major', inversion: null });
  });
  it('vi in C = A Minor', () => {
    expectChord('vi', Cmaj, { root: 'A', quality: 'Minor', inversion: null });
  });
  it('VII in C = B Major', () => {
    expectChord('VII', Cmaj, { root: 'B', quality: 'Major', inversion: null });
  });
  it('V7 in C = G Dom7', () => {
    expectChord('V7', Cmaj, { root: 'G', quality: 'Dom7', inversion: null });
  });
  it('IVmaj7 in C = F Maj7', () => {
    expectChord('IVmaj7', Cmaj, { root: 'F', quality: 'Maj7', inversion: null });
  });
  it('ii7 in C = D Dom7 (suffix overrides case)', () => {
    expectChord('ii7', Cmaj, { root: 'D', quality: 'Dom7', inversion: null });
  });
  it('iim7 in C = D Min7', () => {
    expectChord('iim7', Cmaj, { root: 'D', quality: 'Min7', inversion: null });
  });
  it('viidim in C = B Dim', () => {
    expectChord('viidim', Cmaj, { root: 'B', quality: 'Dim', inversion: null });
  });
  it('viidim7 in C = B Dim7', () => {
    expectChord('viidim7', Cmaj, { root: 'B', quality: 'Dim7', inversion: null });
  });
  it('viim7b5 in C = B HalfDim7', () => {
    expectChord('viim7b5', Cmaj, { root: 'B', quality: 'HalfDim7', inversion: null });
  });
  it('III+ in C = E Aug', () => {
    expectChord('III+', Cmaj, { root: 'E', quality: 'Aug', inversion: null });
  });
  it('Isus4 in C = C Sus4', () => {
    expectChord('Isus4', Cmaj, { root: 'C', quality: 'Sus4', inversion: null });
  });
  // 9th chords: bare V9 is invalid, must specify omission
  it('V9 (bare) fails', () => {
    expectFail('V9', Cmaj);
  });
  it('V9-1 in C = G Dom9no1', () => {
    expectChord('V9-1', Cmaj, { root: 'G', quality: 'Dom9no1', inversion: null });
  });
  it('V9-5 in C = G Dom9no5', () => {
    expectChord('V9-5', Cmaj, { root: 'G', quality: 'Dom9no5', inversion: null });
  });
  it('IVmaj9-3 in C = F Maj9no3', () => {
    expectChord('IVmaj9-3', Cmaj, { root: 'F', quality: 'Maj9no3', inversion: null });
  });
  it('iim9-5 in C = D Min9no5', () => {
    expectChord('iim9-5', Cmaj, { root: 'D', quality: 'Min9no5', inversion: null });
  });
  it('Iadd9 in C = C Dom9no7', () => {
    expectChord('Iadd9', Cmaj, { root: 'C', quality: 'Dom9no7', inversion: null });
  });
  it('iimadd9 in C = D Min9no7', () => {
    expectChord('iimadd9', Cmaj, { root: 'D', quality: 'Min9no7', inversion: null });
  });
  it('I6 in C = C Maj6', () => {
    expectChord('I6', Cmaj, { root: 'C', quality: 'Maj6', inversion: null });
  });
  it('bVII in C = Bb Major', () => {
    expectChord('bVII', Cmaj, { root: 'As', quality: 'Major', inversion: null });
  });
  it('bVII7 in C = Bb Dom7', () => {
    expectChord('bVII7', Cmaj, { root: 'As', quality: 'Dom7', inversion: null });
  });
  it('#IV in C = F# Major', () => {
    expectChord('#IV', Cmaj, { root: 'Fs', quality: 'Major', inversion: null });
  });
  it('bIII in C = Eb Major', () => {
    expectChord('bIII', Cmaj, { root: 'Ds', quality: 'Major', inversion: null });
  });
  it('I in D = D Major', () => {
    expectChord('I', Dmaj, { root: 'D', quality: 'Major', inversion: null });
  });
  it('V7 in D = A Dom7', () => {
    expectChord('V7', Dmaj, { root: 'A', quality: 'Dom7', inversion: null });
  });
  it('vi in D = B Minor', () => {
    expectChord('vi', Dmaj, { root: 'B', quality: 'Minor', inversion: null });
  });
  it('i in A minor = A Minor', () => {
    expectChord('i', Amin, { root: 'A', quality: 'Minor', inversion: null });
  });
  it('III in A minor = C Major', () => {
    expectChord('III', Amin, { root: 'C', quality: 'Major', inversion: null });
  });
  it('V7 in A minor = E Dom7', () => {
    expectChord('V7', Amin, { root: 'E', quality: 'Dom7', inversion: null });
  });
  it('V7/V in C = D7 (dominant of G)', () => {
    expectChord('V7/V', Cmaj, { root: 'D', quality: 'Dom7', inversion: null });
  });
  it('V7/ii in C = A7 (dominant of Dm=D)', () => {
    expectChord('V7/ii', Cmaj, { root: 'A', quality: 'Dom7', inversion: null });
  });
  it('V7/vi in D = F#7 (dominant of Bm=B)', () => {
    expectChord('V7/vi', Dmaj, { root: 'Fs', quality: 'Dom7', inversion: null });
  });
  it('V/IV in C = C Major (dominant of F)', () => {
    expectChord('V/IV', Cmaj, { root: 'C', quality: 'Major', inversion: null });
  });
  it('V7/bIII in C = Bb7 (dominant of Eb)', () => {
    expectChord('V7/bIII', Cmaj, { root: 'As', quality: 'Dom7', inversion: null });
  });
  it('V7/#IV in C = C#7 (dominant of F#)', () => {
    expectChord('V7/#IV', Cmaj, { root: 'Cs', quality: 'Dom7', inversion: null });
  });
  it('1V7 in C = G Dom7, inversion 1', () => {
    expectChord('1V7', Cmaj, { root: 'G', quality: 'Dom7', inversion: 1 });
  });
  it('-1IV in C = F Major, inversion -1', () => {
    expectChord('-1IV', Cmaj, { root: 'F', quality: 'Major', inversion: -1 });
  });
  it('empty string fails', () => {
    expectFail('', Cmaj);
  });
  it('invalid numeral fails', () => {
    expectFail('X7', Cmaj);
  });
  it('invalid quality suffix fails', () => {
    expectFail('Ixyz', Cmaj);
  });

  // Octave shift
  it('V7^ in C = G Dom7 octaveShift 1', () => {
    expectChord('V7^', Cmaj, { root: 'G', quality: 'Dom7', inversion: null, octaveShift: 1 });
  });
  it('IV__ in C = F Major octaveShift -2', () => {
    expectChord('IV__', Cmaj, { root: 'F', quality: 'Major', inversion: null, octaveShift: -2 });
  });
  it('1V7^ in C = G Dom7 inversion 1 octaveShift 1', () => {
    expectChord('1V7^', Cmaj, { root: 'G', quality: 'Dom7', inversion: 1, octaveShift: 1 });
  });
  it('V7/V^ in C = D Dom7 octaveShift 1', () => {
    expectChord('V7/V^', Cmaj, { root: 'D', quality: 'Dom7', inversion: null, octaveShift: 1 });
  });
  it('mixed ^_ in Roman fails', () => {
    expectFail('I^_', Cmaj);
  });
});

describe('parseRomanSequence', () => {
  it('parses space-separated Roman numerals', () => {
    const result = parseRomanSequence('I V7 vi IV', Cmaj);
    expect(result).toHaveLength(4);
    expect(result.every(r => r.ok)).toBe(true);
  });
  it('marks invalid tokens as errors', () => {
    const result = parseRomanSequence('I XYZ V', Cmaj);
    expect(result).toHaveLength(3);
    expect(result[0]!.ok).toBe(true);
    expect(result[1]!.ok).toBe(false);
    expect(result[2]!.ok).toBe(true);
  });
  it('handles empty input', () => {
    const result = parseRomanSequence('', Cmaj);
    expect(result).toHaveLength(0);
  });

  it('handles spelled chords in roman mode', () => {
    const result = parseRomanSequence('I (F A C Eb) ii7', Cmaj);
    expect(result).toHaveLength(3);
    expect(result[0]!.ok).toBe(true);
    expect(result[1]!.ok).toBe(true);
    if (result[1]!.ok) {
      expect(result[1]!.value.root).toBe('F');
      expect(result[1]!.value.quality).toBe('Dom7');
      expect(result[1]!.value.explicitVoicing).toBeDefined();
    }
    expect(result[2]!.ok).toBe(true);
  });
});

describe('parseRomanChord slash chords', () => {
  const key: KeySignature = { root: 'C', quality: 'major' };

  it('I/E → C Major with bass E', () => {
    const result = parseRomanChord('I/E', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root).toBe('C');
      expect(result.value.quality).toBe('Major');
      expect(result.value.bass).toBe('E');
    }
  });

  it('V7/B → G Dom7 with bass B (not secondary dominant)', () => {
    const result = parseRomanChord('V7/B', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root).toBe('G');
      expect(result.value.quality).toBe('Dom7');
      expect(result.value.bass).toBe('B');
    }
  });

  it('V7/V → secondary dominant (D Dom7, no bass)', () => {
    const result = parseRomanChord('V7/V', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root).toBe('D');
      expect(result.value.quality).toBe('Dom7');
      expect(result.value.bass).toBeUndefined();
    }
  });

  it('V7/Bb → G Dom7 with bass Bb', () => {
    const result = parseRomanChord('V7/Bb', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root).toBe('G');
      expect(result.value.quality).toBe('Dom7');
      expect(result.value.bass).toBe('As');
    }
  });

  it('V7/bIII → secondary dominant (not slash)', () => {
    const result = parseRomanChord('V7/bIII', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root).toBe('As');
      expect(result.value.quality).toBe('Dom7');
      expect(result.value.bass).toBeUndefined();
    }
  });

  it('IV/C → F Major with bass C', () => {
    const result = parseRomanChord('IV/C', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root).toBe('F');
      expect(result.value.quality).toBe('Major');
      expect(result.value.bass).toBe('C');
    }
  });

  it('V/B → G Major with bass B (bare numeral slash)', () => {
    const result = parseRomanChord('V/B', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root).toBe('G');
      expect(result.value.quality).toBe('Major');
      expect(result.value.bass).toBe('B');
    }
  });
});