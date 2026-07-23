import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeHarmonics } from './formants';
import {
  ChordPlayer,
  envelope,
  HARMONICS,
  normalizedFormantHarmonics,
  renderSequenceOffline,
  SAMPLE_RATE,
  scheduleChord,
  voicePartForIndex,
} from './audio';
import { VOICE_PARTS, type Pitch, type PitchClass, type VoicePart } from '../types';

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

  cancelScheduledValues(_time: number): FakeAudioParam {
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

// Fake OfflineAudioContext for renderSequenceOffline tests.
// Captures constructor dimensions and resolves startRendering() instantly.
class FakeOfflineAudioContext {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  readonly destination = new FakeGainNode();

  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
  }

  createGain(): FakeGainNode { return new FakeGainNode(); }
  createOscillator(): FakeOscillatorNode { return new FakeOscillatorNode(); }

  startRendering(): Promise<AudioBuffer> {
    const { numberOfChannels, length, sampleRate } = this;
    return Promise.resolve({
      numberOfChannels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length),
    } as unknown as AudioBuffer);
  }
}

// Fake AudioContext for ChordPlayer lifecycle tests.
// State is 'running' so ensureRunning() returns immediately.
// Omits createMediaStreamDestination so createSilentMediaBridge returns null safely.
class FakeAudioContextForPlayer {
  state: AudioContextState = 'running';
  currentTime = 0;
  sampleRate = 44100;
  readonly destination = new FakeGainNode();

  createGain(): FakeGainNode { return new FakeGainNode(); }
  createOscillator(): FakeOscillatorNode { return new FakeOscillatorNode(); }
  resume(): Promise<void> { return Promise.resolve(); }
  close(): Promise<void> { return Promise.resolve(); }
}

// Shared test chords
const C4: Pitch = { pitchClass: 'C', octave: 4 };
const E4: Pitch = { pitchClass: 'E', octave: 4 };
const G4: Pitch = { pitchClass: 'G', octave: 4 };
const C5: Pitch = { pitchClass: 'C', octave: 5 };
const B4: Pitch = { pitchClass: 'B', octave: 4 };
const D5: Pitch = { pitchClass: 'D', octave: 5 };
const G5: Pitch = { pitchClass: 'G', octave: 5 };

const cMajorChord = { root: 'C' as PitchClass, pitches: [C4, E4, G4, C5] };
const gMajorChord = { root: 'G' as PitchClass, pitches: [G4, B4, D5, G5] };

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

// Release tail appended to every offline render so the last chord decays cleanly.
const RELEASE_TAIL = 0.2;
// Inter-chord gap as a fraction of the chord duration.
const GAP_FACTOR = 0.08;
// Arpeggio step delay per voice.
const ARP_DELAY = 0.08;

describe('renderSequenceOffline', () => {
  beforeEach(() => {
    vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('empty sequence produces a mono 44100 Hz buffer of just the release tail', async () => {
    const buffer = await renderSequenceOffline([], 1.0, 'equal', 'block', 'organ');
    expect(buffer.numberOfChannels).toBe(1);
    expect(buffer.sampleRate).toBe(SAMPLE_RATE);
    expect(buffer.length).toBe(Math.ceil(RELEASE_TAIL * SAMPLE_RATE));
  });

  it('single 4-voice block-organ chord produces duration + release tail', async () => {
    const buffer = await renderSequenceOffline([cMajorChord], 1.0, 'equal', 'block', 'organ');
    expect(buffer.numberOfChannels).toBe(1);
    expect(buffer.sampleRate).toBe(SAMPLE_RATE);
    expect(buffer.length).toBe(Math.ceil((1.0 + RELEASE_TAIL) * SAMPLE_RATE));
  });

  it('two-chord sequence includes one inter-chord gap in buffer length', async () => {
    const buffer = await renderSequenceOffline(
      [cMajorChord, gMajorChord], 1.0, 'equal', 'block', 'organ',
    );
    // 1.0 chord + 0.08 gap + 1.0 chord + 0.2 release
    const expected = Math.ceil((1.0 + GAP_FACTOR + 1.0 + RELEASE_TAIL) * SAMPLE_RATE);
    expect(buffer.length).toBe(expected);
  });

  it('arpeggio style adds onset spread per extra voice to buffer length', async () => {
    const buffer = await renderSequenceOffline([cMajorChord], 1.0, 'equal', 'arpeggio', 'organ');
    // 4 voices → 3 extra arp delays: 1.0 + 3×0.08 + 0.2 release
    const expected = Math.ceil((1.0 + 3 * ARP_DELAY + RELEASE_TAIL) * SAMPLE_RATE);
    expect(buffer.length).toBe(expected);
  });
});

describe('ChordPlayer lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', FakeAudioContextForPlayer);
    // window.setTimeout / window.clearTimeout are used inside ChordPlayer.
    // Pointing window at globalThis ensures they resolve to the fake timer versions.
    vi.stubGlobal('window', globalThis);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('warmUp creates the AudioContext without throwing', () => {
    const player = new ChordPlayer();
    expect(() => player.warmUp()).not.toThrow();
  });

  it('playChord resolves after its duration timer fires', async () => {
    const player = new ChordPlayer();
    const p = player.playChord('C', [C4, E4, G4, C5], 0.5, 'equal', 'block', 'organ');
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });

  it('playSequence calls onChordStart for each chord in order', async () => {
    const player = new ChordPlayer();
    const started: number[] = [];
    const p = player.playSequence(
      [cMajorChord, gMajorChord], 0.5, 'equal', 'block',
      (i) => started.push(i),
      'organ',
    );
    await vi.runAllTimersAsync();
    expect(started).toEqual([0, 1]);
    await p;
  });

  it('stopCurrent prevents subsequent chord starts in an active sequence', async () => {
    const player = new ChordPlayer();
    const started: number[] = [];
    const p = player.playSequence(
      [cMajorChord, gMajorChord, cMajorChord], 0.5, 'equal', 'block',
      (i) => started.push(i),
      'organ',
    );
    // onChordStart(0) fires synchronously before the first await inside playSequence
    expect(started).toEqual([0]);
    player.stopCurrent();
    await vi.runAllTimersAsync();
    expect(started).toEqual([0]);
    await p;
  });

  it('destroy does not throw after warmUp', () => {
    const player = new ChordPlayer();
    player.warmUp();
    expect(() => player.destroy()).not.toThrow();
  });
});
