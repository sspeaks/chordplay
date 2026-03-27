import { CHORD_TYPES, type PitchClass, type ChordType, type ChordSymbol, type ParseResult } from '../types';
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

// Chord types eligible for reverse lookup (exclude 9th voicings that omit notes)
const LOOKUP_TYPES = CHORD_TYPES.filter(
  ct => !ct.startsWith('Dom9') && !ct.startsWith('Maj9') && !ct.startsWith('Min9')
);

const PRIORITY: ChordType[] = [
  'Maj7', 'Dom7', 'Min7', 'Maj6', 'Min6',
  'Dim7', 'HalfDim7', 'MinMaj7',
  'Major', 'Minor', 'Dim', 'Aug', 'Sus4', 'Sus2',
];

function normalizeIntervals(ct: ChordType): number[] {
  const raw = chordIntervals(ct);
  const mods = new Set(raw.map(i => ((i % 12) + 12) % 12));
  return [...mods].sort((a, b) => a - b);
}

interface ChordMatch {
  root: PitchClass;
  quality: ChordType;
  inversion: number;
}

export function identifyChord(pcs: PitchClass[]): ChordMatch | null {
  if (pcs.length !== 4) return null;

  const uniquePCs = [...new Set(pcs)];
  if (uniquePCs.length < 3) return null;

  const matches: ChordMatch[] = [];

  for (const candidateRoot of uniquePCs) {
    const rootInt = pitchClassToInt(candidateRoot);
    const intervals = uniquePCs
      .map(pc => ((pitchClassToInt(pc) - rootInt) % 12 + 12) % 12)
      .sort((a, b) => a - b);

    for (const ct of LOOKUP_TYPES) {
      const pattern = normalizeIntervals(ct);
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
