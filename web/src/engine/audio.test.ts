import { describe, it, expect } from 'vitest';
import { computeHarmonics } from './formants';
import {
  envelope,
  HARMONICS,
  normalizedFormantHarmonics,
  SAMPLE_RATE,
  scheduleChord,
  voicePartForIndex,
} from './audio';
import { VOICE_PARTS, type VoicePart } from '../types';

interface ParamEvent {
  readonly kind: 'set' | 'linear';
  readonly value: number;
  readonly time: number;
}

class FakeAudioParam {
  value = 0;
  readonly events: ParamEvent[] = [];

  setValueAtTime(value: number, time: number): FakeAudioParam {
    this.value = value;
    this.events.push({ kind: 'set', value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): FakeAudioParam {
    this.value = value;
    this.events.push({ kind: 'linear', value, time });
    return this;
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam();
  readonly connections: unknown[] = [];

  connect(destination: unknown): unknown {
    this.connections.push(destination);
    return destination;
  }
}

class FakeOscillatorNode {
  type: OscillatorType = 'sine';
  readonly frequency = { value: 0 };
  readonly connections: unknown[] = [];
  startTime: number | null = null;
  stopTime: number | null = null;

  connect(destination: unknown): unknown {
    this.connections.push(destination);
    return destination;
  }

  start(time: number): void {
    this.startTime = time;
  }

  stop(time: number): void {
    this.stopTime = time;
  }
}

class FakeAudioContext {
  readonly destination = new FakeGainNode();
  readonly gains: FakeGainNode[] = [];
  readonly oscillators: FakeOscillatorNode[] = [];

  createGain(): FakeGainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }

  createOscillator(): FakeOscillatorNode {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }
}

function harmonicGains(ctx: FakeAudioContext): FakeGainNode[] {
  return ctx.gains.filter(gain => gain.gain.events.length > 0);
}

function profileEnergy(harmonics: readonly (readonly [number, number])[]): number {
  return Math.sqrt(
    harmonics.reduce((sum, [, amplitude]) => sum + amplitude * amplitude, 0),
  );
}

function harmonicEnergy(
  harmonics: readonly (readonly [number, number])[],
  predicate: (harmonic: number) => boolean,
): number {
  return harmonics.reduce(
    (sum, [harmonic, amplitude]) =>
      predicate(harmonic) ? sum + amplitude * amplitude : sum,
    0,
  );
}

function bandEnergy(
  harmonics: readonly (readonly [number, number])[],
  baseFreq: number,
  lowFreq: number,
  highFreq: number,
): number {
  return harmonicEnergy(
    harmonics,
    harmonic => harmonic * baseFreq >= lowFreq && harmonic * baseFreq <= highFreq,
  );
}

function onsetOffsetForVoicePart(voicePart: VoicePart): number {
  return {
    Bass: 0,
    Bari: 0.003,
    Lead: 0.006,
    Tenor: 0.009,
  }[voicePart];
}

function attackPeakTime(start: number, harmonic: number): number {
  return start + 0.020 + Math.min((harmonic - 1) * 0.0012, 0.009);
}

describe('envelope', () => {
  it('starts at 0', () => {
    expect(envelope(1.0, 0)).toBeCloseTo(0, 5);
  });
  it('reaches ~1.0 at end of attack (20ms)', () => {
    expect(envelope(1.0, 0.020)).toBeCloseTo(1.0, 1);
  });
  it('settles to sustain level (0.7) after decay', () => {
    expect(envelope(1.0, 0.150)).toBeCloseTo(0.7, 1);
  });
  it('sustains at 0.7 in middle', () => {
    expect(envelope(1.0, 0.5)).toBeCloseTo(0.7, 1);
  });
  it('reaches 0 at end of release', () => {
    expect(envelope(1.0, 1.0)).toBeCloseTo(0.0, 5);
  });
  it('is 0 after duration', () => {
    expect(envelope(1.0, 1.1)).toBe(0.0);
  });
});

describe('constants', () => {
  it('sample rate is 44100', () => {
    expect(SAMPLE_RATE).toBe(44100);
  });
  it('has 8 harmonics', () => {
    expect(HARMONICS).toHaveLength(8);
  });
  it('fundamental has amplitude 1.0', () => {
    expect(HARMONICS[0]).toEqual([1, 1.0]);
  });
  it('H7 is boosted to 0.18 for septimal 7th', () => {
    expect(HARMONICS[6]).toEqual([7, 0.18]);
  });
});

describe('voicePartForIndex', () => {
  it('maps voice indices to the configured voice part order', () => {
    expect([...VOICE_PARTS.keys()].map(voicePartForIndex)).toEqual([...VOICE_PARTS]);
  });

  it('uses the final configured voice part for extra indices', () => {
    expect(voicePartForIndex(VOICE_PARTS.length)).toBe(VOICE_PARTS[VOICE_PARTS.length - 1]);
  });
});

describe('formant harmonic scheduling', () => {
  it('defaults to legacy organ harmonics without human offsets or bloom', () => {
    const ctx = new FakeAudioContext();
    const freqs = [330, 110, 440, 220];
    const startTime = 0.5;
    const duration = 0.75;

    scheduleChord(
      ctx as unknown as BaseAudioContext,
      ctx.destination as unknown as AudioNode,
      freqs,
      startTime,
      duration,
      'arpeggio',
    );

    const gains = harmonicGains(ctx);
    expect(ctx.oscillators).toHaveLength(freqs.length * HARMONICS.length);
    expect(gains).toHaveLength(freqs.length * HARMONICS.length);

    let offset = 0;
    for (const [voiceIdx, baseFreq] of freqs.entries()) {
      const voiceStart = startTime + voiceIdx * 0.080;
      const scheduledOscillators = ctx.oscillators.slice(offset, offset + HARMONICS.length);
      const scheduledGains = gains.slice(offset, offset + HARMONICS.length);

      for (const [harmonicIdx, [harmonic, amplitude]] of HARMONICS.entries()) {
        const oscillator = scheduledOscillators[harmonicIdx]!;
        const gain = scheduledGains[harmonicIdx]!;

        expect(oscillator.frequency.value).toBeCloseTo(baseFreq * harmonic, 8);
        expect(oscillator.startTime).toBeCloseTo(voiceStart, 8);
        expect(oscillator.stopTime).toBeCloseTo(voiceStart + duration + 0.01, 8);

        expect(gain.gain.events).toHaveLength(5);
        expect(gain.gain.events[0]).toEqual({ kind: 'set', value: 0, time: voiceStart });
        expect(gain.gain.events[1]!.kind).toBe('linear');
        expect(gain.gain.events[1]!.value).toBe(amplitude);
        expect(gain.gain.events[1]!.time).toBeCloseTo(voiceStart + 0.020, 8);
        expect(gain.gain.events[2]!.kind).toBe('linear');
        expect(gain.gain.events[2]!.value).toBeCloseTo(amplitude * 0.7, 8);
        expect(gain.gain.events[2]!.time).toBeCloseTo(voiceStart + 0.120, 8);
        expect(gain.gain.events[3]!.kind).toBe('set');
        expect(gain.gain.events[3]!.value).toBeCloseTo(amplitude * 0.7, 8);
        expect(gain.gain.events[3]!.time).toBeCloseTo(voiceStart + duration - 0.200, 8);
        expect(gain.gain.events[4]).toEqual({ kind: 'linear', value: 0, time: voiceStart + duration });
      }

      offset += HARMONICS.length;
    }
  });

  it('uses per-voice formant harmonics instead of the uniform table', () => {
    const ctx = new FakeAudioContext();
    const freqs = [110, 220, 330, 440];
    const expectedProfiles = freqs.map((freq, idx) =>
      normalizedFormantHarmonics(freq, voicePartForIndex(idx)),
    );

    scheduleChord(
      ctx as unknown as BaseAudioContext,
      ctx.destination as unknown as AudioNode,
      freqs,
      1,
      0.75,
      'block',
      'human',
    );

    expect(ctx.oscillators).toHaveLength(
      expectedProfiles.reduce((sum, profile) => sum + profile.length, 0),
    );
    expect(ctx.oscillators.length).not.toBe(freqs.length * HARMONICS.length);

    let offset = 0;
    for (const [voiceIdx, profile] of expectedProfiles.entries()) {
      const scheduledOscillators = ctx.oscillators.slice(offset, offset + profile.length);
      const scheduledGains = harmonicGains(ctx).slice(offset, offset + profile.length);
      const voiceStart = 1 + onsetOffsetForVoicePart(voicePartForIndex(voiceIdx));

      for (const [harmonicIdx, [harmonic, amplitude]] of profile.entries()) {
        expect(scheduledOscillators[harmonicIdx]!.frequency.value)
          .toBeCloseTo(freqs[voiceIdx]! * harmonic, 8);
        expect(scheduledGains[harmonicIdx]!.gain.events[1]).toEqual({
          kind: 'linear',
          value: amplitude,
          time: attackPeakTime(voiceStart, harmonic),
        });
        expect(scheduledGains[harmonicIdx]!.gain.events[2]!.value)
          .toBeCloseTo(amplitude * 0.7, 8);
      }

      offset += profile.length;
    }
  });

  it('assigns formants by frequency rank for crossed voicings while preserving slot timing', () => {
    const ctx = new FakeAudioContext();
    const freqs = [330, 110, 440, 220];
    const expectedVoiceParts = ['Lead', 'Bass', 'Tenor', 'Bari'] as const;
    const expectedProfiles = freqs.map((freq, idx) =>
      normalizedFormantHarmonics(freq, expectedVoiceParts[idx]!),
    );

    scheduleChord(
      ctx as unknown as BaseAudioContext,
      ctx.destination as unknown as AudioNode,
      freqs,
      0.5,
      1,
      'arpeggio',
      'human',
    );

    let offset = 0;
    for (const [voiceIdx, profile] of expectedProfiles.entries()) {
      const scheduledOscillators = ctx.oscillators.slice(offset, offset + profile.length);
      const scheduledGains = harmonicGains(ctx).slice(offset, offset + profile.length);
      const voiceStart = 0.5 + voiceIdx * 0.080
        + onsetOffsetForVoicePart(expectedVoiceParts[voiceIdx]!);

      expect(scheduledOscillators[0]!.startTime).toBeCloseTo(voiceStart, 8);
      expect(scheduledGains[0]!.gain.events[0]).toEqual({
        kind: 'set',
        value: 0,
        time: voiceStart,
      });

      for (const [harmonicIdx, [harmonic, amplitude]] of profile.entries()) {
        expect(scheduledOscillators[harmonicIdx]!.frequency.value)
          .toBeCloseTo(freqs[voiceIdx]! * harmonic, 8);
        expect(scheduledGains[harmonicIdx]!.gain.events[1]).toEqual({
          kind: 'linear',
          value: amplitude,
          time: attackPeakTime(voiceStart, harmonic),
        });
      }

      offset += profile.length;
    }
  });

  it('adds deterministic block onset offsets by ranked voice part', () => {
    const ctx = new FakeAudioContext();
    const freqs = [220, 110, 440, 330];
    const expectedVoiceParts = ['Bari', 'Bass', 'Tenor', 'Lead'] as const;
    const expectedProfiles = freqs.map((freq, idx) =>
      normalizedFormantHarmonics(freq, expectedVoiceParts[idx]!),
    );

    scheduleChord(
      ctx as unknown as BaseAudioContext,
      ctx.destination as unknown as AudioNode,
      freqs,
      1,
      0.75,
      'block',
      'human',
    );

    let offset = 0;
    for (const [voiceIdx, profile] of expectedProfiles.entries()) {
      const scheduledOscillators = ctx.oscillators.slice(offset, offset + profile.length);
      const scheduledGains = harmonicGains(ctx).slice(offset, offset + profile.length);
      const voiceStart = 1 + onsetOffsetForVoicePart(expectedVoiceParts[voiceIdx]!);

      expect(scheduledOscillators[0]!.startTime).toBeCloseTo(voiceStart, 8);
      expect(scheduledGains[0]!.gain.events[0]).toEqual({
        kind: 'set',
        value: 0,
        time: voiceStart,
      });

      offset += profile.length;
    }
  });

  it('normalizes computed profiles to unit energy before ADSR scheduling', () => {
    const lowVoice = computeHarmonics(110, 'Bass');
    const highVoice = computeHarmonics(330, 'Tenor');
    expect(lowVoice.length).toBeGreaterThan(highVoice.length);

    const lowNormalized = normalizedFormantHarmonics(110, 'Bass');
    const highNormalized = normalizedFormantHarmonics(330, 'Tenor');

    expect(profileEnergy(lowNormalized)).toBeCloseTo(1, 8);
    expect(profileEnergy(highNormalized)).toBeCloseTo(1, 8);
    expect(profileEnergy(lowVoice)).toBeGreaterThan(profileEnergy(highVoice));
  });

  it('puts production-normalized vowel energy in the front /ae/ F2 band', () => {
    const baseFreq = 220;
    const profile = normalizedFormantHarmonics(baseFreq, 'Lead');

    const aeF2Energy = bandEnergy(profile, baseFreq, 1500, 1900);
    const oldBackF2Energy = bandEnergy(profile, baseFreq, 950, 1300);

    expect(aeF2Energy).toBeGreaterThan(oldBackF2Energy);
  });

  it('keeps Bass 110 Hz warm by including audible H1 through H3', () => {
    const profile = normalizedFormantHarmonics(110, 'Bass');
    const amplitudes = new Map(profile);

    expect(amplitudes.get(1)).toBeGreaterThan(0.20);
    expect(amplitudes.get(2)).toBeGreaterThan(0.15);
    expect(amplitudes.get(3)).toBeGreaterThan(0.10);
  });

  it('keeps meaningful low-harmonic energy after production normalization', () => {
    const profile = normalizedFormantHarmonics(110, 'Bass');

    expect(harmonicEnergy(profile, harmonic => harmonic <= 3)).toBeGreaterThanOrEqual(0.15);
    expect(harmonicEnergy(profile, harmonic => harmonic <= 4)).toBeGreaterThanOrEqual(0.20);
  });

  it('keeps high-frequency energy below low and mid energy', () => {
    const baseFreq = 110;
    const profile = normalizedFormantHarmonics(baseFreq, 'Bass');
    const highEnergy = harmonicEnergy(profile, harmonic => harmonic * baseFreq > 2000);
    const lowMidEnergy = harmonicEnergy(profile, harmonic => harmonic * baseFreq <= 2000);

    expect(highEnergy).toBeLessThan(0.25);
    expect(highEnergy).toBeLessThan(lowMidEnergy * 0.35);
  });

  it('preserves ADSR timing for each scheduled harmonic', () => {
    const ctx = new FakeAudioContext();
    const profile = normalizedFormantHarmonics(220, 'Bass');

    scheduleChord(
      ctx as unknown as BaseAudioContext,
      ctx.destination as unknown as AudioNode,
      [220],
      2,
      1,
      'block',
      'human',
    );

    const firstGain = harmonicGains(ctx)[0]!;
    const amplitude = profile[0]![1];

    expect(firstGain.gain.events).toHaveLength(5);
    expect(firstGain.gain.events[0]).toEqual({ kind: 'set', value: 0, time: 2 });
    expect(firstGain.gain.events[1]).toEqual({ kind: 'linear', value: amplitude, time: 2.02 });
    expect(firstGain.gain.events[2]).toEqual({
      kind: 'linear',
      value: amplitude * 0.7,
      time: 2.12,
    });
    expect(firstGain.gain.events[3]).toEqual({
      kind: 'set',
      value: amplitude * 0.7,
      time: 2.8,
    });
    expect(firstGain.gain.events[4]).toEqual({ kind: 'linear', value: 0, time: 3 });
  });

  it('blooms higher harmonic attacks later while preserving release timing', () => {
    const ctx = new FakeAudioContext();
    const profile = normalizedFormantHarmonics(220, 'Bass');
    const h1Index = profile.findIndex(([harmonic]) => harmonic === 1);
    const h8Index = profile.findIndex(([harmonic]) => harmonic === 8);
    expect(h1Index).toBeGreaterThanOrEqual(0);
    expect(h8Index).toBeGreaterThanOrEqual(0);

    scheduleChord(
      ctx as unknown as BaseAudioContext,
      ctx.destination as unknown as AudioNode,
      [220],
      0.25,
      1,
      'block',
      'human',
    );

    const h1Gain = harmonicGains(ctx)[h1Index]!;
    const h8Gain = harmonicGains(ctx)[h8Index]!;
    const h1AttackPeak = h1Gain.gain.events[1]!;
    const h8AttackPeak = h8Gain.gain.events[1]!;

    expect(h1AttackPeak.time).toBeCloseTo(attackPeakTime(0.25, 1), 8);
    expect(h8AttackPeak.time).toBeCloseTo(attackPeakTime(0.25, 8), 8);
    expect(h8AttackPeak.time).toBeGreaterThan(h1AttackPeak.time);
    expect(h8Gain.gain.events[2]!.time).toBeCloseTo(h8AttackPeak.time + 0.100, 8);
    expect(h8Gain.gain.events[3]!.time).toBeCloseTo(1.05, 8);
    expect(h8Gain.gain.events[4]!.time).toBeCloseTo(1.25, 8);
  });
});
