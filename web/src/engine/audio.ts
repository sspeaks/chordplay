import type { Pitch, PitchClass, Tuning, PlayStyle } from '../types';
import { justFrequencies, equalFrequencies } from './musicTheory';

export const SAMPLE_RATE = 44100;

// ADSR envelope parameters (seconds)
const ATTACK = 0.020;
const DECAY = 0.100;
const RELEASE = 0.200;
const SUSTAIN = 0.70;

// Barbershop-tuned harmonic amplitudes [harmonic number, amplitude]
// H7 boosted to reinforce septimal 7th (7/4) in V7 chords
export const HARMONICS: readonly [number, number][] = [
  [1, 1.0], [2, 0.7], [3, 0.55], [4, 0.35],
  [5, 0.25], [6, 0.12], [7, 0.18], [8, 0.06],
];

export function envelope(duration: number, t: number): number {
  if (t < 0) return 0;
  if (t < ATTACK) return t / ATTACK;
  if (t < ATTACK + DECAY) {
    const decayProgress = (t - ATTACK) / DECAY;
    return 1.0 - (1.0 - SUSTAIN) * decayProgress;
  }
  if (t < duration - RELEASE) return SUSTAIN;
  if (t < duration) {
    const releaseProgress = (t - (duration - RELEASE)) / RELEASE;
    return SUSTAIN * (1.0 - releaseProgress);
  }
  return 0.0;
}

// Schedule oscillators for a single chord onto the given AudioContext.
// Returns the created oscillator and gain nodes.
function scheduleChord(
  ctx: BaseAudioContext,
  destination: AudioNode,
  freqs: number[],
  startTime: number,
  duration: number,
  style: PlayStyle,
): { oscillators: OscillatorNode[]; gains: GainNode[] } {
  const oscillators: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.3 / freqs.length;
  masterGain.connect(destination);

  const arpDelay = style === 'arpeggio' ? 0.080 : 0;

  freqs.forEach((baseFreq, voiceIdx) => {
    const voiceOffset = voiceIdx * arpDelay;

    for (const [harmonic, amplitude] of HARMONICS) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = baseFreq * harmonic;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      const start = startTime + voiceOffset;
      const attackEnd = start + ATTACK;
      const decayEnd = attackEnd + DECAY;
      const releaseStart = start + duration - RELEASE;
      const end = start + duration;

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(amplitude, attackEnd);
      gain.gain.linearRampToValueAtTime(amplitude * SUSTAIN, decayEnd);
      gain.gain.setValueAtTime(amplitude * SUSTAIN, releaseStart);
      gain.gain.linearRampToValueAtTime(0, end);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(start);
      osc.stop(end + 0.01);

      oscillators.push(osc);
      gains.push(gain);
    }
  });

  return { oscillators, gains };
}

// Compute the total wall-clock duration of a single chord (including arpeggio spread).
function chordDuration(numVoices: number, duration: number, style: PlayStyle): number {
  const arpDelay = style === 'arpeggio' ? 0.080 : 0;
  return duration + (numVoices - 1) * arpDelay;
}

// Inter-chord gap: 8% of chord duration (matches playSequence behaviour).
const GAP_FACTOR = 0.080;

// Render the full chord sequence offline and return the resulting AudioBuffer.
export async function renderSequenceOffline(
  chords: { root: PitchClass; pitches: Pitch[] }[],
  duration: number,
  tuning: Tuning,
  style: PlayStyle,
): Promise<AudioBuffer> {
  // Pre-compute frequencies and total length
  const chordFreqs = chords.map(c =>
    tuning === 'just'
      ? justFrequencies(c.root, c.pitches)
      : equalFrequencies(c.pitches),
  );

  let totalSeconds = 0;
  for (let i = 0; i < chordFreqs.length; i++) {
    totalSeconds += chordDuration(chordFreqs[i]!.length, duration, style);
    if (i < chordFreqs.length - 1) {
      totalSeconds += duration * GAP_FACTOR;
    }
  }
  // Small tail to let the last release finish
  totalSeconds += RELEASE;

  const offCtx = new OfflineAudioContext(1, Math.ceil(totalSeconds * SAMPLE_RATE), SAMPLE_RATE);

  let cursor = 0;
  for (let i = 0; i < chordFreqs.length; i++) {
    const freqs = chordFreqs[i]!;
    scheduleChord(offCtx, offCtx.destination, freqs, cursor, duration, style);
    cursor += chordDuration(freqs.length, duration, style);
    if (i < chordFreqs.length - 1) {
      cursor += duration * GAP_FACTOR;
    }
  }

  return offCtx.startRendering();
}

// Manages Web Audio playback for chord voicings
export class ChordPlayer {
  private ctx: AudioContext | null = null;
  private activeNodes: { oscillators: OscillatorNode[]; gains: GainNode[] } | null = null;
  private playbackTimer: number | null = null;
  private playbackResolve: (() => void) | null = null;
  private stopped = false;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    return this.ctx;
  }

  async playChord(
    root: PitchClass,
    pitches: Pitch[],
    duration: number,
    tuning: Tuning,
    style: PlayStyle,
  ): Promise<void> {
    this.clearAudio();
    const ctx = this.getContext();
    if (ctx.state === 'suspended') await ctx.resume();

    const freqs = tuning === 'just'
      ? justFrequencies(root, pitches)
      : equalFrequencies(pitches);

    const now = ctx.currentTime;
    this.activeNodes = scheduleChord(ctx, ctx.destination, freqs, now, duration, style);

    const total = chordDuration(freqs.length, duration, style);
    return new Promise(resolve => {
      this.playbackResolve = resolve;
      this.playbackTimer = window.setTimeout(() => {
        this.activeNodes = null;
        this.playbackTimer = null;
        this.playbackResolve = null;
        resolve();
      }, total * 1000);
    });
  }

  async playSequence(
    chords: { root: PitchClass; pitches: Pitch[] }[],
    duration: number,
    tuning: Tuning,
    style: PlayStyle,
    onChordStart?: (index: number) => void,
  ): Promise<void> {
    this.stopped = false;
    for (let i = 0; i < chords.length; i++) {
      if (this.stopped) break;
      const chord = chords[i]!;
      onChordStart?.(i);
      await this.playChord(chord.root, chord.pitches, duration, tuning, style);
      if (this.stopped) break;
      await new Promise(resolve => setTimeout(resolve, duration * 80));
    }
  }

  stopCurrent(): void {
    this.stopped = true;
    this.clearAudio();
  }

  // Stops current audio nodes without setting the stopped flag
  private clearAudio(): void {
    if (this.playbackTimer !== null) {
      window.clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    if (this.playbackResolve) {
      this.playbackResolve();
      this.playbackResolve = null;
    }
    if (this.activeNodes) {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      for (const gain of this.activeNodes.gains) {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.02);
        } catch { /* node may already be disconnected */ }
      }
      for (const osc of this.activeNodes.oscillators) {
        try { osc.stop(now + 0.03); } catch { /* already stopped */ }
      }
      this.activeNodes = null;
    }
  }

  destroy(): void {
    this.stopCurrent();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}