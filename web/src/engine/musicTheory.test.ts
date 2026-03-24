import { describe, it, expect } from 'vitest';
import {
  pitchClassToInt,
  pitchClassFromInt,
  pitchToMidi,
  pitchFrequency,
  chordIntervals,
  voiceChord,
  chordPitchClasses,
  nearestPitch,
  justFrequencies,
  equalFrequencies,
  midiToPitch,
} from './musicTheory';
import type { Pitch } from '../types';

describe('pitchClassToInt', () => {
  it('maps C=0 through B=11', () => {
    expect(pitchClassToInt('C')).toBe(0);
    expect(pitchClassToInt('Cs')).toBe(1);
    expect(pitchClassToInt('A')).toBe(9);
    expect(pitchClassToInt('B')).toBe(11);
  });
});

describe('pitchClassFromInt', () => {
  it('0 → C, 11 → B', () => {
    expect(pitchClassFromInt(0)).toBe('C');
    expect(pitchClassFromInt(11)).toBe('B');
  });
  it('handles negatives: -1 → B', () => {
    expect(pitchClassFromInt(-1)).toBe('B');
  });
  it('handles wrapping: 12 → C', () => {
    expect(pitchClassFromInt(12)).toBe('C');
  });
});

describe('pitchToMidi', () => {
  it('A4 = 69', () => {
    expect(pitchToMidi({ pitchClass: 'A', octave: 4 })).toBe(69);
  });
  it('C4 = 60', () => {
    expect(pitchToMidi({ pitchClass: 'C', octave: 4 })).toBe(60);
  });
  it('C3 = 48', () => {
    expect(pitchToMidi({ pitchClass: 'C', octave: 3 })).toBe(48);
  });
});

describe('pitchFrequency', () => {
  it('A4 = 440 Hz', () => {
    expect(pitchFrequency({ pitchClass: 'A', octave: 4 })).toBeCloseTo(440.0, 1);
  });
  it('A5 = 880 Hz', () => {
    expect(pitchFrequency({ pitchClass: 'A', octave: 5 })).toBeCloseTo(880.0, 1);
  });
});

describe('chordIntervals', () => {
  it('Major = [0,4,7,12]', () => {
    expect(chordIntervals('Major')).toEqual([0, 4, 7, 12]);
  });
  it('Dom7 = [0,4,7,10]', () => {
    expect(chordIntervals('Dom7')).toEqual([0, 4, 7, 10]);
  });
  it('Min7 = [0,3,7,10]', () => {
    expect(chordIntervals('Min7')).toEqual([0, 3, 7, 10]);
  });
  it('Dim7 = [0,3,6,9]', () => {
    expect(chordIntervals('Dim7')).toEqual([0, 3, 6, 9]);
  });
  it('HalfDim7 = [0,3,6,10]', () => {
    expect(chordIntervals('HalfDim7')).toEqual([0, 3, 6, 10]);
  });
  // Dominant 9th variants (full = [0,4,7,10,14])
  it('Dom9no1 = [4,7,10,14]', () => {
    expect(chordIntervals('Dom9no1')).toEqual([4, 7, 10, 14]);
  });
  it('Dom9no3 = [0,7,10,14]', () => {
    expect(chordIntervals('Dom9no3')).toEqual([0, 7, 10, 14]);
  });
  it('Dom9no5 = [0,4,10,14]', () => {
    expect(chordIntervals('Dom9no5')).toEqual([0, 4, 10, 14]);
  });
  it('Dom9no7 = [0,4,7,14]', () => {
    expect(chordIntervals('Dom9no7')).toEqual([0, 4, 7, 14]);
  });

  // Major 9th variants (full = [0,4,7,11,14])
  it('Maj9no1 = [4,7,11,14]', () => {
    expect(chordIntervals('Maj9no1')).toEqual([4, 7, 11, 14]);
  });
  it('Maj9no3 = [0,7,11,14]', () => {
    expect(chordIntervals('Maj9no3')).toEqual([0, 7, 11, 14]);
  });
  it('Maj9no5 = [0,4,11,14]', () => {
    expect(chordIntervals('Maj9no5')).toEqual([0, 4, 11, 14]);
  });
  it('Maj9no7 = [0,4,7,14]', () => {
    expect(chordIntervals('Maj9no7')).toEqual([0, 4, 7, 14]);
  });

  // Minor 9th variants (full = [0,3,7,10,14])
  it('Min9no1 = [3,7,10,14]', () => {
    expect(chordIntervals('Min9no1')).toEqual([3, 7, 10, 14]);
  });
  it('Min9no3 = [0,7,10,14]', () => {
    expect(chordIntervals('Min9no3')).toEqual([0, 7, 10, 14]);
  });
  it('Min9no5 = [0,3,10,14]', () => {
    expect(chordIntervals('Min9no5')).toEqual([0, 3, 10, 14]);
  });
  it('Min9no7 = [0,3,7,14]', () => {
    expect(chordIntervals('Min9no7')).toEqual([0, 3, 7, 14]);
  });
});

