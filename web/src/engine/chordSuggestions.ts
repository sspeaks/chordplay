import {
  PITCH_CLASSES,
  type PitchClass,
  type ChordType,
  type ChordSymbol,
  type KeySignature,
  type ParseResult,
} from '../types';
import { pitchClassToInt, pitchClassFromInt, chordIntervals } from './musicTheory';

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10] as const;

const SUGGESTION_QUALITIES: ChordType[] = ['Major', 'Minor', 'Dom7', 'Maj7', 'Min7'];

const ROOT_DISPLAY: Record<PitchClass, string> = {
  C: 'C', Cs: 'C#', D: 'D', Ds: 'Eb', E: 'E', F: 'F',
  Fs: 'F#', G: 'G', Gs: 'Ab', A: 'A', As: 'Bb', B: 'B',
};

const QUALITY_SUFFIX: Record<ChordType, string> = {
  Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
  Dim: 'dim', Dim7: 'dim7', Aug: 'aug', HalfDim7: 'm7b5',
  Sus4: 'sus4', Sus2: 'sus2', MinMaj7: 'mMaj7', Maj6: '6', Min6: 'm6',
  Dom13: '13',
  Dom9no1: '9-1', Dom9no3: '9-3', Dom9no5: '9-5', Dom9no7: '9-7',
  Maj9no1: 'maj9-1', Maj9no3: 'maj9-3', Maj9no5: 'maj9-5', Maj9no7: 'maj9-7',
  Min9no1: 'm9-1', Min9no3: 'm9-3', Min9no5: 'm9-5', Min9no7: 'm9-7',
};

export interface ScoredSuggestion {
  chord: ChordSymbol;
  text: string;
  score: number;
}

function getScaleIntervals(quality: 'major' | 'minor'): readonly number[] {
  return quality === 'major' ? MAJOR_SCALE : MINOR_SCALE;
}

function isDiatonic(pc: PitchClass, key: KeySignature): boolean {
  const rootInt = pitchClassToInt(key.root);
  const pcInt = pitchClassToInt(pc);
  const interval = ((pcInt - rootInt) % 12 + 12) % 12;
  return getScaleIntervals(key.quality).includes(interval);
}

export function chordSymbolToText(chord: ChordSymbol): string {
  return ROOT_DISPLAY[chord.root] + QUALITY_SUFFIX[chord.quality];
}

export function scoreChord(
  current: ChordSymbol,
  candidate: ChordSymbol,
  key: KeySignature,
): number {
  let score = 0;
  const curRoot = pitchClassToInt(current.root);
  const candRoot = pitchClassToInt(candidate.root);

  // 1. Circle-of-fifths resolution (0–35 pts)
  const fifthDown = ((curRoot - candRoot) % 12 + 12) % 12;
  if (fifthDown === 7) {
    score += 35;
  }
  // Tritone substitution
  const fifthTarget = ((curRoot - 7) % 12 + 12) % 12;
  const tritoneFromTarget = ((candRoot - fifthTarget) % 12 + 12) % 12;
  if (tritoneFromTarget === 6 && fifthDown !== 7) {
    score += 15;
  }

  // 2. Seventh resolution (0–30 pts)
  const curIntervals = chordIntervals(current.quality);
  const has7th = curIntervals.some(i => {
    const normalized = ((i % 12) + 12) % 12;
    return normalized === 10 || normalized === 11;
  });
  if (has7th) {
    const seventh = curIntervals.find(i => {
      const n = ((i % 12) + 12) % 12;
      return n === 10 || n === 11;
    })!;
    const seventhPC = (curRoot + seventh) % 12;
    const resolvedPC = ((seventhPC - 1) % 12 + 12) % 12;
    const candIntervals = chordIntervals(candidate.quality);
    const candPCs = candIntervals.map(i => ((candRoot + i) % 12 + 12) % 12);
    if (candPCs.includes(resolvedPC)) {
      score += 30;
    }
  }

  // 3. Diatonic membership (0–20 pts)
  if (isDiatonic(candidate.root, key)) {
    score += 20;
  }

  // 4. Secondary dominant potential (0–15 pts)
  if (candidate.quality === 'Dom7') {
    const targetRoot = pitchClassFromInt((candRoot - 7 + 12) % 12);
    if (isDiatonic(targetRoot, key)) {
      score += 15;
    }
  }

  // 5. Same-root quality change (0–15 pts)
  if (current.root === candidate.root && current.quality !== candidate.quality) {
    score += 15;
  }

  return score;
}

export function generateSuggestions(
  current: ChordSymbol,
  key: KeySignature,
): ScoredSuggestion[] {
  const candidates: ScoredSuggestion[] = [];

  for (const root of PITCH_CLASSES) {
    for (const quality of SUGGESTION_QUALITIES) {
      if (root === current.root && quality === current.quality) continue;
      const candidate: ChordSymbol = { root, quality, inversion: null };
      const score = scoreChord(current, candidate, key);
      candidates.push({ chord: candidate, text: chordSymbolToText(candidate), score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const minCount = 5;
  const maxCount = 10;
  if (candidates.length <= minCount) return candidates;

  const cutoffScore = candidates[minCount - 1]!.score;
  let count = minCount;
  while (count < maxCount && count < candidates.length && candidates[count]!.score === cutoffScore) {
    count++;
  }
  return candidates.slice(0, count);
}

/**
 * Insert chord text after the valid-chord at `afterValidIndex`.
 * Uses parseResults to skip invalid tokens (currentChordIndex counts only valid chords).
 */
export function insertChordAfterIndex(
  chordText: string,
  afterValidIndex: number,
  newChordText: string,
  parseResults: ParseResult<any>[],
): string {
  const parts = chordText.split(/(\s+)/);
  let tokenIdx = 0;
  let validIdx = 0;
  let charPos = 0;

  for (const part of parts) {
    if (/^\s*$/.test(part)) {
      charPos += part.length;
      continue;
    }
    const isValid = parseResults[tokenIdx]?.ok ?? false;
    if (isValid) {
      if (validIdx === afterValidIndex) {
        const insertPos = charPos + part.length;
        return chordText.slice(0, insertPos) + ' ' + newChordText + chordText.slice(insertPos);
      }
      validIdx++;
    }
    tokenIdx++;
    charPos += part.length;
  }

  return chordText + ' ' + newChordText;
}