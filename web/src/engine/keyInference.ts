import { PITCH_CLASSES, type PitchClass, type ChordType, type ChordSymbol, type KeySignature } from '../types';
import { pitchClassToInt } from './musicTheory';

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10] as const;

const DEGREE_WEIGHTS: Record<number, number> = {
  1: 4, 2: 1, 3: 1, 4: 2, 5: 3, 6: 1, 7: 1,
};

function scaleContains(scaleRoot: number, scale: readonly number[], pc: number): number | null {
  const interval = ((pc - scaleRoot) % 12 + 12) % 12;
  const degree = scale.indexOf(interval);
  return degree !== -1 ? degree + 1 : null;
}

// Chord qualities that typically function as tonic chords
function isTonicMajorQuality(quality: ChordType): boolean {
  return quality === 'Major' || quality === 'Maj7' || quality === 'Maj6';
}

function isTonicMinorQuality(quality: ChordType): boolean {
  return quality === 'Minor' || quality === 'Min7' || quality === 'Min6' || quality === 'MinMaj7';
}

function scoreKey(chords: ChordSymbol[], root: PitchClass, quality: 'major' | 'minor'): number {
  const rootInt = pitchClassToInt(root);
  const scale = quality === 'major' ? MAJOR_SCALE : MINOR_SCALE;
  let score = 0;
  for (const chord of chords) {
    const pcInt = pitchClassToInt(chord.root);
    const degree = scaleContains(rootInt, scale, pcInt);
    if (degree !== null) {
      score += DEGREE_WEIGHTS[degree] ?? 1;

      // Bonus: tonic chord quality matching the key quality is strong evidence
      if (degree === 1) {
        if (quality === 'major' && isTonicMajorQuality(chord.quality)) {
          score += 2;
        } else if (quality === 'minor' && isTonicMinorQuality(chord.quality)) {
          score += 2;
        }
      }

      // Bonus: Dom7 on degree V is the strongest key indicator
      if (degree === 5 && chord.quality === 'Dom7') {
        score += 3;
      }
    }
  }
  return score;
}

const KEY_COMPLEXITY: Record<string, number> = {
  'C-major': 0, 'G-major': 1, 'F-major': 1, 'D-major': 2, 'As-major': 2,
  'A-major': 3, 'Ds-major': 3, 'E-major': 4, 'Gs-major': 4,
  'B-major': 5, 'Cs-major': 5, 'Fs-major': 6,
  'A-minor': 0, 'E-minor': 1, 'D-minor': 1, 'B-minor': 2, 'G-minor': 2,
  'Fs-minor': 3, 'C-minor': 3, 'Cs-minor': 4, 'F-minor': 4,
  'Gs-minor': 5, 'As-minor': 5, 'Ds-minor': 6,
};

export function inferKey(chords: ChordSymbol[]): KeySignature {
  if (chords.length === 0) {
    return { root: 'C', quality: 'major' };
  }

  let bestKey: KeySignature = { root: 'C', quality: 'major' };
  let bestScore = -1;
  let bestComplexity = Infinity;

  const qualities: ('major' | 'minor')[] = ['major', 'minor'];

  for (const root of PITCH_CLASSES) {
    for (const quality of qualities) {
      const score = scoreKey(chords, root, quality);
      const complexity = KEY_COMPLEXITY[`${root}-${quality}`] ?? 6;

      if (
        score > bestScore ||
        (score === bestScore && quality === 'major' && bestKey.quality === 'minor') ||
        (score === bestScore && quality === bestKey.quality && complexity < bestComplexity)
      ) {
        bestScore = score;
        bestKey = { root, quality };
        bestComplexity = complexity;
      }
    }
  }

  return bestKey;
}