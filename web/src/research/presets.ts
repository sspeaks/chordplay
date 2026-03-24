import type { SynthParams } from './formantSynth';

export interface Preset {
  name: string;
  category: string;
  params: SynthParams;
}

// Vowel formants (F1-F3) from Peterson & Barney 1952 male averages.
// F4/F5 estimated from standard male vocal tract (~3300/4200 Hz).
// Singing presets use Sundberg 1987 singer's formant data.

export const PRESETS: Preset[] = [
  // ── Vowels (male speaking, f0≈130 Hz) ────────────────────────

  {
    name: 'Ah (father)',
    category: 'Vowels',
    params: {
      f0: 130, tiltExponent: 1.0, breathMix: 0.03,
      vibratoRate: 0, vibratoDepth: 0, ampJitter: 0.01,
      formants: [
        { freq: 730, amp: 1.0, bw: 80 },
        { freq: 1090, amp: 0.7, bw: 90 },
        { freq: 2440, amp: 0.5, bw: 120 },
        { freq: 3300, amp: 0.3, bw: 150 },
        { freq: 4200, amp: 0.15, bw: 200 },
      ],
    },
  },
  {
    name: 'Ee (beet)',
    category: 'Vowels',
    params: {
      f0: 130, tiltExponent: 1.0, breathMix: 0.03,
      vibratoRate: 0, vibratoDepth: 0, ampJitter: 0.01,
      formants: [
        { freq: 270, amp: 1.0, bw: 60 },
        { freq: 2290, amp: 0.8, bw: 90 },
        { freq: 3010, amp: 0.5, bw: 120 },
        { freq: 3500, amp: 0.3, bw: 150 },
        { freq: 4500, amp: 0.15, bw: 200 },
      ],
    },
  },
  {
    name: 'Oo (boot)',
    category: 'Vowels',
    params: {
      f0: 130, tiltExponent: 1.0, breathMix: 0.03,
      vibratoRate: 0, vibratoDepth: 0, ampJitter: 0.01,
      formants: [
        { freq: 300, amp: 1.0, bw: 60 },
        { freq: 870, amp: 0.7, bw: 90 },
        { freq: 2240, amp: 0.4, bw: 120 },
        { freq: 3300, amp: 0.25, bw: 150 },
        { freq: 4200, amp: 0.1, bw: 200 },
      ],
    },
  },
  {
    name: 'Eh (bet)',
    category: 'Vowels',
    params: {
      f0: 130, tiltExponent: 1.0, breathMix: 0.03,
      vibratoRate: 0, vibratoDepth: 0, ampJitter: 0.01,
      formants: [
        { freq: 530, amp: 1.0, bw: 70 },
        { freq: 1840, amp: 0.8, bw: 90 },
        { freq: 2480, amp: 0.5, bw: 120 },
        { freq: 3300, amp: 0.3, bw: 150 },
        { freq: 4200, amp: 0.15, bw: 200 },
      ],
    },
  },
  {
    name: 'Oh (bought)',
    category: 'Vowels',
    params: {
      f0: 130, tiltExponent: 1.0, breathMix: 0.03,
      vibratoRate: 0, vibratoDepth: 0, ampJitter: 0.01,
      formants: [
        { freq: 570, amp: 1.0, bw: 70 },
        { freq: 840, amp: 0.6, bw: 90 },
        { freq: 2410, amp: 0.4, bw: 120 },
        { freq: 3300, amp: 0.25, bw: 150 },
        { freq: 4200, amp: 0.1, bw: 200 },
      ],
    },
  },
  {
    name: 'Uh (but)',
    category: 'Vowels',
    params: {
      f0: 130, tiltExponent: 1.0, breathMix: 0.03,
      vibratoRate: 0, vibratoDepth: 0, ampJitter: 0.01,
      formants: [
        { freq: 640, amp: 1.0, bw: 80 },
        { freq: 1190, amp: 0.7, bw: 90 },
        { freq: 2390, amp: 0.5, bw: 120 },
        { freq: 3300, amp: 0.3, bw: 150 },
        { freq: 4200, amp: 0.15, bw: 200 },
      ],
    },
  },

  // ── Voice Types (singing "ah") ───────────────────────────────

  {
    name: 'Bass',
    category: 'Voice Types',
    params: {
      f0: 110, tiltExponent: 1.0, breathMix: 0.02,
      vibratoRate: 5.5, vibratoDepth: 0.008, ampJitter: 0.02,
      formants: [
        { freq: 650, amp: 1.0, bw: 80 },
        { freq: 1100, amp: 0.7, bw: 90 },
        { freq: 2450, amp: 0.65, bw: 120 },
        { freq: 3300, amp: 0.45, bw: 150 },
        { freq: 4100, amp: 0.2, bw: 200 },
      ],
    },
  },
  {
    name: 'Baritone',
    category: 'Voice Types',
    params: {
      f0: 175, tiltExponent: 1.0, breathMix: 0.03,
      vibratoRate: 5.5, vibratoDepth: 0.01, ampJitter: 0.02,
      formants: [
        { freq: 700, amp: 1.0, bw: 80 },
        { freq: 1150, amp: 0.7, bw: 90 },
        { freq: 2500, amp: 0.65, bw: 120 },
        { freq: 3350, amp: 0.45, bw: 150 },
        { freq: 4200, amp: 0.2, bw: 200 },
      ],
    },
  },
  {
    name: 'Tenor',
    category: 'Voice Types',
    params: {
      f0: 260, tiltExponent: 1.0, breathMix: 0.03,
      vibratoRate: 5.5, vibratoDepth: 0.01, ampJitter: 0.02,
      formants: [
        { freq: 750, amp: 1.0, bw: 80 },
        { freq: 1200, amp: 0.7, bw: 90 },
        { freq: 2550, amp: 0.65, bw: 120 },
        { freq: 3400, amp: 0.45, bw: 150 },
        { freq: 4300, amp: 0.2, bw: 200 },
      ],
    },
  },
  {
    name: 'Alto',
    category: 'Voice Types',
    params: {
      f0: 350, tiltExponent: 0.9, breathMix: 0.04,
      vibratoRate: 5.5, vibratoDepth: 0.01, ampJitter: 0.02,
      formants: [
        { freq: 850, amp: 1.0, bw: 90 },
        { freq: 1350, amp: 0.7, bw: 100 },
        { freq: 2700, amp: 0.6, bw: 130 },
        { freq: 3600, amp: 0.4, bw: 160 },
        { freq: 4500, amp: 0.2, bw: 210 },
      ],
    },
  },

  // ── Singing Styles ───────────────────────────────────────────

  {
    name: 'Operatic',
    category: 'Singing Styles',
    params: {
      // Singer's formant: F3/F4/F5 cluster near 3 kHz for projection
      f0: 200, tiltExponent: 0.8, breathMix: 0.01,
      vibratoRate: 5.8, vibratoDepth: 0.015, ampJitter: 0.02,
      formants: [
        { freq: 730, amp: 1.0, bw: 70 },
        { freq: 1100, amp: 0.8, bw: 80 },
        { freq: 2800, amp: 0.8, bw: 100 },
        { freq: 3100, amp: 0.7, bw: 100 },
        { freq: 3400, amp: 0.5, bw: 120 },
      ],
    },
  },
  {
    name: 'Choir Blend',
    category: 'Singing Styles',
    params: {
      // Wide bandwidths, reduced ring — blends with other voices
      f0: 200, tiltExponent: 1.1, breathMix: 0.03,
      vibratoRate: 5.0, vibratoDepth: 0.008, ampJitter: 0.015,
      formants: [
        { freq: 700, amp: 1.0, bw: 100 },
        { freq: 1150, amp: 0.6, bw: 110 },
        { freq: 2500, amp: 0.4, bw: 150 },
        { freq: 3350, amp: 0.25, bw: 180 },
        { freq: 4200, amp: 0.1, bw: 220 },
      ],
    },
  },
  {
    name: 'Crooner',
    category: 'Singing Styles',
    params: {
      // Warm, intimate, gentle vibrato
      f0: 150, tiltExponent: 1.3, breathMix: 0.04,
      vibratoRate: 4.5, vibratoDepth: 0.008, ampJitter: 0.015,
      formants: [
        { freq: 700, amp: 1.0, bw: 90 },
        { freq: 1100, amp: 0.6, bw: 100 },
        { freq: 2400, amp: 0.4, bw: 130 },
        { freq: 3200, amp: 0.25, bw: 160 },
        { freq: 4100, amp: 0.1, bw: 200 },
      ],
    },
  },
  {
    name: 'Breathy',
    category: 'Singing Styles',
    params: {
      f0: 175, tiltExponent: 0.7, breathMix: 0.25,
      vibratoRate: 5.0, vibratoDepth: 0.01, ampJitter: 0.03,
      formants: [
        { freq: 700, amp: 1.0, bw: 90 },
        { freq: 1150, amp: 0.7, bw: 100 },
        { freq: 2500, amp: 0.5, bw: 130 },
        { freq: 3350, amp: 0.35, bw: 160 },
        { freq: 4200, amp: 0.15, bw: 200 },
      ],
    },
  },
  {
    name: 'Belt',
    category: 'Singing Styles',
    params: {
      // Strong, forward, bright — high F1 for open production
      f0: 250, tiltExponent: 0.7, breathMix: 0.02,
      vibratoRate: 5.5, vibratoDepth: 0.012, ampJitter: 0.02,
      formants: [
        { freq: 800, amp: 1.0, bw: 70 },
        { freq: 1300, amp: 0.8, bw: 80 },
        { freq: 2600, amp: 0.7, bw: 100 },
        { freq: 3400, amp: 0.5, bw: 120 },
        { freq: 4300, amp: 0.25, bw: 150 },
      ],
    },
  },

  // ── Character ────────────────────────────────────────────────

  {
    name: 'Bright',
    category: 'Character',
    params: {
      // Boosted upper formants for forward, present sound
      f0: 200, tiltExponent: 0.8, breathMix: 0.03,
      vibratoRate: 5.0, vibratoDepth: 0.01, ampJitter: 0.02,
      formants: [
        { freq: 700, amp: 1.0, bw: 80 },
        { freq: 1200, amp: 0.8, bw: 80 },
        { freq: 2600, amp: 0.75, bw: 100 },
        { freq: 3400, amp: 0.6, bw: 120 },
        { freq: 4300, amp: 0.3, bw: 150 },
      ],
    },
  },
  {
    name: 'Dark / Covered',
    category: 'Character',
    params: {
      // Lower formants, steep rolloff — warm, back-placed sound
      f0: 175, tiltExponent: 1.5, breathMix: 0.02,
      vibratoRate: 5.0, vibratoDepth: 0.01, ampJitter: 0.02,
      formants: [
        { freq: 620, amp: 1.0, bw: 90 },
        { freq: 1000, amp: 0.6, bw: 100 },
        { freq: 2350, amp: 0.4, bw: 140 },
        { freq: 3200, amp: 0.2, bw: 170 },
        { freq: 4000, amp: 0.08, bw: 200 },
      ],
    },
  },
  {
    name: 'Nasal',
    category: 'Character',
    params: {
      // Narrow bandwidths create sharp, nasal resonances
      f0: 175, tiltExponent: 1.0, breathMix: 0.02,
      vibratoRate: 5.0, vibratoDepth: 0.01, ampJitter: 0.02,
      formants: [
        { freq: 700, amp: 1.0, bw: 40 },
        { freq: 1150, amp: 0.7, bw: 50 },
        { freq: 2500, amp: 0.65, bw: 80 },
        { freq: 3350, amp: 0.45, bw: 100 },
        { freq: 4200, amp: 0.2, bw: 130 },
      ],
    },
  },
];
