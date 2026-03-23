import { describe, it, expect } from 'vitest';
import { smoothVoice, voiceChordSequence } from './voiceLeading';
import { pitchToMidi, voiceChord } from './musicTheory';
import type { Pitch, ChordSymbol } from '../types';

describe('smoothVoice', () => {
  it('minimizes total movement (SmoothEqual)', () => {
    const prev = voiceChord('C', 'Major', 0);
    const result = smoothVoice('equal', prev, ['F', 'A', 'C', 'F']);
    const midis = result.map(pitchToMidi);
    const prevMidis = prev.map(pitchToMidi);
    const maxMovement = Math.max(...midis.map((m, i) => Math.abs(m - prevMidis[i]!)));
    expect(maxMovement).toBeLessThanOrEqual(7);
  });

  it('penalizes semitone clusters', () => {
    const prev: Pitch[] = [
      { pitchClass: 'C', octave: 3 },
      { pitchClass: 'E', octave: 3 },
      { pitchClass: 'G', octave: 3 },
      { pitchClass: 'C', octave: 4 },
    ];
    const result = smoothVoice('equal', prev, ['C', 'E', 'G', 'C']);
    const midis = result.map(pitchToMidi).sort((a, b) => a - b);
    const gaps = midis.slice(1).map((m, i) => m - midis[i]!);
    expect(gaps.every(g => g !== 1)).toBe(true);
  });
});

describe('voiceChordSequence', () => {
  it('returns empty for empty input', () => {
    expect(voiceChordSequence(null, [])).toEqual([]);
  });

  it('without smooth mode, uses explicit inversions', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null },
      { root: 'G', quality: 'Major', inversion: null },
    ];
    const result = voiceChordSequence(null, chords);
    expect(result).toHaveLength(2);
    result.forEach(voicing => expect(voicing).toHaveLength(4));
  });

  it('with smooth mode, voices stay close', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null },
      { root: 'F', quality: 'Major', inversion: null },
      { root: 'G', quality: 'Dom7', inversion: null },
      { root: 'C', quality: 'Major', inversion: null },
    ];
    const result = voiceChordSequence('equal', chords);
    expect(result).toHaveLength(4);
    for (let i = 1; i < result.length; i++) {
      const prevMidis = result[i - 1]!.map(pitchToMidi).sort((a, b) => a - b);
      const currMidis = result[i]!.map(pitchToMidi).sort((a, b) => a - b);
      const totalMovement = prevMidis.reduce((sum, m, j) => sum + Math.abs(m - currMidis[j]!), 0);
      expect(totalMovement).toBeLessThan(24);
    }
  });

  it('explicit inversion overrides smooth', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null },
      { root: 'G', quality: 'Major', inversion: 2 },
    ];
    const result = voiceChordSequence('equal', chords);
    const forced = voiceChord('G', 'Major', 2);
    expect(result[1]).toEqual(forced);
  });
});