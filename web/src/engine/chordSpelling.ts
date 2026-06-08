import {
  CHORD_TYPES,
  hasChordQuality,
  isSpelledChord,
  type PitchClass,
  type ChordType,
  type ChordSymbol,
  type ParseResult,
  type SpelledNote,
} from '../types';
import { pitchClassToInt, pitchClassFromInt, chordIntervals, resolveRoot } from './musicTheory';

export function parseNoteName(input: string): PitchClass | null {
  if (input.length === 0 || input.length > 2) return null;
  const letter = input[0]!;
  if (!/[A-G]/.test(letter)) return null;
  const accidental = input.length === 2 ? input[1]! : null;
  if (accidental !== null && accidental !== '#' && accidental !== 'b') return null;
  return resolveRoot(letter, accidental);
}

export function parseSpelledNoteToken(input: string): SpelledNote | null {
  const match = input.match(/^([A-G])([#b]?)(\d*)$/);
  if (!match) return null;

  const [, letter, accidental, octaveText] = match;
  const pitchClass = resolveRoot(letter!, accidental || null);
  if (pitchClass === null) return null;

  return {
    pitchClass,
    ...(octaveText !== '' ? { octave: Number.parseInt(octaveText!, 10) } : {}),
  };
}

// Chord types eligible for reverse lookup (exclude 9th voicings that omit notes)
const LOOKUP_TYPES = CHORD_TYPES.filter(
  ct => !ct.startsWith('Dom9') && !ct.startsWith('Maj9') && !ct.startsWith('Min9')
);

const PRIORITY: ChordType[] = [
  'Maj7', 'Dom7', 'Dom13', 'Min7', 'Maj6', 'Min6',
  'Dim7', 'HalfDim7', 'MinMaj7',
  'Major', 'Minor', 'Dim', 'Aug', 'Sus4', 'Sus2',
];

function normalizeIntervals(ct: ChordType): number[] {
  const raw = chordIntervals(ct);
  const mods = new Set(raw.map(i => ((i % 12) + 12) % 12));
  return [...mods].sort((a, b) => a - b);
}

// Precompute normalized interval patterns for all lookup types
const LOOKUP_PATTERNS = LOOKUP_TYPES.map(ct => ({
  type: ct,
  intervals: normalizeIntervals(ct),
}));

interface ChordMatch {
  root: PitchClass;
  quality: ChordType;
  inversion: number;
}

export function identifyChord(pcs: PitchClass[]): ChordMatch | null {
  if (pcs.length < 3 || pcs.length > 4) return null;

  const uniquePCs = [...new Set(pcs)];
  if (uniquePCs.length < 3) return null;

  const matches: ChordMatch[] = [];

  for (const candidateRoot of uniquePCs) {
    const rootInt = pitchClassToInt(candidateRoot);
    const intervals = uniquePCs
      .map(pc => ((pitchClassToInt(pc) - rootInt) % 12 + 12) % 12)
      .sort((a, b) => a - b);

    for (const { type: ct, intervals: pattern } of LOOKUP_PATTERNS) {
      if (intervals.length !== pattern.length) continue;
      if (intervals.every((v, i) => v === pattern[i])) {
        const firstPC = pcs[0]!;
        let inversion = 0;
        if (firstPC !== candidateRoot) {
          const chordPCOrder = pattern.map(
            interval => pitchClassFromInt(rootInt + interval)
          );
          const bassIdx = chordPCOrder.indexOf(firstPC);
          inversion = bassIdx >= 0 ? bassIdx : 0;
        }
        matches.push({ root: candidateRoot, quality: ct, inversion });
      }
    }
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (a.inversion === 0 && b.inversion !== 0) return -1;
    if (a.inversion !== 0 && b.inversion === 0) return 1;
    return PRIORITY.indexOf(a.quality) - PRIORITY.indexOf(b.quality);
  });

  return matches[0]!;
}

export function parseSpelledChord(input: string): ParseResult<ChordSymbol> {
  // Strip parentheses
  let inner = input.trim();
  if (!inner.startsWith('(') || !inner.endsWith(')')) {
    return { ok: false, error: 'Expected parenthesized notes' };
  }
  inner = inner.slice(1, -1);
  inner = inner.trim();

  if (inner.length === 0) {
    return { ok: false, error: 'Empty spelled chord' };
  }

  const noteTokens = inner.split(/\s+/);
  if (noteTokens.length > 4) {
    return { ok: false, error: `Expected 1 to 4 notes, got ${noteTokens.length}` };
  }

  const notes: SpelledNote[] = [];
  for (const token of noteTokens) {
    const note = parseSpelledNoteToken(token);
    if (note === null) {
      return { ok: false, error: `Invalid note: '${token}'` };
    }
    notes.push(note);
  }

  const pcs = notes.map(note => note.pitchClass);
  const match = notes.length >= 3 ? identifyChord(pcs) : null;

  if (match === null) {
    const warning = notes.length >= 3;
    return {
      ok: true,
      value: {
        kind: 'spelled',
        root: pcs[0]!,
        inversion: warning ? 0 : null,
        explicitVoicing: pcs,
        notes,
        ...(warning ? { warning: true } : {}),
      },
    };
  }

  return {
    ok: true,
    value: {
      kind: 'spelled',
      root: match.root,
      quality: match.quality,
      inversion: match.inversion,
      explicitVoicing: pcs,
      notes,
    },
  };
}

const QUALITY_DISPLAY: Record<ChordType, string> = {
  Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
  Dim: 'dim', Dim7: 'dim7', Aug: 'aug', HalfDim7: 'm7b5',
  Sus4: 'sus4', Sus2: 'sus2', MinMaj7: 'mMaj7', Maj6: '6', Min6: 'm6',
  Dom13: '13',
  Dom9no1: '9-1', Dom9no3: '9-3', Dom9no5: '9-5', Dom9no7: '9-7',
  Maj9no1: 'maj9-1', Maj9no3: 'maj9-3', Maj9no5: 'maj9-5', Maj9no7: 'maj9-7',
  Min9no1: 'm9-1', Min9no3: 'm9-3', Min9no5: 'm9-5', Min9no7: 'm9-7',
};

const PC_DISPLAY: Record<PitchClass, string> = {
  C: 'C', Cs: 'C♯', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'F♯', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};

function spelledNoteDisplay(note: SpelledNote): string {
  return `${PC_DISPLAY[note.pitchClass] ?? note.pitchClass}${note.octave ?? ''}`;
}

export function chordDisplayName(chord: ChordSymbol): string {
  if (chord.warning) return '?';
  if (isSpelledChord(chord)) {
    if (!hasChordQuality(chord)) {
      return chord.notes.map(spelledNoteDisplay).join(' ');
    }
    const root = PC_DISPLAY[chord.root] ?? chord.root;
    const quality = QUALITY_DISPLAY[chord.quality] ?? '';
    return `${root}${quality}`;
  }
  const root = PC_DISPLAY[chord.root] ?? chord.root;
  const quality = QUALITY_DISPLAY[chord.quality] ?? '';
  const bass = chord.bass !== undefined ? `/${PC_DISPLAY[chord.bass] ?? chord.bass}` : '';
  return `${root}${quality}${bass}`;
}
