import type { PitchClass, ChordType, ChordSymbol, ParseResult } from '../types';
import { resolveRoot } from './parser';
import { pitchClassToInt, pitchClassFromInt, chordIntervals } from './musicTheory';

export function parseNoteName(input: string): PitchClass | null {
  if (input.length === 0 || input.length > 2) return null;
  const letter = input[0]!;
  if (!/[A-G]/.test(letter)) return null;
  const accidental = input.length === 2 ? input[1]! : null;
  if (accidental !== null && accidental !== '#' && accidental !== 'b') return null;
  return resolveRoot(letter, accidental);
}
