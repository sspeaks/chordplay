import type { VoicePart } from '../types';

export interface Formant {
  readonly freq: number;  // center frequency in Hz
  readonly amp: number;   // relative amplitude (0–1)
  readonly bw: number;    // Gaussian σ (bandwidth) in Hz
}

export type FormantProfile = readonly Formant[];

// "ah" (IPA [ɑ]) vowel formant profiles per voice part.
// Values from vocal acoustics literature (Sundberg 1987, Titze 2000).
// F3/F4 boosted for singer's formant "ring" (~2500-3500 Hz).
// Lead gets extra F3/F4 boost for brighter projection.
// "ah" (IPA [ɑ]) vowel formant profile for male barbershop voices.
// All four parts share the same profile — different timbres come from
// each voice's fundamental frequency interacting with the same formant
// peaks at different harmonic positions, just like real singers sharing
// a vowel shape with different-sized vocal tracts.
const SHARED_FORMANTS: FormantProfile = [
  { freq: 700,  amp: 1.0,  bw: 200 },
  { freq: 1150, amp: 0.7,  bw: 120 },
  { freq: 2550, amp: 0.65, bw: 120 },
  { freq: 3400, amp: 0.45, bw: 150 },
  { freq: 4300, amp: 0.2,  bw: 200 },
];

export const VOICE_FORMANTS: Record<VoicePart, FormantProfile> = {
  Bass: SHARED_FORMANTS,
  Bari: SHARED_FORMANTS,
  Tenor: SHARED_FORMANTS,
  Lead: SHARED_FORMANTS,
};

export const MAX_HARMONIC_FREQ = 2200;
export const AMPLITUDE_THRESHOLD = 0.001;

export type HarmonicAmplitude = [harmonic: number, amplitude: number];

// Source×filter model: glottal source provides a quiet baseline at every
// harmonic; formant resonances boost selected regions on top.
// GLOTTAL_FLOOR controls the baseline level between formant peaks.
// Lower = cleaner/more vowel-shaped; higher = richer but noisier.
const GLOTTAL_FLOOR = 0.15;
const FORMANT_GAIN = 8.0;

function formantEnvelope(freq: number, profile: FormantProfile): number {
  let sum = 0;
  for (const f of profile) {
    const x = (freq - f.freq) / f.bw;
    sum += f.amp * Math.exp(-0.5 * x * x);
  }
  return sum;
}

// Glottal source: −6 dB/octave rolloff. Every harmonic gets energy from this.
function glottalSource(n: number): number {
  return 1 / n;
}

// Target amplitude sum — matched to the original HARMONICS array so the
// existing master gain calibration (0.3 / voiceCount) stays correct and
// the mix doesn't clip. Old sum: 1.0+0.7+0.55+0.35+0.25+0.12+0.18+0.06 = 3.21
const TARGET_AMP_SUM = 3.21;

export function computeHarmonics(
  f0: number,
  voicePart: VoicePart,
): HarmonicAmplitude[] {
  const profile = VOICE_FORMANTS[voicePart];
  const maxHarmonic = Math.floor(MAX_HARMONIC_FREQ / f0);
  const raw: HarmonicAmplitude[] = [];

  for (let n = 1; n <= maxHarmonic; n++) {
    const freq = n * f0;
    const source = glottalSource(n);
    const formant = formantEnvelope(freq, profile);
    const amp = source * (GLOTTAL_FLOOR + FORMANT_GAIN * formant);
    if (amp > AMPLITUDE_THRESHOLD) {
      raw.push([n, amp]);
    }
  }

  // Normalize so total amplitude sum matches old HARMONICS calibration,
  // preventing clipping when many harmonics are present (e.g. bass at 110Hz
  // produces 45 harmonics vs the old 8)
  const rawSum = raw.reduce((s, [, a]) => s + a, 0);
  if (rawSum === 0) return raw;
  const scale = TARGET_AMP_SUM / rawSum;
  return raw.map(([h, a]) => [h, a * scale]);
}
