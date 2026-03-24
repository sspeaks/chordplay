import { describe, it, expect } from 'vitest';
import {
  scaleDegreeToPC,
  pcToScaleDegree,
  isSharpKey,
  pcToStandardName,
} from './romanNumerals';
import type { KeySignature } from '../types';

const Dmaj: KeySignature = { root: 'D', quality: 'major' };
const Cmaj: KeySignature = { root: 'C', quality: 'major' };
const Amaj: KeySignature = { root: 'A', quality: 'major' };
const Amin: KeySignature = { root: 'A', quality: 'minor' };
const Fmaj: KeySignature = { root: 'F', quality: 'major' };
const Fsmaj: KeySignature = { root: 'Fs', quality: 'major' };
const Bbmaj: KeySignature = { root: 'As', quality: 'major' };

describe('scaleDegreeToPC', () => {
  it('I in D major = D', () => {
    expect(scaleDegreeToPC(Dmaj, 1, 0)).toBe('D');
  });
  it('V in D major = A', () => {
    expect(scaleDegreeToPC(Dmaj, 5, 0)).toBe('A');
  });
  it('IV in C major = F', () => {
    expect(scaleDegreeToPC(Cmaj, 4, 0)).toBe('F');
  });
  it('VII in C major = B', () => {
    expect(scaleDegreeToPC(Cmaj, 7, 0)).toBe('B');
  });
  it('bVII in C major = Bb (As)', () => {
    expect(scaleDegreeToPC(Cmaj, 7, -1)).toBe('As');
  });
  it('#IV in C major = F# (Fs)', () => {
    expect(scaleDegreeToPC(Cmaj, 4, 1)).toBe('Fs');
  });
  it('III in A minor = C', () => {
    expect(scaleDegreeToPC(Amin, 3, 0)).toBe('C');
  });
  it('VII in A minor = G', () => {
    expect(scaleDegreeToPC(Amin, 7, 0)).toBe('G');
  });
  it('all 7 degrees of D major', () => {
    const expected = ['D', 'E', 'Fs', 'G', 'A', 'B', 'Cs'];
    for (let deg = 1; deg <= 7; deg++) {
      expect(scaleDegreeToPC(Dmaj, deg, 0)).toBe(expected[deg - 1]);
    }
  });
  it('all 7 degrees of A minor', () => {
    const expected = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    for (let deg = 1; deg <= 7; deg++) {
      expect(scaleDegreeToPC(Amin, deg, 0)).toBe(expected[deg - 1]);
    }
  });
});

describe('pcToScaleDegree', () => {
  it('D in D major = degree 1, accidental 0', () => {
    expect(pcToScaleDegree(Dmaj, 'D')).toEqual({ degree: 1, accidental: 0 });
  });
  it('A in D major = degree 5, accidental 0', () => {
    expect(pcToScaleDegree(Dmaj, 'A')).toEqual({ degree: 5, accidental: 0 });
  });
  it('Gs (Ab) in D major = degree 5, accidental -1 (bV)', () => {
    expect(pcToScaleDegree(Dmaj, 'Gs')).toEqual({ degree: 5, accidental: -1 });
  });
  it('Ds (Eb) in C major = degree 3, accidental -1 (bIII)', () => {
    expect(pcToScaleDegree(Cmaj, 'Ds')).toEqual({ degree: 3, accidental: -1 });
  });
  it('Fs in C major = degree 4, accidental 1 (#IV)', () => {
    expect(pcToScaleDegree(Cmaj, 'Fs')).toEqual({ degree: 4, accidental: 1 });
  });
  it('C in A minor = degree 3, accidental 0', () => {
    expect(pcToScaleDegree(Amin, 'C')).toEqual({ degree: 3, accidental: 0 });
  });
});

describe('isSharpKey', () => {
  it('D major is sharp', () => {
    expect(isSharpKey(Dmaj)).toBe(true);
  });
  it('F major is flat', () => {
    expect(isSharpKey(Fmaj)).toBe(false);
  });
  it('C major is flat (default)', () => {
    expect(isSharpKey(Cmaj)).toBe(false);
  });
  it('F# major is sharp', () => {
    expect(isSharpKey(Fsmaj)).toBe(true);
  });
  it('Bb major is flat', () => {
    expect(isSharpKey(Bbmaj)).toBe(false);
  });
});

describe('pcToStandardName', () => {
  it('Cs in sharp key = C#', () => {
    expect(pcToStandardName('Cs', true)).toBe('C#');
  });
  it('Cs in flat key = Db', () => {
    expect(pcToStandardName('Cs', false)).toBe('Db');
  });
  it('Ds in sharp key = D#', () => {
    expect(pcToStandardName('Ds', true)).toBe('D#');
  });
  it('Ds in flat key = Eb', () => {
    expect(pcToStandardName('Ds', false)).toBe('Eb');
  });
  it('natural notes are unchanged', () => {
    expect(pcToStandardName('C', true)).toBe('C');
    expect(pcToStandardName('D', false)).toBe('D');
    expect(pcToStandardName('A', true)).toBe('A');
  });
  it('Fs always = F#', () => {
    expect(pcToStandardName('Fs', true)).toBe('F#');
    expect(pcToStandardName('Fs', false)).toBe('Gb');
  });
});