import type { Pitch, PitchClass, ChordSymbol, SmoothMode, VoiceLeadingOptions } from '../types';
import { pitchToMidi, nearestPitch, voiceChord, chordPitchClasses } from './musicTheory';

export const GRAVITY_WEIGHT = 0.3;
export const SPREAD_WEIGHT = 2;
export const DEFAULT_GRAVITY_CENTER = 55;  // G3
export const DEFAULT_TARGET_SPREAD = 18;   // 1.5 octaves

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i]!, ...perm]);
    }
  }
  return result;
}

export function smoothVoice(
  mode: SmoothMode,
  prevPitches: Pitch[],
  nextPCs: PitchClass[],
  options?: VoiceLeadingOptions,
): Pitch[] {
  const { gravityCenter = DEFAULT_GRAVITY_CENTER, targetSpread = DEFAULT_TARGET_SPREAD } = options ?? {};

  const sorted = [...prevPitches].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
  const prevMidis = sorted.map(pitchToMidi);
  const weights = mode === 'bass' ? [2, 1, 1, 1] : [1, 1, 1, 1];

  const perms = permutations(nextPCs);

  let bestCost = Infinity;
  let bestMax = Infinity;
  let bestPlaced: Pitch[] = sorted;

  for (const perm of perms) {
    const placed = perm.map((pc, i) => nearestPitch(pc, prevMidis[i]!));
    const placedMidis = placed.map(pitchToMidi);
    const movements = prevMidis.map((pm, i) => Math.abs(pm - placedMidis[i]!));
    const totalCost = movements.reduce((sum, m, i) => sum + m * weights[i]!, 0);
    const maxMove = Math.max(...movements);

    const sortedMidis = [...placedMidis].sort((a, b) => a - b);
    const gaps = sortedMidis.slice(1).map((m, i) => m - sortedMidis[i]!);
    const clusterPenalty = 12 * gaps.filter(g => g === 1).length;

    const actualSpread = sortedMidis[sortedMidis.length - 1]! - sortedMidis[0]!;
    const spreadPenalty = SPREAD_WEIGHT * Math.abs(actualSpread - targetSpread);

    const centroid = placedMidis.reduce((a, b) => a + b, 0) / placedMidis.length;
    const gravityPenalty = GRAVITY_WEIGHT * Math.abs(centroid - gravityCenter);

    const cost = totalCost + clusterPenalty + spreadPenalty + gravityPenalty;

    if (cost < bestCost || (cost === bestCost && maxMove < bestMax)) {
      bestCost = cost;
      bestMax = maxMove;
      bestPlaced = placed;
    }
  }

  return bestPlaced;
}

export function voiceChordSequence(
  mode: SmoothMode | null,
  chords: ChordSymbol[],
  options?: VoiceLeadingOptions,
): Pitch[][] {
  if (chords.length === 0) return [];

  if (mode === null) {
    return chords.map(c => voiceChord(c.root, c.quality, c.inversion ?? 0));
  }

  const first = chords[0]!;
  const firstVoicing = voiceChord(first.root, first.quality, first.inversion ?? 0);
  const result: Pitch[][] = [firstVoicing];

  let prev = firstVoicing;
  for (let i = 1; i < chords.length; i++) {
    const chord = chords[i]!;
    let voicing: Pitch[];
    if (chord.inversion !== null) {
      voicing = voiceChord(chord.root, chord.quality, chord.inversion);
    } else {
      voicing = smoothVoice(mode, prev, chordPitchClasses(chord.root, chord.quality), options);
    }
    result.push(voicing);
    prev = voicing;
  }

  return result;
}