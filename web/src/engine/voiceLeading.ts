import type { Pitch, PitchClass, ChordSymbol, SmoothMode, VoiceLeadingOptions } from '../types';
import { pitchToMidi, midiToPitch, nearestPitch, voiceChord, chordPitchClasses, pitchClassToInt, chordIntervals } from './musicTheory';

export const GRAVITY_WEIGHT = 1.0;
export const SPREAD_WEIGHT = 2;
export const DEFAULT_GRAVITY_CENTER = 55;  // G3
export const DEFAULT_TARGET_SPREAD = 12;   // 1 octave

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

// For each pitch class and target, return both the nearest octave and the
// adjacent octave closer to the gravity center, giving the cost function
// two candidates to choose from per voice.
function nearestTwoPitches(pc: PitchClass, targetMidi: number, gravityCenter: number): Pitch[] {
  const pcInt = pitchClassToInt(pc);
  const octFloat = (targetMidi - pcInt) / 12.0 - 1.0;
  const octLow = Math.floor(octFloat);
  const octHigh = Math.ceil(octFloat);
  const midiLow = (octLow + 1) * 12 + pcInt;
  const midiHigh = (octHigh + 1) * 12 + pcInt;

  const nearest = nearestPitch(pc, targetMidi);
  const nearestMidi = pitchToMidi(nearest);

  // The "other" octave is whichever of low/high wasn't chosen as nearest
  const otherOct = (nearestMidi === midiLow) ? octHigh : octLow;
  const other: Pitch = { pitchClass: pc, octave: otherOct };
  const otherMidi = pitchToMidi(other);

  // Only include the alternative if it's closer to gravity than nearest
  if (Math.abs(otherMidi - gravityCenter) < Math.abs(nearestMidi - gravityCenter)) {
    return [nearest, other];
  }
  return [nearest];
}

// Generate all combinations from arrays of candidates per voice slot.
// Each slot has 1-2 candidates; produces up to 2^4 = 16 combinations.
function cartesian(candidates: Pitch[][]): Pitch[][] {
  if (candidates.length === 0) return [[]];
  const [first, ...rest] = candidates;
  const restCombos = cartesian(rest);
  const result: Pitch[][] = [];
  for (const f of first!) {
    for (const r of restCombos) {
      result.push([f, ...r]);
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
    // For each voice slot, get 1-2 candidate placements
    const candidates = perm.map((pc, i) => nearestTwoPitches(pc, prevMidis[i]!, gravityCenter));
    const placements = cartesian(candidates);

    for (const placed of placements) {
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

  const { gravityCenter = DEFAULT_GRAVITY_CENTER } = options ?? {};

  const first = chords[0]!;
  const baseVoicing = voiceChord(first.root, first.quality, first.inversion ?? 0);

  // Shift first voicing toward gravity center
  const baseMidis = baseVoicing.map(pitchToMidi);
  const baseCentroid = baseMidis.reduce((a, b) => a + b, 0) / baseMidis.length;
  const shiftSemitones = Math.round((gravityCenter - baseCentroid) / 12) * 12;
  const firstVoicing = shiftSemitones === 0
    ? baseVoicing
    : baseVoicing.map(p => midiToPitch(pitchToMidi(p) + shiftSemitones));

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