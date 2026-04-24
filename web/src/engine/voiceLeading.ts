import type { Pitch, PitchClass, ChordSymbol, SmoothMode, VoiceLeadingOptions } from '../types';
import { pitchToMidi, midiToPitch, nearestPitch, voiceChord, chordPitchClasses, pitchClassToInt, slashChordPitchClasses, inversionBassPC } from './musicTheory';

export const GRAVITY_WEIGHT = 1.0;
export const SPREAD_WEIGHT = 2;
export const DEFAULT_GRAVITY_CENTER = 57;  // A3
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
 //const midiHigh = (octHigh + 1) * 12 + pcInt;

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

      // Heavily penalize same-octave doublings (unisons)
      const unisonPenalty = (placedMidis.length - new Set(placedMidis).size) * 1000;

      const cost = totalCost + clusterPenalty + spreadPenalty + gravityPenalty + unisonPenalty;

      if (cost < bestCost || (cost === bestCost && maxMove < bestMax)) {
        bestCost = cost;
        bestMax = maxMove;
        bestPlaced = placed;
      }
    }
  }

  return bestPlaced;
}

export function assignOctaves(pcs: PitchClass[], gravityCenter: number): Pitch[] {
  let bestPitches: Pitch[] = [];
  let bestDiff = Infinity;

  for (let startOct = 2; startOct <= 5; startOct++) {
    const pitches: Pitch[] = [];
    let prevMidi = -Infinity;

    for (const pc of pcs) {
      const pcInt = pitchClassToInt(pc);
      let midi = (startOct + 1) * 12 + pcInt;
      while (midi <= prevMidi) midi += 12;
      pitches.push(midiToPitch(midi));
      prevMidi = midi;
    }

    const mean = pitches.reduce((sum, p) => sum + pitchToMidi(p), 0) / pitches.length;
    const diff = Math.abs(mean - gravityCenter);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestPitches = pitches;
    }
  }

  return bestPitches;
}

function voiceSlashChord(
  chord: ChordSymbol,
  prevPitches: Pitch[] | null,
  mode: SmoothMode | null,
  options?: VoiceLeadingOptions,
): Pitch[] {
  const { gravityCenter = DEFAULT_GRAVITY_CENTER } = options ?? {};
  const pcs = slashChordPitchClasses(chord.root, chord.quality, chord.bass!);
  const bassPc = pcs[0]!;
  const upperPCs = pcs.slice(1);

  if (!prevPitches || mode === null) {
    // No previous chord or no voice leading: assign octaves ascending from bass
    const bassPitch = nearestPitch(bassPc, gravityCenter - 12);
    const bassMidi = pitchToMidi(bassPitch);
    const upper = upperPCs.map((pc, i) => {
      const target = bassMidi + 4 + i * 4;
      const p = nearestPitch(pc, target);
      let midi = pitchToMidi(p);
      if (midi <= bassMidi) midi += 12;
      return midiToPitch(midi);
    });
    return [bassPitch, ...upper];
  }

  // With voice leading: pin bass, smooth upper 3
  const prevSorted = [...prevPitches].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
  const prevBassMidi = pitchToMidi(prevSorted[0]!);
  const bassPitch = nearestPitch(bassPc, prevBassMidi);
  const bassMidi = pitchToMidi(bassPitch);

  const prevUpper = prevSorted.slice(1);
  const smoothed = smoothVoice(mode, prevUpper, upperPCs, options);

  // Ensure all upper voices are above bass
  const result = smoothed.map(p => {
    let midi = pitchToMidi(p);
    if (midi <= bassMidi) midi += 12;
    return midiToPitch(midi);
  });

  return [bassPitch, ...result];
}

