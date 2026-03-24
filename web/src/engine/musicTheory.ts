import { PITCH_CLASSES, type PitchClass, type ChordType, type Pitch } from '../types';

export function pitchClassToInt(pc: PitchClass): number {
  return PITCH_CLASSES.indexOf(pc);
}

export function pitchClassFromInt(n: number): PitchClass {
  const idx = ((n % 12) + 12) % 12;  // handle negatives
  return PITCH_CLASSES[idx]!;
}

export function pitchToMidi(p: Pitch): number {
  return (p.octave + 1) * 12 + pitchClassToInt(p.pitchClass);
}

export function midiToPitch(midi: number): Pitch {
  const pc = pitchClassFromInt(midi % 12);
  const oct = Math.floor(midi / 12) - 1;
  return { pitchClass: pc, octave: oct };
}

export function pitchFrequency(p: Pitch): number {
  const midi = pitchToMidi(p);
  return 440.0 * Math.pow(2.0, (midi - 69) / 12.0);
}

const INTERVALS: Record<ChordType, readonly number[]> = {
  Major:    [0, 4, 7, 12],
  Minor:    [0, 3, 7, 12],
  Dom7:     [0, 4, 7, 10],
  Maj7:     [0, 4, 7, 11],
  Min7:     [0, 3, 7, 10],
  Dim:      [0, 3, 6, 12],
  Dim7:     [0, 3, 6, 9],
  Aug:      [0, 4, 8, 12],
  HalfDim7: [0, 3, 6, 10],
  Sus4:     [0, 5, 7, 12],
  Sus2:     [0, 2, 7, 12],
  MinMaj7:  [0, 3, 7, 11],
  Maj6:     [0, 4, 7, 9],
  Min6:     [0, 3, 7, 9],
  Dom9:     [-5, 2, 4, 10],  // rootless: 5, 9, 3, b7
};

export function chordIntervals(ct: ChordType): readonly number[] {
  return INTERVALS[ct];
}

export function chordPitchClasses(root: PitchClass, ct: ChordType): PitchClass[] {
  const rootInt = pitchClassToInt(root);
  return chordIntervals(ct).map(i => pitchClassFromInt(rootInt + i));
}

export function voiceChord(root: PitchClass, ct: ChordType, inv: number): Pitch[] {
  const baseMidi = pitchToMidi({ pitchClass: root, octave: 3 });
  const intervals = chordIntervals(ct);
  const basePitches = intervals.map(i => midiToPitch(baseMidi + i));
  const clampedInv = Math.max(-3, Math.min(3, inv));
  return applyInversion(clampedInv, basePitches);
}

function applyInversion(n: number, ps: Pitch[]): Pitch[] {
  if (n === 0 || ps.length === 0) return ps;
  if (n > 0) return applyInversion(n - 1, rotateUp(ps));
  return applyInversion(n + 1, rotateDown(ps));
}

function rotateUp(ps: Pitch[]): Pitch[] {
  if (ps.length === 0) return ps;
  const [first, ...rest] = ps;
  return [...rest, { pitchClass: first!.pitchClass, octave: first!.octave + 1 }];
}

function rotateDown(ps: Pitch[]): Pitch[] {
  if (ps.length === 0) return ps;
  const last = ps[ps.length - 1]!;
  return [{ pitchClass: last.pitchClass, octave: last.octave - 1 }, ...ps.slice(0, -1)];
}

export function nearestPitch(pc: PitchClass, targetMidi: number): Pitch {
  const pcInt = pitchClassToInt(pc);
  const octFloat = (targetMidi - pcInt) / 12.0 - 1.0;
  const octLow = Math.floor(octFloat);
  const octHigh = Math.ceil(octFloat);
  const midiLow = (octLow + 1) * 12 + pcInt;
  const midiHigh = (octHigh + 1) * 12 + pcInt;
  // Ties go low (matches Haskell's <= behavior)
  if (Math.abs(midiLow - targetMidi) <= Math.abs(midiHigh - targetMidi)) {
    return { pitchClass: pc, octave: octLow };
  }
  return { pitchClass: pc, octave: octHigh };
}

// Just intonation ratios — pure harmonic frequency ratios
function justRatio(semitones: number, useClassicalMinor7: boolean = false): number {
  if (semitones < 0) return justRatio(semitones + 12, useClassicalMinor7) / 2.0;
  if (semitones >= 12) return 2.0 * justRatio(semitones - 12, useClassicalMinor7);
  const ratios: Record<number, number> = {
    0: 1/1,       // unison
    1: 16/15,     // minor 2nd
    2: 9/8,       // major 2nd
    3: 6/5,       // minor 3rd
    4: 5/4,       // major 3rd
    5: 4/3,       // perfect 4th
    6: 7/5,       // tritone (septimal)
    7: 3/2,       // perfect 5th
    8: 8/5,       // minor 6th
    9: 5/3,       // major 6th
    10: useClassicalMinor7 ? 9/5 : 7/4,  // 9/5 for minor chords, 7/4 (septimal) for dominant
    11: 15/8,     // major 7th
  };
  return ratios[semitones]!;
}

// Detect whether a chord has a minor 3rd (interval 3) without a major 3rd (interval 4),
// indicating a minor-quality chord where 9/5 is the correct minor 7th ratio.
function hasMinorQuality(intervals: number[]): boolean {
  const normalized = intervals.map(i => ((i % 12) + 12) % 12);
  return normalized.includes(3) && !normalized.includes(4);
}

export function justFrequencies(root: PitchClass, pitches: Pitch[]): number[] {
  if (pitches.length === 0) return [];
  const midis = pitches.map(pitchToMidi);
  const bassMidi = Math.min(...midis);
  const rootPc = pitchClassToInt(root);
  const rootMidi = bassMidi - (((bassMidi - rootPc) % 12) + 12) % 12;
  const rootFreq = 440.0 * Math.pow(2.0, (rootMidi - 69) / 12.0);
  const intervals = midis.map(m => m - rootMidi);
  const useClassical = hasMinorQuality(intervals);
  return pitches.map(p => rootFreq * justRatio(pitchToMidi(p) - rootMidi, useClassical));
}

export function equalFrequencies(pitches: Pitch[]): number[] {
  return pitches.map(pitchFrequency);
}

const MIDI_NOTE_NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];

export function midiToNoteName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${MIDI_NOTE_NAMES[pc]}${octave}`;
}