describe('voiceChord', () => {
  it('C Major root position has 4 notes', () => {
    const pitches = voiceChord('C', 'Major', 0);
    expect(pitches).toHaveLength(4);
  });
  it('C Major root position starts on C3', () => {
    const pitches = voiceChord('C', 'Major', 0);
    expect(pitches[0]).toEqual({ pitchClass: 'C', octave: 3 });
  });
  it('inversions stay in [-3,3]', () => {
    const inv3 = voiceChord('C', 'Major', 3);
    const inv4 = voiceChord('C', 'Major', 4); // clamped to 3
    expect(inv3).toEqual(inv4);
  });
  it('1st inversion rotates lowest note up an octave', () => {
    const root = voiceChord('C', 'Major', 0);
    const first = voiceChord('C', 'Major', 1);
    expect(pitchToMidi(first[0]!)).toBeGreaterThan(pitchToMidi(root[0]!));
  });
});

describe('chordPitchClasses', () => {
  it('C Major = [C, E, G, C]', () => {
    expect(chordPitchClasses('C', 'Major')).toEqual(['C', 'E', 'G', 'C']);
  });
  it('D Dom7 = [D, Fs, A, C]', () => {
    expect(chordPitchClasses('D', 'Dom7')).toEqual(['D', 'Fs', 'A', 'C']);
  });
});

describe('nearestPitch', () => {
  it('finds nearest C to midi 61 → C4 (midi 60)', () => {
    const p = nearestPitch('C', 61);
    expect(pitchToMidi(p)).toBe(60);
  });
  it('ties go low: nearest C to midi 66 → C4 (midi 60, not C5=72)', () => {
    const p = nearestPitch('C', 66);
    expect(pitchToMidi(p)).toBe(60);
  });
});

describe('midiToPitch', () => {
  it('69 → A4', () => {
    expect(midiToPitch(69)).toEqual({ pitchClass: 'A', octave: 4 });
  });
  it('60 → C4', () => {
    expect(midiToPitch(60)).toEqual({ pitchClass: 'C', octave: 4 });
  });
});

describe('justFrequencies', () => {
  it('root frequency matches A4 = 440 Hz for A chord', () => {
    const pitches: Pitch[] = [
      { pitchClass: 'A', octave: 3 },
      { pitchClass: 'Cs', octave: 4 },
      { pitchClass: 'E', octave: 4 },
      { pitchClass: 'A', octave: 4 },
    ];
    const freqs = justFrequencies('A', pitches);
    expect(freqs[0]).toBeCloseTo(220.0, 0);
    expect(freqs[1]).toBeCloseTo(275.0, 0);
    expect(freqs[2]).toBeCloseTo(330.0, 0);
    expect(freqs[3]).toBeCloseTo(440.0, 0);
  });

  it('uses septimal 7/4 minor 7th for dominant chords', () => {
    // G7 = G B D F — dominant quality (has major 3rd)
    const pitches: Pitch[] = [
      { pitchClass: 'G', octave: 3 },
      { pitchClass: 'B', octave: 3 },
      { pitchClass: 'D', octave: 4 },
      { pitchClass: 'F', octave: 4 },
    ];
    const freqs = justFrequencies('G', pitches);
    const rootFreq = freqs[0]!;
    const seventhRatio = freqs[3]! / rootFreq;
    expect(seventhRatio).toBeCloseTo(7/4, 3);  // septimal 7th
  });

  it('uses classical 9/5 minor 7th for minor chords', () => {
    // Em7 = E G B D — minor quality (has minor 3rd, no major 3rd)
    const pitches: Pitch[] = [
      { pitchClass: 'E', octave: 3 },
      { pitchClass: 'G', octave: 3 },
      { pitchClass: 'B', octave: 3 },
      { pitchClass: 'D', octave: 4 },
    ];
    const freqs = justFrequencies('E', pitches);
    const rootFreq = freqs[0]!;
    const seventhRatio = freqs[3]! / rootFreq;
    expect(seventhRatio).toBeCloseTo(9/5, 3);  // classical minor 7th
  });
});

describe('equalFrequencies', () => {
  it('A4 = 440 Hz in equal temperament', () => {
    const pitches: Pitch[] = [{ pitchClass: 'A', octave: 4 }];
    const freqs = equalFrequencies(pitches);
    expect(freqs[0]).toBeCloseTo(440.0, 1);
  });
});