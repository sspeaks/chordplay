import { describe, it, expect } from 'vitest';
import {
  pitchClassToInt,
  pitchClassFromInt,
  pitchToMidi,
  pitchFrequency,
  chordIntervals,
  voiceChord,
  chordPitchClasses,
  slashChordPitchClasses,
  nearestPitch,
  justFrequencies,
  equalFrequencies,
  midiToPitch,
  hasMinorQuality,
  justRatioLabel,
  displayPitchName,
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

  it('Dom13 = [0,10,16,21] (Waesche: 1-b7-3-13)', () => {
    expect(chordIntervals('Dom13')).toEqual([0, 10, 16, 21]);
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
  it('1st inversion puts 2nd chord tone in bass, below root', () => {
    const first = voiceChord('C', 'Major', 1);
    const midis = first.map(pitchToMidi).sort((a, b) => a - b);
    // E should be the lowest note
    expect(first.find(p => pitchToMidi(p) === midis[0])!.pitchClass).toBe('E');
    // Bass should be below root position's lowest note (C3 = 48)
    expect(midis[0]).toBeLessThan(48);
  });
  it('1st inversion D major: F# is bass', () => {
    const inv1 = voiceChord('D', 'Major', 1);
    const sorted = [...inv1].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
    expect(sorted[0]!.pitchClass).toBe('Fs');
    // F#2 = MIDI 42, below D3 = MIDI 50
    expect(pitchToMidi(sorted[0]!)).toBe(42);
  });
  it('2nd inversion D7: A is bass', () => {
    const inv2 = voiceChord('D', 'Dom7', 2);
    const sorted = [...inv2].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
    expect(sorted[0]!.pitchClass).toBe('A');
    expect(pitchToMidi(sorted[0]!)).toBe(45); // A2
  });
  it('3rd inversion D7: C is bass', () => {
    const inv3 = voiceChord('D', 'Dom7', 3);
    const sorted = [...inv3].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
    expect(sorted[0]!.pitchClass).toBe('C');
  });
  it('all 4 notes preserved in inversions', () => {
    const root = voiceChord('D', 'Dom7', 0);
    const inv1 = voiceChord('D', 'Dom7', 1);
    const inv2 = voiceChord('D', 'Dom7', 2);
    for (const voicing of [root, inv1, inv2]) {
      expect(voicing).toHaveLength(4);
      const midis = new Set(voicing.map(pitchToMidi));
      expect(midis.size).toBe(4); // no unisons
    }
  });
  it('negative inversion clamped to root position', () => {
    const neg = voiceChord('C', 'Major', -1);
    const root = voiceChord('C', 'Major', 0);
    expect(neg).toEqual(root);
  });
  it('inversion clamped to max index', () => {
    const inv3 = voiceChord('C', 'Major', 3);
    const inv4 = voiceChord('C', 'Major', 4); // clamped to 3
    expect(inv3).toEqual(inv4);
  });
});

describe('chordPitchClasses', () => {
  it('C Major = [C, E, G, C]', () => {
    expect(chordPitchClasses('C', 'Major')).toEqual(['C', 'E', 'G', 'C']);
  });
  it('D Dom7 = [D, Fs, A, C]', () => {
    expect(chordPitchClasses('D', 'Dom7')).toEqual(['D', 'Fs', 'A', 'C']);
  });
  it('C Dom13 = [C, As, E, A] (Waesche: 1-b7-3-13)', () => {
    expect(chordPitchClasses('C', 'Dom13')).toEqual(['C', 'As', 'E', 'A']);
  });
  it('As Dom13 = [As, Gs, D, G] (Waesche: 1-b7-3-13)', () => {
    expect(chordPitchClasses('As', 'Dom13')).toEqual(['As', 'Gs', 'D', 'G']);
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

describe('justRatioLabel', () => {
  it('returns 7/5 for tritone (not 45/32)', () => {
    expect(justRatioLabel(6, false)).toBe('7/5');
    expect(justRatioLabel(6, true)).toBe('7/5');
  });

  it('returns 7/4 for minor 7th in dominant context', () => {
    expect(justRatioLabel(10, false)).toBe('7/4');
  });

  it('returns 9/5 for minor 7th in minor context', () => {
    expect(justRatioLabel(10, true)).toBe('9/5');
  });

  it('returns correct labels for all basic intervals', () => {
    const expected = ['1/1','16/15','9/8','6/5','5/4','4/3','7/5','3/2','8/5','5/3','9/5','15/8'];
    for (let i = 0; i < 12; i++) {
      expect(justRatioLabel(i, true)).toBe(expected[i]);
    }
  });

  it('handles octave-wrapped intervals', () => {
    expect(justRatioLabel(14, true)).toBe('9/8');   // 14 % 12 = 2
    expect(justRatioLabel(19, true)).toBe('3/2');   // 19 % 12 = 7
  });
});

describe('hasMinorQuality', () => {
  it('detects minor quality (has m3, no M3)', () => {
    expect(hasMinorQuality([0, 3, 7, 10])).toBe(true);  // min7
    expect(hasMinorQuality([0, 3, 7, 12])).toBe(true);  // minor triad
  });

  it('rejects dominant quality (has M3)', () => {
    expect(hasMinorQuality([0, 4, 7, 10])).toBe(false);  // dom7
    expect(hasMinorQuality([0, 4, 7, 12])).toBe(false);  // major triad
  });

  it('rejects chords with both m3 and M3', () => {
    expect(hasMinorQuality([0, 3, 4, 7])).toBe(false);
  });

  it('handles intervals beyond one octave', () => {
    expect(hasMinorQuality([0, 15, 7, 10])).toBe(true);  // 15 % 12 = 3
  });
});

describe('displayPitchName', () => {
  it('sharp-root chords display sharps', () => {
    expect(displayPitchName('As', 'Fs')).toBe('A♯');
    expect(displayPitchName('Fs', 'D')).toBe('F♯');
    expect(displayPitchName('Cs', 'D')).toBe('C♯');
  });

  it('flat-root chords display flats', () => {
    expect(displayPitchName('Ds', 'Ds')).toBe('E♭');
    expect(displayPitchName('Gs', 'Ds')).toBe('A♭');
    expect(displayPitchName('As', 'Ds')).toBe('B♭');
  });

  it('C root uses flats (conventional)', () => {
    expect(displayPitchName('As', 'C')).toBe('B♭');
    expect(displayPitchName('Ds', 'C')).toBe('E♭');
  });

  it('natural notes are unaffected by root', () => {
    expect(displayPitchName('C', 'Fs')).toBe('C');
    expect(displayPitchName('G', 'Ds')).toBe('G');
  });
});

describe('slashChordPitchClasses', () => {
  it('bass is chord tone (C/E) → removes bass from upper, doubles root', () => {
    const result = slashChordPitchClasses('C', 'Major', 'E');
    expect(result).toEqual(['E', 'C', 'G', 'C']);
  });

  it('bass is NOT chord tone, triad (C/Bb) → full triad over bass', () => {
    const result = slashChordPitchClasses('C', 'Major', 'As');
    expect(result).toEqual(['As', 'C', 'E', 'G']);
  });

  it('bass is NOT chord tone, 4-note chord (C7/A) → omit 5th', () => {
    const result = slashChordPitchClasses('C', 'Dom7', 'A');
    expect(result).toEqual(['A', 'C', 'E', 'As']);
  });

  it('bass is chord tone of 4-note chord (C7/E) → remove from upper', () => {
    const result = slashChordPitchClasses('C', 'Dom7', 'E');
    expect(result).toEqual(['E', 'C', 'G', 'As']);
  });

  it('bass is root (C/C) → root in bass, remaining tones upper', () => {
    const result = slashChordPitchClasses('C', 'Major', 'C');
    expect(result).toEqual(['C', 'E', 'G', 'C']);
  });

  it('non-chord-tone bass on chord without P5 (Dom13) → drops last PC', () => {
    // Dom13 = [0,10,16,21] unique PCs = C,As,E,A — no G (P5) to omit
    // With bass F: need to drop one of the 4 chord tones
    // Fallback drops last → [F, C, As, E]
    const result = slashChordPitchClasses('C', 'Dom13', 'F');
    expect(result).toHaveLength(4);
    expect(result[0]).toBe('F');
  });
});