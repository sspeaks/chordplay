import { describe, it, expect } from 'vitest';
import { smoothVoice, voiceChordSequence } from './voiceLeading';
import { pitchToMidi, voiceChord, midiToNoteName } from './musicTheory';
import type { Pitch, PitchClass, ChordSymbol } from '../types';

describe('midiToNoteName', () => {
  it('converts MIDI 60 to C4', () => { expect(midiToNoteName(60)).toBe('C4'); });
  it('converts MIDI 55 to G3', () => { expect(midiToNoteName(55)).toBe('G3'); });
  it('converts MIDI 36 to C2', () => { expect(midiToNoteName(36)).toBe('C2'); });
  it('converts MIDI 61 to C♯4', () => { expect(midiToNoteName(61)).toBe('C♯4'); });
});

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

describe('smoothVoice with gravity/spread', () => {
  it('gravity pulls voicing toward center', () => {
    // Wide-spread prev voicing where gravity can influence octave choices
    // because multiple permutations have competitive movement costs
    const prev: Pitch[] = [
      { pitchClass: 'C', octave: 3 },
      { pitchClass: 'G', octave: 3 },
      { pitchClass: 'E', octave: 4 },
      { pitchClass: 'C', octave: 5 },
    ];
    const nextPCs: PitchClass[] = ['D', 'A', 'Fs', 'D'];
    const withGravity = smoothVoice('equal', prev, nextPCs, { gravityCenter: 55 });
    const withoutGravity = smoothVoice('equal', prev, nextPCs, { gravityCenter: 84 });
    const gravityCentroid = withGravity.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    const noGravityCentroid = withoutGravity.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    expect(gravityCentroid).toBeLessThan(noGravityCentroid);
  });

  it('spread penalty favors target width', () => {
    const prev: Pitch[] = [
      { pitchClass: 'C', octave: 3 },
      { pitchClass: 'E', octave: 3 },
      { pitchClass: 'G', octave: 3 },
      { pitchClass: 'C', octave: 4 },
    ];
    const nextPCs: PitchClass[] = ['D', 'Fs', 'A', 'D'];
    const narrow = smoothVoice('equal', prev, nextPCs, { targetSpread: 12 });
    const wide = smoothVoice('equal', prev, nextPCs, { targetSpread: 30 });
    const narrowSpread = Math.max(...narrow.map(pitchToMidi)) - Math.min(...narrow.map(pitchToMidi));
    const wideSpread = Math.max(...wide.map(pitchToMidi)) - Math.min(...wide.map(pitchToMidi));
    expect(narrowSpread).toBeLessThanOrEqual(wideSpread);
  });

  it('handles gravity + spread tension gracefully', () => {
    const prev: Pitch[] = [
      { pitchClass: 'C', octave: 3 },
      { pitchClass: 'E', octave: 3 },
      { pitchClass: 'G', octave: 3 },
      { pitchClass: 'C', octave: 4 },
    ];
    const nextPCs: PitchClass[] = ['F', 'A', 'C', 'F'];
    const result = smoothVoice('equal', prev, nextPCs, { gravityCenter: 36, targetSpread: 30 });
    expect(result).toHaveLength(4);
    result.forEach(p => {
      expect(p.pitchClass).toBeDefined();
      expect(typeof p.octave).toBe('number');
    });
  });

  it('works without options (backward compatible)', () => {
    const prev = voiceChord('C', 'Major', 0);
    const result = smoothVoice('equal', prev, ['F', 'A', 'C', 'F']);
    expect(result).toHaveLength(4);
    const midis = result.map(pitchToMidi);
    const prevMidis = prev.map(pitchToMidi);
    const maxMovement = Math.max(...midis.map((m, i) => Math.abs(m - prevMidis[i]!)));
    expect(maxMovement).toBeLessThanOrEqual(7);
  });

  it('still avoids semitone clusters with gravity enabled', () => {
    const prev: Pitch[] = [
      { pitchClass: 'C', octave: 3 },
      { pitchClass: 'E', octave: 3 },
      { pitchClass: 'G', octave: 3 },
      { pitchClass: 'C', octave: 4 },
    ];
    const result = smoothVoice('equal', prev, ['C', 'E', 'G', 'C'], { gravityCenter: 55 });
    const midis = result.map(pitchToMidi).sort((a, b) => a - b);
    const gaps = midis.slice(1).map((m, i) => m - midis[i]!);
    expect(gaps.every(g => g !== 1)).toBe(true);
  });
});

describe('voiceChordSequence with gravity/spread', () => {
  it('gravity keeps long progression near center', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null },
      { root: 'G', quality: 'Dom7', inversion: null },
      { root: 'A', quality: 'Minor', inversion: null },
      { root: 'F', quality: 'Major', inversion: null },
      { root: 'D', quality: 'Minor', inversion: null },
      { root: 'G', quality: 'Dom7', inversion: null },
      { root: 'E', quality: 'Minor', inversion: null },
      { root: 'A', quality: 'Dom7', inversion: null },
      { root: 'D', quality: 'Minor', inversion: null },
      { root: 'G', quality: 'Dom7', inversion: null },
      { root: 'C', quality: 'Major', inversion: null },
    ];
    const withGravity = voiceChordSequence('equal', chords, { gravityCenter: 55 });
    const withoutGravity = voiceChordSequence('equal', chords, { gravityCenter: 84 });
    const lastWithGravity = withGravity[withGravity.length - 1]!;
    const lastWithout = withoutGravity[withoutGravity.length - 1]!;
    const centroidWith = lastWithGravity.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    const centroidWithout = lastWithout.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    expect(Math.abs(centroidWith - 55)).toBeLessThan(Math.abs(centroidWithout - 55));
  });

  it('spread control keeps voicings near target width', () => {
    const chords: ChordSymbol[] = [
      { root: 'D', quality: 'Major', inversion: null },
      { root: 'A', quality: 'Dom7', inversion: null },
      { root: 'D', quality: 'Major', inversion: null },
      { root: 'G', quality: 'Major', inversion: null },
      { root: 'D', quality: 'Major', inversion: null },
    ];
    const narrow = voiceChordSequence('equal', chords, { targetSpread: 14 });
    const wide = voiceChordSequence('equal', chords, { targetSpread: 30 });
    const avgSpread = (voicings: Pitch[][]) => {
      const spreads = voicings.map(v => {
        const midis = v.map(pitchToMidi);
        return Math.max(...midis) - Math.min(...midis);
      });
      return spreads.reduce((a, b) => a + b, 0) / spreads.length;
    };
    expect(avgSpread(narrow)).toBeLessThan(avgSpread(wide));
  });

  it('options parameter is optional (backward compat)', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null },
      { root: 'F', quality: 'Major', inversion: null },
    ];
    const result = voiceChordSequence('equal', chords);
    expect(result).toHaveLength(2);
    result.forEach(v => expect(v).toHaveLength(4));
  });
});