export function voiceChordSequence(
  mode: SmoothMode | null,
  chords: ChordSymbol[],
  options?: VoiceLeadingOptions,
): Pitch[][] {
  if (chords.length === 0) return [];
  const { gravityCenter = DEFAULT_GRAVITY_CENTER } = options ?? {};

  function voiceExplicit(chord: ChordSymbol): Pitch[] {
    return assignOctaves(chord.explicitVoicing!, gravityCenter);
  }

  if (mode === null) {
    return chords.map(c => {
      if (c.explicitVoicing) return voiceExplicit(c);
      if (c.bass !== undefined) return voiceSlashChord(c, null, null, options);
      const voicing = voiceChord(c.root, c.quality, c.inversion ?? 0);
      const shift = (c.octaveShift ?? 0) * 12;
      if (shift === 0) return voicing;
      return voicing.map(p => midiToPitch(pitchToMidi(p) + shift));
    });
  }

  const first = chords[0]!;
  const firstGravity = gravityCenter + (first.octaveShift ?? 0) * 12;
  let firstVoicing: Pitch[];
  if (first.bass !== undefined) {
    firstVoicing = voiceSlashChord(first, null, null, options);
  } else if (first.explicitVoicing) {
    firstVoicing = voiceExplicit(first);
  } else {
    const baseVoicing = voiceChord(first.root, first.quality, first.inversion ?? 0);
    const baseMidis = baseVoicing.map(pitchToMidi);
    const baseCentroid = baseMidis.reduce((a, b) => a + b, 0) / baseMidis.length;
    const shiftSemitones = Math.round((firstGravity - baseCentroid) / 12) * 12;
    firstVoicing = shiftSemitones === 0
      ? baseVoicing
      : baseVoicing.map(p => midiToPitch(pitchToMidi(p) + shiftSemitones));
  }

  const result: Pitch[][] = [firstVoicing];

  let prev = firstVoicing;
  for (let i = 1; i < chords.length; i++) {
    const chord = chords[i]!;
    const chordGravity = gravityCenter + (chord.octaveShift ?? 0) * 12;
    const chordOptions = { ...options, gravityCenter: chordGravity };
    let voicing: Pitch[];
    if (chord.explicitVoicing) {
      voicing = voiceExplicit(chord);
    } else if (chord.bass !== undefined) {
      voicing = voiceSlashChord(chord, prev, mode, chordOptions);
    } else if (chord.inversion !== null) {
      voicing = voiceWithConstrainedBass(mode, prev, chord, chordOptions);
    } else {
      voicing = smoothVoice(mode, prev, chordPitchClasses(chord.root, chord.quality), chordOptions);
    }

    // Octave shift: force whole-octave correction toward shifted gravity
    if (chord.octaveShift) {
      const midis = voicing.map(pitchToMidi);
      const centroid = midis.reduce((a, b) => a + b, 0) / midis.length;
      const shift = Math.round((chordGravity - centroid) / 12) * 12;
      if (shift !== 0) {
        voicing = voicing.map(p => midiToPitch(pitchToMidi(p) + shift));
      }
    }

    result.push(voicing);
    prev = voicing;
  }

  return result;
}

function voiceWithConstrainedBass(
  _mode: SmoothMode,
  prev: Pitch[],
  chord: ChordSymbol,
  options?: VoiceLeadingOptions,
): Pitch[] {
  const allPCs = chordPitchClasses(chord.root, chord.quality);
  const inv = Math.max(0, Math.min(allPCs.length - 1, chord.inversion!));
  const bassPC = inversionBassPC(chord.root, chord.quality, inv);

  // Split previous voicing into bass + upper
  const prevSorted = [...prev].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
  const prevBass = prevSorted[0]!;
  const prevUpper = prevSorted.slice(1);

  // Upper pitch classes: remove the bass PC from the chord's pitch classes
  const upperPCs = [...allPCs.slice(0, inv), ...allPCs.slice(inv + 1)];

  // Optimize upper 3 voices (always use equal weights — bass handled separately)
  const upper = smoothVoice('equal', prevUpper, upperPCs, options);

  // Place bass near previous bass
  let bass = nearestPitch(bassPC, pitchToMidi(prevBass));
  let bassMidi = pitchToMidi(bass);

  // Ensure bass is strictly below all upper voices
  const lowestUpperMidi = Math.min(...upper.map(pitchToMidi));
  while (bassMidi >= lowestUpperMidi) bassMidi -= 12;
  bass = midiToPitch(bassMidi);

  return [bass, ...upper].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
}
