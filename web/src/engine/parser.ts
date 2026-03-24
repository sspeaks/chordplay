import type { PitchClass, ChordType, ChordSymbol, ParseResult } from '../types';

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

  // Parse quality from remaining string
  const rest = trimmed.slice(pos);
  const quality = parseQuality(rest);
  if (quality === null) {
    return { ok: false, error: `Unknown quality: '${rest}'` };
  }

  return { ok: true, value: { root, quality, inversion } };
}

export function parseChordSequence(input: string): ParseResult<ChordSymbol>[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];
  const tokens = trimmed.split(/\s+/);
  return tokens.map(parseChord);
}

function resolveRoot(letter: string, accidental: string | null): PitchClass | null {
  const key = letter + (accidental ?? '');
  const MAP: Record<string, PitchClass> = {
    'C': 'C', 'C#': 'Cs',
    'D': 'D', 'Db': 'Cs', 'D#': 'Ds',
    'E': 'E', 'Eb': 'Ds',
    'F': 'F',
    'G': 'G', 'F#': 'Fs', 'Gb': 'Fs', 'G#': 'Gs',
    'A': 'A', 'Ab': 'Gs', 'A#': 'As',
    'B': 'B', 'Bb': 'As',
  };
  return MAP[key] ?? null;
}

// Quality parser — order matters! Try longest/most specific first.
// Matches the Haskell parser's try ordering exactly.
export function parseQuality(s: string): ChordType | null {
  const QUALITIES: [string, ChordType][] = [
    ['mMaj7', 'MinMaj7'],
    ['maj7', 'Maj7'],
    ['maj', 'Major'],
    ['dim7b5', 'HalfDim7'],
    ['dim7', 'Dim7'],
    ['dim', 'Dim'],
    ['m7b5', 'HalfDim7'],
    ['m7', 'Min7'],
    ['m6', 'Min6'],
    ['min', 'Minor'],
    ['m', 'Minor'],
    ['aug', 'Aug'],
    ['+', 'Aug'],
    ['sus4', 'Sus4'],
    ['sus2', 'Sus2'],
    ['9', 'Dom9'],
    ['7', 'Dom7'],
    ['6', 'Maj6'],
  ];
  for (const [suffix, quality] of QUALITIES) {
    if (s === suffix) return quality;
  }
  if (s === '') return 'Major';
  return null;
}