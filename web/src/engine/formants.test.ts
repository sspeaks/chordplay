import { describe, it, expect } from 'vitest';
import { computeHarmonics, VOICE_FORMANTS, MAX_HARMONIC_FREQ } from './formants';

describe('VOICE_FORMANTS', () => {
  it('has profiles for all four voice parts', () => {
    expect(VOICE_FORMANTS).toHaveProperty('Bass');
    expect(VOICE_FORMANTS).toHaveProperty('Bari');
    expect(VOICE_FORMANTS).toHaveProperty('Tenor');
    expect(VOICE_FORMANTS).toHaveProperty('Lead');
  });

  it('each profile has 5 formants', () => {
    for (const part of ['Bass', 'Bari', 'Tenor', 'Lead'] as const) {
      expect(VOICE_FORMANTS[part]).toHaveLength(5);
    }
  });

  it('all voices share the same formant profile', () => {
    expect(VOICE_FORMANTS.Bass).toBe(VOICE_FORMANTS.Tenor);
    expect(VOICE_FORMANTS.Bari).toBe(VOICE_FORMANTS.Lead);
  });

  it('F1 is centered around 700 Hz for ah vowel', () => {
    expect(VOICE_FORMANTS.Bass[0]!.freq).toBe(700);
  });
});

describe('computeHarmonics', () => {
  it('returns harmonic-amplitude pairs', () => {
    const result = computeHarmonics(220, 'Tenor');
    expect(result.length).toBeGreaterThan(0);
    for (const [h, a] of result) {
      expect(h).toBeGreaterThanOrEqual(1);
      expect(a).toBeGreaterThan(0);
    }
  });

  it('normalizes so total amplitude sum matches calibration target', () => {
    const result = computeHarmonics(220, 'Bass');
    const sum = result.reduce((s, [, a]) => s + a, 0);
    expect(sum).toBeCloseTo(3.21, 1);
  });

  it('respects MAX_HARMONIC_FREQ ceiling', () => {
    const f0 = 110; // Bass low note
    const result = computeHarmonics(f0, 'Bass');
    const maxHarmonicFreq = Math.max(...result.map(([h]) => h * f0));
    expect(maxHarmonicFreq).toBeLessThanOrEqual(MAX_HARMONIC_FREQ);
  });

  it('Bass at 110 Hz has more harmonics than Tenor at 330 Hz', () => {
    const bassResult = computeHarmonics(110, 'Bass');
    const tenorResult = computeHarmonics(330, 'Tenor');
    expect(bassResult.length).toBeGreaterThan(tenorResult.length);
  });

  it('amplitude decreases for high harmonics due to glottal rolloff', () => {
    // With source+filter model, all harmonics get some energy from glottal
    // source, but amplitude still decreases for very high harmonics
    const result = computeHarmonics(110, 'Bass');
    const first = result[0]!;
    const last = result[result.length - 1]!;
    expect(last[1]).toBeLessThan(first[1]);
    // Verify we get a reasonable number of harmonics
    expect(result.length).toBeGreaterThan(10);
  });

  it('returns single harmonic when f0 >= MAX_HARMONIC_FREQ', () => {
    // At f0=MAX_HARMONIC_FREQ, only h1 exists; gets full target sum
    const result = computeHarmonics(MAX_HARMONIC_FREQ, 'Tenor');
    expect(result).toHaveLength(1);
    expect(result[0]![0]).toBe(1);
    expect(result[0]![1]).toBeCloseTo(3.21, 1);
  });

  it('harmonics near F1 are louder than harmonics between formants', () => {
    // For Bass at 110 Hz, harmonic 6 (660 Hz) is near F1 (650 Hz)
    // It should be louder than harmonic 8 (880 Hz) which falls between F1 and F2
    const result = computeHarmonics(110, 'Bass');
    const h6 = result.find(([h]) => h === 6);
    const h8 = result.find(([h]) => h === 8);
    expect(h6).toBeDefined();
    expect(h8).toBeDefined();
    expect(h6![1]).toBeGreaterThan(h8![1]);
  });

  it('different pitches produce different harmonic shapes from same formants', () => {
    // Even with shared formants, a bass at 110Hz and tenor at 220Hz
    // hit the formant peaks at different harmonic numbers
    const bass = computeHarmonics(110, 'Bass');
    const tenor = computeHarmonics(220, 'Tenor');
    // Bass should have more harmonics (lower f0 = more fit under ceiling)
    expect(bass.length).toBeGreaterThan(tenor.length);
  });
});
