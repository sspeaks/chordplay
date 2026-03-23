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
  it('Dom9 = [-5,2,4,10] (rootless)', () => {
    expect(chordIntervals('Dom9')).toEqual([-5, 2, 4, 10]);
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
});

describe('equalFrequencies', () => {
  it('A4 = 440 Hz in equal temperament', () => {
    const pitches: Pitch[] = [{ pitchClass: 'A', octave: 4 }];
    const freqs = equalFrequencies(pitches);
    expect(freqs[0]).toBeCloseTo(440.0, 1);
  });
});