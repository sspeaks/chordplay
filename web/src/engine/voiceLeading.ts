import {
  isSpelledChord,
  type Pitch,
  type PitchClass,
  type ChordSymbol,
  type SmoothMode,
  type VoiceLeadingOptions,
  type SpelledNote,
  type StandardChordSymbol,
} from '../types';
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
  if (prevPitches.length !== nextPCs.length || nextPCs.length === 0) {
    return assignOctaves(nextPCs, gravityCenter);
  }

  const sorted = [...prevPitches].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
  const prevMidis = sorted.map(pitchToMidi);
  const weights = nextPCs.map((_, idx) => mode === 'bass' && idx === 0 ? 2 : 1);

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

function pitchFromSpelledNote(note: SpelledNote): Pitch {
  return { pitchClass: note.pitchClass, octave: note.octave! };
}

function candidatePitchesAround(pc: PitchClass, targetMidi: number): Pitch[] {
  const nearest = nearestPitch(pc, targetMidi);
  const octaves = new Set<number>();
  for (let delta = -2; delta <= 2; delta++) {
    octaves.add(nearest.octave + delta);
  }
  return [...octaves]
    .map(octave => ({ pitchClass: pc, octave }))
    .sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
}

export function assignSpelledPitches(
  notes: readonly SpelledNote[],
  options?: VoiceLeadingOptions,
): Pitch[] {
  const { gravityCenter = DEFAULT_GRAVITY_CENTER, targetSpread = DEFAULT_TARGET_SPREAD } = options ?? {};
  if (notes.length === 0) return [];

  if (notes.every(note => note.octave !== undefined)) {
    return notes.map(pitchFromSpelledNote);
  }

  if (notes.every(note => note.octave === undefined)) {
    return assignOctaves(notes.map(note => note.pitchClass), gravityCenter);
  }

  const anchors = notes
    .filter((note): note is SpelledNote & { readonly octave: number } => note.octave !== undefined)
    .map(pitchFromSpelledNote);
  const anchorMidis = anchors.map(pitchToMidi);
  const anchorCentroid = anchorMidis.reduce((sum, midi) => sum + midi, 0) / anchorMidis.length;
  const desiredSpread = Math.min(targetSpread, DEFAULT_TARGET_SPREAD);

  const candidates = notes.map(note =>
    note.octave !== undefined
      ? [pitchFromSpelledNote(note)]
      : candidatePitchesAround(note.pitchClass, anchorCentroid)
  );

  let best: Pitch[] = [];
  let bestCost = Infinity;
  let bestSpread = Infinity;

  for (const placed of cartesian(candidates)) {
    const midis = placed.map(pitchToMidi);
    let orderPenalty = 0;
    for (let i = 1; i < midis.length; i++) {
      if (midis[i]! <= midis[i - 1]!) {
        orderPenalty += 100000 + (midis[i - 1]! - midis[i]! + 1) * 1000;
      }
    }

    const low = Math.min(...midis);
    const high = Math.max(...midis);
    const spread = high - low;
    const centroid = midis.reduce((sum, midi) => sum + midi, 0) / midis.length;
    const unisonPenalty = (midis.length - new Set(midis).size) * 1000000;
    const spreadPenalty = Math.abs(spread - desiredSpread) * 4;
    const anchorPenalty = Math.abs(centroid - anchorCentroid) * 2;
    const gravityPenalty = Math.abs(centroid - gravityCenter);
    const distancePenalty = midis.reduce((sum, midi) => sum + Math.abs(midi - anchorCentroid), 0) * 0.1;
    const cost = orderPenalty + unisonPenalty + spreadPenalty + anchorPenalty + gravityPenalty + distancePenalty;

    if (cost < bestCost || (cost === bestCost && spread < bestSpread)) {
      bestCost = cost;
      bestSpread = spread;
      best = placed;
    }
  }

  return best;
}

function hasBass(chord: StandardChordSymbol): chord is StandardChordSymbol & { readonly bass: PitchClass } {
  return chord.bass !== undefined;
}

function voiceSlashChord(
  chord: StandardChordSymbol & { readonly bass: PitchClass },
  prevPitches: Pitch[] | null,
  mode: SmoothMode | null,
  options?: VoiceLeadingOptions,
): Pitch[] {
  const { gravityCenter = DEFAULT_GRAVITY_CENTER } = options ?? {};
  const pcs = slashChordPitchClasses(chord.root, chord.quality, chord.bass);
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

  function voiceExplicit(chord: StandardChordSymbol, chordGravity: number): Pitch[] {
    return assignOctaves(chord.explicitVoicing!, chordGravity);
  }

  if (mode === null) {
    return chords.map(c => {
      if (isSpelledChord(c)) return assignSpelledPitches(c.notes, options);
      const chordGravity = gravityCenter + (c.octaveShift ?? 0) * 12;
      if (c.explicitVoicing) return voiceExplicit(c, chordGravity);
      if (hasBass(c)) return voiceSlashChord(c, null, null, options);
      const voicing = voiceChord(c.root, c.quality, c.inversion ?? 0);
      const shift = (c.octaveShift ?? 0) * 12;
      if (shift === 0) return voicing;
      return voicing.map(p => midiToPitch(pitchToMidi(p) + shift));
    });
  }

  const first = chords[0]!;
  const firstGravity = isSpelledChord(first) ? gravityCenter : gravityCenter + (first.octaveShift ?? 0) * 12;
  let firstVoicing: Pitch[];
  if (isSpelledChord(first)) {
    firstVoicing = assignSpelledPitches(first.notes, { ...options, gravityCenter: firstGravity });
  } else if (hasBass(first)) {
    firstVoicing = voiceSlashChord(first, null, null, options);
  } else if (first.explicitVoicing) {
    firstVoicing = voiceExplicit(first, firstGravity);
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
    const chordGravity = isSpelledChord(chord) ? gravityCenter : gravityCenter + (chord.octaveShift ?? 0) * 12;
    const chordOptions = { ...options, gravityCenter: chordGravity };
    let voicing: Pitch[];
    if (isSpelledChord(chord)) {
      voicing = assignSpelledPitches(chord.notes, chordOptions);
    } else if (chord.explicitVoicing) {
      voicing = voiceExplicit(chord, chordGravity);
    } else if (hasBass(chord)) {
      voicing = voiceSlashChord(chord, prev, mode, chordOptions);
    } else if (chord.inversion !== null) {
      voicing = voiceWithConstrainedBass(mode, prev, chord, chordOptions);
    } else {
      voicing = smoothVoice(mode, prev, chordPitchClasses(chord.root, chord.quality), chordOptions);
    }

    // Octave shift: force whole-octave correction toward shifted gravity
    if (!isSpelledChord(chord) && chord.octaveShift) {
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
  chord: StandardChordSymbol,
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
