import type { PitchClass, ChordType, ChordSymbol, ParseResult, KeySignature } from '../types';
import { parseQuality, tokenizeChordInput } from './parser';
import { scaleDegreeToPC, parseRomanNumeral } from './romanNumerals';
import { parseSpelledChord } from './chordSpelling';
import { resolveRoot } from './musicTheory';

export function parseRomanChord(input: string, key: KeySignature): ParseResult<ChordSymbol> {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Empty input' };
  }

  let pos = 0;

  let inversion: number | null = null;
  const invMatch = trimmed.match(/^(-?\d)/);
  if (invMatch) {
    const afterDigits = invMatch[0].length;
    if (afterDigits < trimmed.length && /[#bIiVv]/.test(trimmed[afterDigits]!)) {
      inversion = parseInt(invMatch[0], 10);
      pos = afterDigits;
    }
  }

  let accidental = 0;
  if (pos < trimmed.length && trimmed[pos] === '#') {
    accidental = 1;
    pos++;
  } else if (pos < trimmed.length && trimmed[pos] === 'b') {
    accidental = -1;
    pos++;
  }

  const numeralResult = parseRomanNumeral(trimmed.slice(pos));
  if (!numeralResult) {
    return { ok: false, error: `Expected Roman numeral (I-VII), got '${trimmed.slice(pos)}'` };
  }

  const { degree, upper, rest } = numeralResult;

  const slashIdx = rest.indexOf('/');
  let qualityStr: string;
  let secondaryTarget: string | null = null;
  let slashBass: PitchClass | undefined;

  if (slashIdx !== -1) {
    qualityStr = rest.slice(0, slashIdx);
    const afterSlash = rest.slice(slashIdx + 1);

    // Check if it's a letter name (slash chord bass) vs Roman numeral (secondary dominant)
    const bassMatch = afterSlash.match(/^([A-G][#b]?)$/);
    if (bassMatch) {
      const bassLetter = bassMatch[1]![0]!;
      const bassAcc = bassMatch[1]!.length > 1 ? bassMatch[1]![1]! : null;
      const bassPC = resolveRoot(bassLetter, bassAcc);
      if (bassPC === null) {
        return { ok: false, error: `Invalid bass note: '${afterSlash}'` };
      }
      slashBass = bassPC;
    } else {
      secondaryTarget = afterSlash;
    }
  } else {
    qualityStr = rest;
  }

  let quality: ChordType;
  if (qualityStr === '') {
    quality = upper ? 'Major' : 'Minor';
  } else {
    const parsed = parseQuality(qualityStr);
    if (parsed === null) {
      return { ok: false, error: `Unknown quality: '${qualityStr}'` };
    }
    quality = parsed;
  }

  let root: PitchClass;
  if (secondaryTarget) {
    let targetPos = 0;
    let targetAccidental = 0;
    if (secondaryTarget[0] === '#') {
      targetAccidental = 1;
      targetPos = 1;
    } else if (secondaryTarget[0] === 'b') {
      targetAccidental = -1;
      targetPos = 1;
    }
    const targetResult = parseRomanNumeral(secondaryTarget.slice(targetPos));
    if (!targetResult || targetResult.rest !== '') {
      return { ok: false, error: `Invalid secondary target: '${secondaryTarget}'` };
    }
    const targetPC = scaleDegreeToPC(key, targetResult.degree, targetAccidental);
    const tempKey: KeySignature = { root: targetPC, quality: 'major' };
    root = scaleDegreeToPC(tempKey, degree, accidental);
  } else {
    root = scaleDegreeToPC(key, degree, accidental);
  }

  return { ok: true, value: { root, quality, inversion, ...(slashBass !== undefined && { bass: slashBass }) } };
}

export function parseRomanSequence(input: string, key: KeySignature): ParseResult<ChordSymbol>[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];
  const tokens = tokenizeChordInput(trimmed).filter(t => !/^\s+$/.test(t));
  return tokens.map(token =>
    token.startsWith('(') ? parseSpelledChord(token) : parseRomanChord(token, key)
  );
}