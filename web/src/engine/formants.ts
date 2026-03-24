import type { VoicePart } from '../types';

export interface Formant {
  readonly freq: number; // center frequency in Hz
  readonly amp: number; // relative amplitude (0–1)
  readonly bw: number; // Gaussian σ (bandwidth) in Hz
}

export type FormantProfile = readonly Formant[];

// "ah" (IPA [ɑ]) vowel formant profiles per voice part.
// Values from vocal acoustics literature (Sundberg 1987, Titze 2000).
// F3/F4 boosted for singer's formant "ring" (~2500–3500 Hz).
// Lead gets extra F3/F4 boost for brighter projection.
export const VOICE_FORMANTS: Record<VoicePart, FormantProfile> = {
  Bass: [
    { freq: 650, amp: 1.0, bw: 80 },
    { freq: 1100, amp: 0.7, bw: 90 },
    { freq: 2450, amp: 0.65, bw: 120 },
    { freq: 3300, amp: 0.45, bw: 150 },
    { freq: 4100, amp: 0.2, bw: 200 },
  ],
  Bari: [
    { freq: 700, amp: 1.0, bw: 80 },
    { freq: 1150, amp: 0.7, bw: 90 },
    { freq: 2500, amp: 0.65, bw: 120 },
    { freq: 3350, amp: 0.45, bw: 150 },
    { freq: 4200, amp: 0.2, bw: 200 },
  ],
  Tenor: [
    { freq: 750, amp: 1.0, bw: 80 },
    { freq: 1200, amp: 0.7, bw: 90 },
    { freq: 2550, amp: 0.65, bw: 120 },
    { freq: 3400, amp: 0.45, bw: 150 },
    { freq: 4300, amp: 0.2, bw: 200 },
  ],
  Lead: [
    { freq: 750, amp: 1.0, bw: 80 },
    { freq: 1200, amp: 0.7, bw: 90 },
    { freq: 2550, amp: 0.75, bw: 120 },
    { freq: 3400, amp: 0.55, bw: 150 },
    { freq: 4300, amp: 0.2, bw: 200 },
  ],
};

export const MAX_HARMONIC_FREQ = 5000;
export const AMPLITUDE_THRESHOLD = 0.001;

function formantEnvelope(freq: number, profile: FormantProfile): number {
  let sum = 0;
  for (const f of profile) {
    const x = (freq - f.freq) / f.bw;
    sum += f.amp * Math.exp(-0.5 * x * x);
  }
  return sum;
}

// Compute formant-shaped harmonics from a raw profile. Used by the research
// page where formant parameters are user-adjustable.
export function computeHarmonicsFromProfile(
  f0: number,
  profile: FormantProfile,
  tiltExponent: number = 1.0,
): [number, number][] {
  const maxHarmonic = Math.floor(MAX_HARMONIC_FREQ / f0);
  const raw: [number, number][] = [];
  let maxAmp = 0;

  for (let n = 1; n <= maxHarmonic; n++) {
    const freq = n * f0;
    const tilt = 1 / Math.pow(n, tiltExponent);
    const envelope = formantEnvelope(freq, profile);
    const amp = tilt * envelope;
    if (amp > AMPLITUDE_THRESHOLD) {
      raw.push([n, amp]);
      if (amp > maxAmp) maxAmp = amp;
    }
  }

  if (maxAmp === 0) return raw;
  return raw.map(([h, a]) => [h, a / maxAmp]);
}

// Convenience wrapper using built-in voice part profiles.
export function computeHarmonics(
  f0: number,
  voicePart: VoicePart,
): [number, number][] {
  return computeHarmonicsFromProfile(f0, VOICE_FORMANTS[voicePart]);
}
