import type { ChordType, ChordSymbol, ParseResult, PitchClass } from '../types';
import { parseSpelledChord } from './chordSpelling';
import { resolveRoot } from './musicTheory';

export function tokenizeChordInput(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] === '(') {
      const end = input.indexOf(')', i);
      if (end === -1) {
        // Unclosed paren — take rest as single token
        tokens.push(input.slice(i));
        break;
      }
      tokens.push(input.slice(i, end + 1));
      i = end + 1;
    } else if (/\s/.test(input[i]!)) {
      let j = i;
      while (j < input.length && /\s/.test(input[j]!)) j++;
      tokens.push(input.slice(i, j));
      i = j;
    } else {
      let j = i;
      while (j < input.length && !/[\s(]/.test(input[j]!)) j++;
      tokens.push(input.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

export function parseChord(input: string): ParseResult<ChordSymbol> {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Empty input' };
  }

  let pos = 0;

  // Parse optional inversion prefix: [-]digit
  let inversion: number | null = null;
  if (pos < trimmed.length) {
    const negMatch = trimmed.slice(pos).match(/^(-?\d)/);
    if (negMatch) {
      // Only if followed by a letter A-G (otherwise "9" might be a quality)
      const afterDigits = pos + negMatch[0].length;
      if (afterDigits < trimmed.length && /[A-G]/.test(trimmed[afterDigits]!)) {
        inversion = parseInt(negMatch[0], 10);
        pos = afterDigits;
      }
    }
  }

  // Parse root: letter + optional accidental
  if (pos >= trimmed.length || !/[A-G]/.test(trimmed[pos]!)) {
    return { ok: false, error: `Expected root note (A-G), got '${trimmed[pos] ?? 'end of input'}'` };
  }
  const letter = trimmed[pos]!;
  pos++;

  let accidental: string | null = null;
  if (pos < trimmed.length && (trimmed[pos] === '#' || trimmed[pos] === 'b')) {
    accidental = trimmed[pos]!;
    pos++;
  }

  const root = resolveRoot(letter, accidental);
  if (root === null) {
    return { ok: false, error: `Invalid note: ${letter}${accidental ?? ''}` };
  }

  // Parse remaining string: strip octave shift, then slash bass, then quality
  const rest = trimmed.slice(pos);

  // Strip trailing ^ or _ for octave shift (before slash bass check)
  const shiftMatch = rest.match(/([_^]+)$/);
  const afterShift = shiftMatch ? rest.slice(0, -shiftMatch[1]!.length) : rest;

  let octaveShift: number | undefined;
  if (shiftMatch) {
    const chars = shiftMatch[1]!;
    const hasUp = chars.includes('^');
    const hasDown = chars.includes('_');
    if (hasUp && hasDown) {
      return { ok: false, error: "Cannot mix ^ and _ in octave shift" };
    }
    octaveShift = hasUp ? chars.length : -chars.length;
  }

  // Check for slash bass: /[A-G][#b]? at end of remaining string
  let qualityStr = afterShift;
  let bass: PitchClass | undefined;

  const slashMatch = afterShift.match(/\/([A-G][#b]?)$/);
  if (slashMatch) {
    qualityStr = afterShift.slice(0, slashMatch.index);
    const bassLetter = slashMatch[1]![0]!;
    const bassAccidental = slashMatch[1]!.length > 1 ? slashMatch[1]![1]! : null;
    const bassPC = resolveRoot(bassLetter, bassAccidental);
    if (bassPC === null) {
      return { ok: false, error: `Invalid bass note: ${slashMatch[1]}` };
    }
    bass = bassPC;
  }

  const quality = parseQuality(qualityStr);
  if (quality === null) {
    return { ok: false, error: `Unknown quality: '${qualityStr}'` };
  }

  // Slash overrides inversion
  const finalInversion = bass !== undefined ? null : inversion;

  return {
    ok: true,
    value: {
      root,
      quality,
      inversion: finalInversion,
      ...(bass !== undefined && { bass }),
      ...(octaveShift !== undefined ? { octaveShift } : {}),
    },
  };
}

export function parseChordSequence(input: string): ParseResult<ChordSymbol>[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];
  const tokens = tokenizeChordInput(trimmed).filter(t => !/^\s+$/.test(t));
  return tokens.map(token =>
    token.startsWith('(') ? parseSpelledChord(token) : parseChord(token)
  );
}

// Quality parser — order matters! Try longest/most specific first.
// Matches the Haskell parser's try ordering exactly.
export function parseQuality(s: string): ChordType | null {
  const QUALITIES: [string, ChordType][] = [
    ['mMaj7', 'MinMaj7'],
    // 9th chords — longest first to avoid prefix collisions
    ['maj9-1', 'Maj9no1'],
    ['maj9-3', 'Maj9no3'],
    ['maj9-5', 'Maj9no5'],
    ['maj9-7', 'Maj9no7'],
    ['maj7', 'Maj7'],
    ['maj', 'Major'],
    ['madd9', 'Min9no7'],
    ['dim7b5', 'HalfDim7'],
    ['dim7', 'Dim7'],
    ['dim', 'Dim'],
    ['m9-1', 'Min9no1'],
    ['m9-3', 'Min9no3'],
    ['m9-5', 'Min9no5'],
    ['m9-7', 'Min9no7'],
    ['m7b5', 'HalfDim7'],
    ['m7', 'Min7'],
    ['m6', 'Min6'],
    ['min', 'Minor'],
    ['m', 'Minor'],
    ['aug', 'Aug'],
    ['+', 'Aug'],
    ['sus4', 'Sus4'],
    ['sus2', 'Sus2'],
    ['add9', 'Dom9no7'],
    ['9-1', 'Dom9no1'],
    ['9-3', 'Dom9no3'],
    ['9-5', 'Dom9no5'],
    ['9-7', 'Dom9no7'],
    ['13', 'Dom13'],
    ['7', 'Dom7'],
    ['6', 'Maj6'],
  ];
  for (const [suffix, quality] of QUALITIES) {
    if (s === suffix) return quality;
  }
  if (s === '') return 'Major';
  return null;
}