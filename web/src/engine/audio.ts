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

// Manages Web Audio playback for chord voicings
export class ChordPlayer {
  private ctx: AudioContext | null = null;
  private activeNodes: { oscillators: OscillatorNode[]; gains: GainNode[] } | null = null;
  private playbackTimer: number | null = null;
  private playbackResolve: (() => void) | null = null;

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
    this.stopCurrent();
    const ctx = this.getContext();
    if (ctx.state === 'suspended') await ctx.resume();

    const freqs = tuning === 'just'
      ? justFrequencies(root, pitches)
      : equalFrequencies(pitches);

    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.3 / freqs.length;
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;
    const arpDelay = style === 'arpeggio' ? 0.080 : 0;

    freqs.forEach((baseFreq, voiceIdx) => {
      const voiceOffset = voiceIdx * arpDelay;

      for (const [harmonic, amplitude] of HARMONICS) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = baseFreq * harmonic;

        const gain = ctx.createGain();
        gain.gain.value = 0;

        const start = now + voiceOffset;
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

    this.activeNodes = { oscillators, gains };

    const totalDuration = duration + (freqs.length - 1) * arpDelay;
    return new Promise(resolve => {
      this.playbackResolve = resolve;
      this.playbackTimer = window.setTimeout(() => {
        this.activeNodes = null;
        this.playbackTimer = null;
        this.playbackResolve = null;
        resolve();
      }, totalDuration * 1000);
    });
  }

  async playSequence(
    chords: { root: PitchClass; pitches: Pitch[] }[],
    duration: number,
    tuning: Tuning,
    style: PlayStyle,
    onChordStart?: (index: number) => void,
  ): Promise<void> {
    for (let i = 0; i < chords.length; i++) {
      const chord = chords[i]!;
      onChordStart?.(i);
      await this.playChord(chord.root, chord.pitches, duration, tuning, style);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  stopCurrent(): void {
    if (this.playbackTimer !== null) {
      window.clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    // Resolve the pending promise so playSequence can continue/exit
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