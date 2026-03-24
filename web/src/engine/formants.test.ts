import { describe, it, expect } from 'vitest';
import { computeHarmonics, VOICE_FORMANTS, MAX_HARMONIC_FREQ, AMPLITUDE_THRESHOLD } from './formants';

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

  it('Bass has lower F1 than Tenor', () => {
    expect(VOICE_FORMANTS.Bass[0]!.freq).toBeLessThan(VOICE_FORMANTS.Tenor[0]!.freq);
  });

  it('Lead has brighter F3/F4 than Tenor', () => {
    expect(VOICE_FORMANTS.Lead[2]!.amp).toBeGreaterThan(VOICE_FORMANTS.Tenor[2]!.amp);
    expect(VOICE_FORMANTS.Lead[3]!.amp).toBeGreaterThan(VOICE_FORMANTS.Tenor[3]!.amp);
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

  it('normalizes so max amplitude is 1.0', () => {
    const result = computeHarmonics(220, 'Bass');
    const maxAmp = Math.max(...result.map(([, a]) => a));
    expect(maxAmp).toBeCloseTo(1.0, 5);
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

  it('excludes harmonics below amplitude threshold', () => {
    // At 110 Hz, maxHarmonic = floor(5000/110) = 45
    // Not all 45 harmonics should survive threshold filtering
    const f0 = 110;
    const maxPossible = Math.floor(MAX_HARMONIC_FREQ / f0);
    const result = computeHarmonics(f0, 'Tenor');
    expect(result.length).toBeLessThan(maxPossible);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty array when f0 >= MAX_HARMONIC_FREQ', () => {
    const result = computeHarmonics(MAX_HARMONIC_FREQ, 'Tenor');
    expect(result).toEqual([]);
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

  it('different voice parts produce different amplitudes', () => {
    const bass = computeHarmonics(220, 'Bass');
    const lead = computeHarmonics(220, 'Lead');
    const bassMap = new Map(bass);
    const leadMap = new Map(lead);
    let hasDifference = false;
    for (const [h] of bass) {
      if (leadMap.has(h) && Math.abs(bassMap.get(h)! - leadMap.get(h)!) > 0.01) {
        hasDifference = true;
        break;
      }
    }
    expect(hasDifference).toBe(true);
  });
});
