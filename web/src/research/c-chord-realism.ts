import { scheduleChord } from '../engine/audio';
import {
  computeHarmonicsFromProfile,
  type Formant,
} from '../engine/formants';
import { pitchFrequency } from '../engine/musicTheory';
import type { SynthParams } from './formantSynth';
import { PRESETS } from './presets';

const TECHNIQUE_IDS = [
  'organ-baseline',
  'current-voices',
  'research-formant-voices',
  'choir-blend',
  'warm-covered',
  'breathy-airy',
  'source-filter-singer',
  'stereo-room-enhanced',
  'sampled-voices',
] as const;

export type TechniqueId = typeof TECHNIQUE_IDS[number];

export type ChordVoice = 'Bass' | 'Bari' | 'Lead' | 'Tenor';

export interface ChordTone {
  readonly voice: ChordVoice;
  readonly label: string;
  readonly frequency: number;
}

export interface TechniqueContext {
  readonly audioContext: AudioContext;
  readonly destination: AudioNode;
  readonly startTime: number;
  readonly duration: number;
  readonly chord: readonly ChordTone[];
  readonly frequencies: readonly number[];
  readonly registerActiveNode: typeof registerActiveNode;
  readonly registerActiveNodes: typeof registerActiveNodes;
  readonly setStatus: typeof setStatus;
}

export interface TechniquePlaybackTiming {
  readonly startTime: number;
  readonly duration: number;
}

export interface Technique {
  readonly id: TechniqueId;
  readonly label: string;
  readonly description: string;
  readonly play: (
    context: TechniqueContext,
  ) => TechniquePlaybackTiming | void | Promise<TechniquePlaybackTiming | void>;
}

export const C_MAJOR_VOICING: readonly ChordTone[] = [
  { voice: 'Bass', label: 'C3', frequency: pitchFrequency({ pitchClass: 'C', octave: 3 }) },
  { voice: 'Bari', label: 'G3', frequency: pitchFrequency({ pitchClass: 'G', octave: 3 }) },
  { voice: 'Lead', label: 'E4', frequency: pitchFrequency({ pitchClass: 'E', octave: 4 }) },
  { voice: 'Tenor', label: 'C5', frequency: pitchFrequency({ pitchClass: 'C', octave: 5 }) },
];

export const C_CHORD_FREQUENCIES: readonly number[] = C_MAJOR_VOICING.map(
  ({ frequency }) => frequency,
);

const CHORD_DURATION_SECONDS = 2.8;
const SCHEDULE_LEAD_IN_SECONDS = 0.05;
const STOP_FADE_SECONDS = 0.06;
const CLEANUP_MARGIN_SECONDS = 0.25;
const FORMANT_ATTACK_SECONDS = 0.06;
const FORMANT_RELEASE_SECONDS = 0.24;
const FORMANT_VOICE_GAIN = 0.13;
const FORMANT_SOURCE_STOP_MARGIN_SECONDS = 0.03;
const BREATH_NOISE_BUFFER_SECONDS = 2;
const BREATH_FORMANT_GAIN = 0.2;
const AMP_JITTER_RATE_HZ = 3.17;
const SPATIAL_ROOM_IMPULSE_SECONDS = 0.22;
const SPATIAL_ROOM_DECAY = 2.6;
const SPATIAL_ROOM_DRY_GAIN = 0.86;
const SPATIAL_ROOM_WET_GAIN = 0.16;
const SPATIAL_ROOM_PRE_DELAY_SECONDS = 0.018;
const SPATIAL_DELAY_FALLBACK_SECONDS = 0.095;
const SPATIAL_DELAY_FALLBACK_FEEDBACK = 0.18;
const SAMPLED_VOICE_SAMPLE_URL =
  new URL(
    './sampled-voices/crwdsing-ahh-vowel-near-f-shangusburger-764221-preview.mp3',
    import.meta.url,
  ).href;
const SAMPLED_VOICE_REFERENCE_FREQUENCY_HZ = pitchFrequency({ pitchClass: 'F', octave: 4 });
const SAMPLED_VOICE_GAIN = 0.15;
const SAMPLED_VOICE_OFFSET_SECONDS = 0.15;
const SAMPLED_VOICE_SOURCE_STOP_MARGIN_SECONDS = 0.04;
const SOURCE_FILTER_PROCESSOR_NAME = 'source-filter-voice';
const SOURCE_FILTER_WORKLET_MODULE_URL =
  new URL('./source-filter-voice-processor.js', import.meta.url);
const SOURCE_FILTER_PARAM_GAIN = 0.58;
const SOURCE_FILTER_OUTPUT_GAIN = 0.34;
const SOURCE_FILTER_BRIGHTNESS = 0.52;
const SOURCE_FILTER_JITTER = 0.0025;
const SOURCE_FILTER_SHIMMER = 0.018;
const SOURCE_FILTER_VOWEL = 0;

type ResearchPresetName = 'Choir Blend' | 'Dark / Covered' | 'Breathy';

interface FormantVoiceOptions {
  readonly detuneCents?: number;
  readonly gainScale?: number;
}

interface SpatialVoiceConfig {
  readonly pan: number;
  readonly onsetOffsetSeconds: number;
  readonly gainScale: number;
  readonly detuneCents: number;
}

interface SpatialRoomGraph {
  readonly input: GainNode;
  readonly nodes: readonly AudioNode[];
  readonly description: string;
}

const SPATIAL_VOICE_CONFIG: Record<ChordVoice, SpatialVoiceConfig> = {
  Bass: { pan: -0.48, onsetOffsetSeconds: 0, gainScale: 1.06, detuneCents: -1.5 },
  Bari: { pan: -0.16, onsetOffsetSeconds: 0.011, gainScale: 0.96, detuneCents: 1.2 },
  Lead: { pan: 0.18, onsetOffsetSeconds: 0.006, gainScale: 1.0, detuneCents: 0.7 },
  Tenor: { pan: 0.5, onsetOffsetSeconds: 0.018, gainScale: 0.88, detuneCents: -0.9 },
};

const SOURCE_FILTER_VOICE_SEEDS: Record<ChordVoice, number> = {
  Bass: 0xc001b455,
  Bari: 0xba71c001,
  Lead: 0x1eadc001,
  Tenor: 0x7e10c001,
};

let audioContext: AudioContext | null = null;

const activeAudioNodes = new Set<AudioNode>();
const activeGainNodes = new Set<GainNode>();
const activeSources = new Set<AudioScheduledSourceNode>();
const cleanupTimers = new Set<number>();
const sampledVoiceBufferCache = new WeakMap<AudioContext, Promise<AudioBuffer>>();
const sourceFilterWorkletModuleCache = new WeakMap<AudioContext, Promise<void>>();

const statusOutput = getRequiredElement<HTMLOutputElement>('status-output');
const stopButton = getRequiredElement<HTMLButtonElement>('stop-btn');
const techniqueButtons = new Map<TechniqueId, HTMLButtonElement>();

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  return element as T;
}

function isTechniqueId(value: string): value is TechniqueId {
  return TECHNIQUE_IDS.includes(value as TechniqueId);
}

export function setStatus(message: string): void {
  statusOutput.textContent = message;
}

function formatChord(chord: readonly ChordTone[] = C_MAJOR_VOICING): string {
  return chord
    .map(({ voice, label, frequency }) => `${voice} ${label} ${frequency.toFixed(2)} Hz`)
    .join('\n');
}

async function ensureAudioContext(): Promise<AudioContext> {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  return audioContext;
}

function clearCleanupTimers(): void {
  for (const timer of cleanupTimers) {
    window.clearTimeout(timer);
  }
  cleanupTimers.clear();
}

function scheduleCleanup(delaySeconds: number, nodes: Iterable<AudioNode>): void {
  const nodesToDisconnect = [...nodes];
  const timer = window.setTimeout(() => {
    cleanupTimers.delete(timer);
    disconnectNodes(nodesToDisconnect);
  }, Math.max(0, delaySeconds) * 1000);
  cleanupTimers.add(timer);
}

function disconnectActiveNodes(): void {
  disconnectNodes([...activeAudioNodes]);
}

function disconnectNodes(nodes: Iterable<AudioNode>): void {
  for (const node of nodes) {
    node.disconnect();
    activeAudioNodes.delete(node);

    if (node instanceof GainNode) {
      activeGainNodes.delete(node);
    }

    if (node instanceof AudioScheduledSourceNode) {
      activeSources.delete(node);
    }
  }

  updateStopButton();
}

function stopSource(source: AudioScheduledSourceNode, when: number): void {
  try {
    source.stop(when);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'InvalidStateError')) {
      throw error;
    }
  }
}

export function registerActiveNode(node: AudioNode): void {
  activeAudioNodes.add(node);

  if (node instanceof GainNode) {
    activeGainNodes.add(node);
  }

  if (node instanceof AudioScheduledSourceNode) {
    activeSources.add(node);
    node.addEventListener('ended', () => {
      activeSources.delete(node);
      updateStopButton();
    }, { once: true });
  }

  updateStopButton();
}

export function registerActiveNodes(nodes: Iterable<AudioNode>): void {
  for (const node of nodes) {
    registerActiveNode(node);
  }
}

export function stopActiveNodes(fadeSeconds = STOP_FADE_SECONDS): void {
  clearCleanupTimers();

  if (!audioContext) {
    disconnectActiveNodes();
    return;
  }

  const now = audioContext.currentTime;
  const stopAt = now + Math.max(0, fadeSeconds);
  const nodesToStop = [...activeAudioNodes];
  const gainNodesToFade = [...activeGainNodes];
  const sourcesToStop = [...activeSources];

  for (const gainNode of gainNodesToFade) {
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setTargetAtTime(0, now, Math.max(0.001, fadeSeconds / 3));
  }

  for (const source of sourcesToStop) {
    stopSource(source, stopAt);
  }

  scheduleCleanup(fadeSeconds + CLEANUP_MARGIN_SECONDS, nodesToStop);
  updateStopButton();
}

function createTechniqueContext(ctx: AudioContext): TechniqueContext {
  return {
    audioContext: ctx,
    destination: ctx.destination,
    startTime: ctx.currentTime + SCHEDULE_LEAD_IN_SECONDS,
    duration: CHORD_DURATION_SECONDS,
    chord: C_MAJOR_VOICING,
    frequencies: C_CHORD_FREQUENCIES,
    registerActiveNode,
    registerActiveNodes,
    setStatus,
  };
}

function createScheduledChordTechnique(
  id: TechniqueId,
  label: string,
  description: string,
  soundMode: 'organ' | 'human',
): Technique {
  return {
    id,
    label,
    description,
    play: ({
      audioContext: ctx,
      destination,
      frequencies,
      startTime,
      duration,
      registerActiveNodes: registerNodes,
      setStatus: updateStatus,
    }) => {
      const { oscillators, gains } = scheduleChord(
        ctx,
        destination,
        [...frequencies],
        startTime,
        duration,
        'block',
        soundMode,
      );
      registerNodes([...oscillators, ...gains]);

      const voiceDescription = soundMode === 'organ'
        ? 'clean organ oscillator baseline'
        : 'current human/formant voice baseline';
      updateStatus(`Playing ${label}: ${voiceDescription}.\n\nChord tones:\n${formatChord()}`);
    },
  };
}

function getPresetParams(name: ResearchPresetName): SynthParams {
  const preset = PRESETS.find((candidate) => candidate.name === name);
  if (!preset) {
    throw new Error(`Missing research preset: ${name}`);
  }

  return preset.params;
}

function cloneFormants(formants: readonly Formant[]): Formant[] {
  return formants.map(({ freq, amp, bw }) => ({ freq, amp, bw }));
}

async function ensureSourceFilterWorklet(ctx: AudioContext): Promise<void> {
  if (!ctx.audioWorklet || typeof ctx.audioWorklet.addModule !== 'function') {
    throw new Error('AudioWorklet.addModule is unavailable in this browser/context');
  }

  if (typeof AudioWorkletNode === 'undefined') {
    throw new Error('AudioWorkletNode is unavailable in this browser');
  }

  const cachedModule = sourceFilterWorkletModuleCache.get(ctx);
  if (cachedModule) {
    return cachedModule;
  }

  const moduleLoad = ctx.audioWorklet.addModule(SOURCE_FILTER_WORKLET_MODULE_URL);
  sourceFilterWorkletModuleCache.set(ctx, moduleLoad);

  try {
    await moduleLoad;
  } catch (error) {
    if (sourceFilterWorkletModuleCache.get(ctx) === moduleLoad) {
      sourceFilterWorkletModuleCache.delete(ctx);
    }
    throw new Error(`source-filter worklet load failed: ${errorMessage(error)}`);
  }
}

function setWorkletParam(
  node: AudioWorkletNode,
  name: string,
  value: number,
  startTime: number,
): void {
  node.parameters.get(name)?.setValueAtTime(value, startTime);
}

function scheduleWorkletGain(
  node: AudioWorkletNode,
  currentTime: number,
  startTime: number,
  duration: number,
): void {
  const gainParam = node.parameters.get('gain');
  if (!gainParam) {
    return;
  }

  gainParam.cancelScheduledValues(currentTime);
  gainParam.setValueAtTime(0, currentTime);
  scheduleEnvelope(gainParam, startTime, duration, SOURCE_FILTER_PARAM_GAIN);
}

function rmsNormalize(harmonics: readonly (readonly [number, number])[]): number {
  const sumSquares = harmonics.reduce((sum, [, amplitude]) => sum + amplitude * amplitude, 0);
  return Math.sqrt(sumSquares) || 1;
}

function centsToFrequencyRatio(cents: number): number {
  return 2 ** (cents / 1200);
}

function playbackRateForTone(tone: ChordTone): number {
  return tone.frequency / SAMPLED_VOICE_REFERENCE_FREQUENCY_HZ;
}

function scheduleEnvelope(
  gain: AudioParam,
  startTime: number,
  duration: number,
  targetGain: number,
): void {
  const endTime = startTime + duration;
  const attackSeconds = Math.min(FORMANT_ATTACK_SECONDS, duration * 0.25);
  const releaseSeconds = Math.min(
    FORMANT_RELEASE_SECONDS,
    Math.max(0, duration - attackSeconds) * 0.5,
  );
  const attackEnd = startTime + attackSeconds;
  const releaseStart = Math.max(attackEnd, endTime - releaseSeconds);

  gain.cancelScheduledValues(startTime);
  gain.setValueAtTime(0, startTime);
  gain.linearRampToValueAtTime(targetGain, attackEnd);
  gain.setValueAtTime(targetGain, releaseStart);
  gain.linearRampToValueAtTime(0, endTime);
}

function createBreathNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const bufferSize = Math.max(1, Math.ceil(BREATH_NOISE_BUFFER_SECONDS * ctx.sampleRate));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

function scheduleBreathNoise(
  ctx: AudioContext,
  output: AudioNode,
  formants: readonly Formant[],
  breathMix: number,
  startTime: number,
  stopTime: number,
  nodes: AudioNode[],
): void {
  const noise = ctx.createBufferSource();
  noise.buffer = createBreathNoiseBuffer(ctx);
  noise.loop = true;

  const breathGain = ctx.createGain();
  breathGain.gain.setValueAtTime(breathMix, startTime);
  breathGain.connect(output);

  nodes.push(noise, breathGain);

  for (const formant of formants) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(formant.freq, startTime);
    filter.Q.setValueAtTime(formant.freq / (formant.bw * 2), startTime);

    const formantGain = ctx.createGain();
    formantGain.gain.setValueAtTime(formant.amp * BREATH_FORMANT_GAIN, startTime);

    noise.connect(filter);
    filter.connect(formantGain);
    formantGain.connect(breathGain);

    nodes.push(filter, formantGain);
  }

  noise.start(startTime);
  noise.stop(stopTime);
}

function createGeneratedRoomImpulse(ctx: AudioContext): AudioBuffer {
  const frameCount = Math.max(1, Math.ceil(SPATIAL_ROOM_IMPULSE_SECONDS * ctx.sampleRate));
  const buffer = ctx.createBuffer(2, frameCount, ctx.sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    let seed = channel === 0 ? 0x5eed1234 : 0x9e3779b9;

    for (let frame = 0; frame < frameCount; frame++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

      const noise = seed / 0x80000000 - 1;
      const progress = frame / frameCount;
      const decay = (1 - progress) ** SPATIAL_ROOM_DECAY;
      data[frame] = noise * decay * 0.45;
    }
  }

  return buffer;
}

function createSpatialRoomGraph(ctx: AudioContext, destination: AudioNode): SpatialRoomGraph {
  const nodes: AudioNode[] = [];
  const input = ctx.createGain();
  input.gain.setValueAtTime(1, ctx.currentTime);
  nodes.push(input);

  const dryGain = ctx.createGain();
  dryGain.gain.setValueAtTime(SPATIAL_ROOM_DRY_GAIN, ctx.currentTime);
  input.connect(dryGain);
  dryGain.connect(destination);
  nodes.push(dryGain);

  if (typeof ctx.createConvolver === 'function') {
    const convolver = ctx.createConvolver();
    convolver.buffer = createGeneratedRoomImpulse(ctx);

    const wetGain = ctx.createGain();
    wetGain.gain.setValueAtTime(SPATIAL_ROOM_WET_GAIN, ctx.currentTime);

    if (typeof ctx.createDelay === 'function') {
      const preDelay = ctx.createDelay(SPATIAL_ROOM_PRE_DELAY_SECONDS);
      preDelay.delayTime.setValueAtTime(SPATIAL_ROOM_PRE_DELAY_SECONDS, ctx.currentTime);
      input.connect(preDelay);
      preDelay.connect(convolver);
      nodes.push(preDelay);
    } else {
      input.connect(convolver);
    }

    convolver.connect(wetGain);
    wetGain.connect(destination);
    nodes.push(convolver, wetGain);

    return {
      input,
      nodes,
      description: 'a deterministic generated impulse room',
    };
  }

  if (typeof ctx.createDelay === 'function') {
    const delay = ctx.createDelay(SPATIAL_DELAY_FALLBACK_SECONDS * 2);
    delay.delayTime.setValueAtTime(SPATIAL_DELAY_FALLBACK_SECONDS, ctx.currentTime);

    const feedback = ctx.createGain();
    feedback.gain.setValueAtTime(SPATIAL_DELAY_FALLBACK_FEEDBACK, ctx.currentTime);

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(2400, ctx.currentTime);

    const wetGain = ctx.createGain();
    wetGain.gain.setValueAtTime(SPATIAL_ROOM_WET_GAIN * 0.6, ctx.currentTime);

    input.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(tone);
    tone.connect(wetGain);
    wetGain.connect(destination);
    nodes.push(delay, feedback, tone, wetGain);

    return {
      input,
      nodes,
      description: 'a short feedback-delay room fallback',
    };
  }

  return {
    input,
    nodes,
    description: 'dry direct routing because room nodes are unavailable',
  };
}

function scheduleSingleFormantVoice(
  ctx: AudioContext,
  destination: AudioNode,
  tone: ChordTone,
  presetParams: SynthParams,
  startTime: number,
  duration: number,
  registerNodes: typeof registerActiveNodes,
  options: FormantVoiceOptions = {},
): void {
  const detunedFrequency = tone.frequency * centsToFrequencyRatio(options.detuneCents ?? 0);
  const voiceGain = FORMANT_VOICE_GAIN * (options.gainScale ?? 1);
  const params: SynthParams = {
    ...presetParams,
    f0: detunedFrequency,
  };
  const harmonics = computeHarmonicsFromProfile(
    params.f0,
    params.formants,
    params.tiltExponent,
  );

  if (harmonics.length === 0) {
    throw new Error(`No formant harmonics generated for ${tone.voice} ${tone.label}`);
  }

  const nodes: AudioNode[] = [];
  const oscillators: { oscillator: OscillatorNode; frequency: number }[] = [];
  const stopTime = startTime + duration + FORMANT_SOURCE_STOP_MARGIN_SECONDS;
  const amplitudeNorm = rmsNormalize(harmonics);

  const envelopeGain = ctx.createGain();
  envelopeGain.gain.value = 0;
  scheduleEnvelope(envelopeGain.gain, startTime, duration, voiceGain);
  envelopeGain.connect(destination);
  nodes.push(envelopeGain);

  const jitteredGain = ctx.createGain();
  jitteredGain.gain.setValueAtTime(1, startTime);
  jitteredGain.connect(envelopeGain);
  nodes.push(jitteredGain);

  for (const [harmonic, amplitude] of harmonics) {
    const harmonicFrequency = harmonic * params.f0;
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(harmonicFrequency, startTime);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(amplitude / amplitudeNorm, startTime);

    oscillator.connect(harmonicGain);
    harmonicGain.connect(jitteredGain);
    oscillator.start(startTime);
    oscillator.stop(stopTime);

    oscillators.push({ oscillator, frequency: harmonicFrequency });
    nodes.push(oscillator, harmonicGain);
  }

  if (params.vibratoRate > 0 && params.vibratoDepth > 0) {
    const vibratoLfo = ctx.createOscillator();
    vibratoLfo.type = 'sine';
    vibratoLfo.frequency.setValueAtTime(params.vibratoRate, startTime);

    for (const { oscillator, frequency } of oscillators) {
      const modulationGain = ctx.createGain();
      modulationGain.gain.setValueAtTime(frequency * params.vibratoDepth, startTime);
      vibratoLfo.connect(modulationGain);
      modulationGain.connect(oscillator.frequency);
      nodes.push(modulationGain);
    }

    vibratoLfo.start(startTime);
    vibratoLfo.stop(stopTime);
    nodes.push(vibratoLfo);
  }

  if (params.breathMix > 0) {
    scheduleBreathNoise(
      ctx,
      jitteredGain,
      params.formants,
      params.breathMix,
      startTime,
      stopTime,
      nodes,
    );
  }

  if (params.ampJitter > 0) {
    const jitterLfo = ctx.createOscillator();
    jitterLfo.type = 'sine';
    jitterLfo.frequency.setValueAtTime(AMP_JITTER_RATE_HZ, startTime);

    const jitterDepth = ctx.createGain();
    jitterDepth.gain.setValueAtTime(params.ampJitter, startTime);

    jitterLfo.connect(jitterDepth);
    jitterDepth.connect(jitteredGain.gain);
    jitterLfo.start(startTime);
    jitterLfo.stop(stopTime);

    nodes.push(jitterLfo, jitterDepth);
  }

  registerNodes(nodes);
}

function createFormantPresetTechnique(
  id: TechniqueId,
  label: string,
  description: string,
  presetName: ResearchPresetName,
): Technique {
  return {
    id,
    label,
    description,
    play: ({
      audioContext: ctx,
      destination,
      chord,
      startTime,
      duration,
      registerActiveNodes: registerNodes,
      setStatus: updateStatus,
    }) => {
      const presetParams = getPresetParams(presetName);

      for (const tone of chord) {
        scheduleSingleFormantVoice(
          ctx,
          destination,
          tone,
          presetParams,
          startTime,
          duration,
          registerNodes,
        );
      }

      updateStatus(
        `Playing ${label}: ${presetName} formant preset with per-tone f0 override.\n\nChord tones:\n${formatChord(chord)}`,
      );
    },
  };
}

function createStereoRoomTechnique(): Technique {
  return {
    id: 'stereo-room-enhanced',
    label: 'Stereo + room enhanced',
    description: 'Choir Blend formants with deterministic ensemble offsets, stereo placement, and a lightweight generated room.',
    play: ({
      audioContext: ctx,
      destination,
      chord,
      startTime,
      duration,
      registerActiveNodes: registerNodes,
      setStatus: updateStatus,
    }) => {
      const presetParams = getPresetParams('Choir Blend');
      const roomGraph = createSpatialRoomGraph(ctx, destination);
      const hasStereoPanner = typeof ctx.createStereoPanner === 'function';

      registerNodes(roomGraph.nodes);

      for (const tone of chord) {
        const config = SPATIAL_VOICE_CONFIG[tone.voice];
        let voiceDestination: AudioNode = roomGraph.input;

        if (hasStereoPanner) {
          const panner = ctx.createStereoPanner();
          panner.pan.setValueAtTime(config.pan, startTime);
          panner.connect(roomGraph.input);
          registerNodes([panner]);
          voiceDestination = panner;
        } else {
          voiceDestination = roomGraph.input;
        }

        scheduleSingleFormantVoice(
          ctx,
          voiceDestination,
          tone,
          presetParams,
          startTime + config.onsetOffsetSeconds,
          duration,
          registerNodes,
          {
            detuneCents: config.detuneCents,
            gainScale: config.gainScale,
          },
        );
      }

      const pannerDescription = hasStereoPanner
        ? 'StereoPannerNode placement from bass-left to tenor-right'
        : 'direct mono routing because StereoPannerNode is unavailable';

      updateStatus(
        `Playing Stereo + room enhanced: Choir Blend formants with ${pannerDescription}, deterministic voice onsets, subtle gain/detune variation, and ${roomGraph.description}.\n\nChord tones:\n${formatChord(chord)}`,
      );
    },
  };
}

function scheduleSpatialFormantPresetVoices(
  ctx: AudioContext,
  destination: AudioNode,
  chord: readonly ChordTone[],
  presetParams: SynthParams,
  startTime: number,
  duration: number,
  registerNodes: typeof registerActiveNodes,
): boolean {
  const hasStereoPanner = typeof ctx.createStereoPanner === 'function';

  for (const tone of chord) {
    const config = SPATIAL_VOICE_CONFIG[tone.voice];
    let voiceDestination = destination;

    if (hasStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(config.pan, startTime + config.onsetOffsetSeconds);
      panner.connect(destination);
      registerNodes([panner]);
      voiceDestination = panner;
    }

    scheduleSingleFormantVoice(
      ctx,
      voiceDestination,
      tone,
      presetParams,
      startTime + config.onsetOffsetSeconds,
      duration,
      registerNodes,
      {
        detuneCents: config.detuneCents,
        gainScale: config.gainScale,
      },
    );
  }

  return hasStereoPanner;
}

function scheduleSourceFilterVoice(
  ctx: AudioContext,
  destination: AudioNode,
  tone: ChordTone,
  presetParams: SynthParams,
  startTime: number,
  duration: number,
  registerNodes: typeof registerActiveNodes,
): void {
  const config = SPATIAL_VOICE_CONFIG[tone.voice];
  const voiceStart = startTime + config.onsetOffsetSeconds;
  const detunedFrequency = tone.frequency * centsToFrequencyRatio(config.detuneCents);
  const worklet = new AudioWorkletNode(ctx, SOURCE_FILTER_PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  const envelopeGain = ctx.createGain();
  const nodes: AudioNode[] = [worklet, envelopeGain];

  envelopeGain.gain.value = 0;
  scheduleEnvelope(
    envelopeGain.gain,
    voiceStart,
    duration,
    SOURCE_FILTER_OUTPUT_GAIN * config.gainScale,
  );

  setWorkletParam(worklet, 'frequency', detunedFrequency, voiceStart);
  scheduleWorkletGain(worklet, ctx.currentTime, voiceStart, duration);
  setWorkletParam(worklet, 'vibratoRate', presetParams.vibratoRate, voiceStart);
  setWorkletParam(worklet, 'vibratoDepth', presetParams.vibratoDepth, voiceStart);
  setWorkletParam(worklet, 'breath', presetParams.breathMix, voiceStart);
  setWorkletParam(worklet, 'brightness', SOURCE_FILTER_BRIGHTNESS, voiceStart);
  setWorkletParam(worklet, 'jitter', SOURCE_FILTER_JITTER, voiceStart);
  setWorkletParam(
    worklet,
    'shimmer',
    Math.max(SOURCE_FILTER_SHIMMER, presetParams.ampJitter),
    voiceStart,
  );
  setWorkletParam(worklet, 'vowel', SOURCE_FILTER_VOWEL, voiceStart);

  worklet.port.postMessage({
    voiceSettings: {
      formants: cloneFormants(presetParams.formants),
      seed: SOURCE_FILTER_VOICE_SEEDS[tone.voice],
    },
  });

  worklet.connect(envelopeGain);

  if (typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(config.pan, voiceStart);
    envelopeGain.connect(panner);
    panner.connect(destination);
    nodes.push(panner);
  } else {
    envelopeGain.connect(destination);
  }

  registerNodes(nodes);
}

function createSourceFilterSingerTechnique(): Technique {
  return {
    id: 'source-filter-singer',
    label: 'Source-filter singer',
    description: 'AudioWorklet glottal source plus vocal-tract formant filters for a fully synthesized singer.',
    play: async ({
      audioContext: ctx,
      destination,
      chord,
      startTime,
      duration,
      registerActiveNodes: registerNodes,
      setStatus: updateStatus,
    }) => {
      const presetParams = getPresetParams('Choir Blend');

      try {
        if (!sourceFilterWorkletModuleCache.has(ctx)) {
          updateStatus(
            'Loading Source-filter singer: registering the glottal-source/vocal-tract AudioWorklet…',
          );
        }

        await ensureSourceFilterWorklet(ctx);

        const scheduledStartTime = Math.max(startTime, ctx.currentTime + SCHEDULE_LEAD_IN_SECONDS);
        for (const tone of chord) {
          scheduleSourceFilterVoice(
            ctx,
            destination,
            tone,
            presetParams,
            scheduledStartTime,
            duration,
            registerNodes,
          );
        }

        const pannerDescription = typeof ctx.createStereoPanner === 'function'
          ? 'StereoPannerNode placement from bass-left to tenor-right'
          : 'direct mono routing because StereoPannerNode is unavailable';

        updateStatus(
          `Playing Source-filter singer: fully synthesized glottal source excitation through vocal-tract formant filters (Choir Blend), not samples, with ${pannerDescription}, deterministic onsets, vibrato, breath, jitter, and shimmer.\n\nChord tones:\n${formatChord(chord)}`,
        );

        return { startTime: scheduledStartTime, duration };
      } catch (error) {
        const fallbackStartTime = Math.max(startTime, ctx.currentTime + SCHEDULE_LEAD_IN_SECONDS);
        const hasStereoPanner = scheduleSpatialFormantPresetVoices(
          ctx,
          destination,
          chord,
          presetParams,
          fallbackStartTime,
          duration,
          registerNodes,
        );
        const routingDescription = hasStereoPanner
          ? 'with the same deterministic stereo placement'
          : 'with direct mono routing because StereoPannerNode is unavailable';

        updateStatus(
          `Source-filter singer AudioWorklet unavailable (${errorMessage(error)}). Falling back to the Choir Blend direct formant preset ${routingDescription}.\nThe requested source-filter model is fully synthesized glottal source + vocal tract filters, not samples.\n\nChord tones:\n${formatChord(chord)}`,
        );

        return { startTime: fallbackStartTime, duration };
      }
    },
  };
}

async function loadSampledVoiceBuffer(ctx: AudioContext): Promise<AudioBuffer> {
  const cachedBuffer = sampledVoiceBufferCache.get(ctx);
  if (cachedBuffer) {
    return cachedBuffer;
  }

  const loadPromise = (async () => {
    const response = await fetch(SAMPLED_VOICE_SAMPLE_URL);
    if (!response.ok) {
      throw new Error(
        `sample fetch failed (${response.status} ${response.statusText}) from ${SAMPLED_VOICE_SAMPLE_URL}`,
      );
    }

    const encodedSample = await response.arrayBuffer();
    try {
      return await ctx.decodeAudioData(encodedSample);
    } catch (error) {
      throw new Error(`sample decode failed: ${errorMessage(error)}`);
    }
  })();

  sampledVoiceBufferCache.set(ctx, loadPromise);

  try {
    return await loadPromise;
  } catch (error) {
    if (sampledVoiceBufferCache.get(ctx) === loadPromise) {
      sampledVoiceBufferCache.delete(ctx);
    }
    throw error;
  }
}

function scheduleSampledVoice(
  ctx: AudioContext,
  destination: AudioNode,
  tone: ChordTone,
  sampleBuffer: AudioBuffer,
  startTime: number,
  duration: number,
  registerNodes: typeof registerActiveNodes,
): number {
  const config = SPATIAL_VOICE_CONFIG[tone.voice];
  const playbackRate = playbackRateForTone(tone);
  const source = ctx.createBufferSource();
  const envelopeGain = ctx.createGain();
  const nodes: AudioNode[] = [source, envelopeGain];

  source.buffer = sampleBuffer;
  source.playbackRate.setValueAtTime(playbackRate, startTime);

  envelopeGain.gain.value = 0;
  scheduleEnvelope(
    envelopeGain.gain,
    startTime,
    duration,
    SAMPLED_VOICE_GAIN * config.gainScale,
  );

  source.connect(envelopeGain);

  if (typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(config.pan, startTime);
    envelopeGain.connect(panner);
    panner.connect(destination);
    nodes.push(panner);
  } else {
    envelopeGain.connect(destination);
  }

  const offsetSeconds = Math.min(
    SAMPLED_VOICE_OFFSET_SECONDS,
    Math.max(0, sampleBuffer.duration - duration * playbackRate),
  );
  source.start(startTime, offsetSeconds);
  source.stop(startTime + duration + SAMPLED_VOICE_SOURCE_STOP_MARGIN_SECONDS);

  registerNodes(nodes);
  return playbackRate;
}

function createSampledVoicesTechnique(): Technique {
  return {
    id: 'sampled-voices',
    label: 'Sampled voices',
    description: 'Lazy-loaded local CC0 sustained-vowel crowd sample transposed with native AudioBufferSourceNode playbackRate.',
    play: async ({
      audioContext: ctx,
      destination,
      chord,
      startTime,
      duration,
      registerActiveNodes: registerNodes,
      setStatus: updateStatus,
    }) => {
      if (!sampledVoiceBufferCache.has(ctx)) {
        updateStatus(
          'Loading Sampled voices: fetching and decoding the local CC0 Freesound preview MP3…',
        );
      }

      const sampleBuffer = await loadSampledVoiceBuffer(ctx);
      const scheduledStartTime = Math.max(startTime, ctx.currentTime + SCHEDULE_LEAD_IN_SECONDS);
      const playbackRates = chord.map((tone) => {
        const playbackRate = scheduleSampledVoice(
          ctx,
          destination,
          tone,
          sampleBuffer,
          scheduledStartTime,
          duration,
          registerNodes,
        );

        return `${tone.voice} ${tone.label}: ${playbackRate.toFixed(3)}×`;
      });

      updateStatus(
        `Playing Sampled voices: local CC0 Freesound crowd "ä" vowel sample mapped with AudioBufferSourceNode.playbackRate.\nReference pitch: source says near concert F; this demo treats it as F4 (${SAMPLED_VOICE_REFERENCE_FREQUENCY_HZ.toFixed(2)} Hz).\nRates: ${playbackRates.join(', ')}\n\nChord tones:\n${formatChord(chord)}`,
      );

      return { startTime: scheduledStartTime, duration };
    },
  };
}

const TECHNIQUES: Record<TechniqueId, Technique> = {
  'organ-baseline': createScheduledChordTechnique(
    'organ-baseline',
    'Organ baseline',
    'Clean oscillator baseline using the production organ sound.',
    'organ',
  ),
  'current-voices': createScheduledChordTechnique(
    'current-voices',
    'Current voices',
    'Current production human/formant voice baseline.',
    'human',
  ),
  'research-formant-voices': createFormantPresetTechnique(
    'research-formant-voices',
    'Research formant voices',
    'Demo-local multi-note graph from computeHarmonicsFromProfile using a balanced research preset.',
    'Choir Blend',
  ),
  'choir-blend': createFormantPresetTechnique(
    'choir-blend',
    'Choir blend',
    'Play all four chord tones with the Choir Blend formant preset.',
    'Choir Blend',
  ),
  'warm-covered': createFormantPresetTechnique(
    'warm-covered',
    'Warm / covered',
    'Play all four chord tones with the Dark / Covered formant preset.',
    'Dark / Covered',
  ),
  'breathy-airy': createFormantPresetTechnique(
    'breathy-airy',
    'Breathy / airy',
    'Play all four chord tones with the breath-forward Breathy formant preset.',
    'Breathy',
  ),
  'source-filter-singer': createSourceFilterSingerTechnique(),
  'stereo-room-enhanced': createStereoRoomTechnique(),
  'sampled-voices': createSampledVoicesTechnique(),
};

function setButtonsBusy(isBusy: boolean): void {
  for (const button of techniqueButtons.values()) {
    button.disabled = isBusy;
  }
  updateStopButton(isBusy);
}

function updateStopButton(isBusy = false): void {
  stopButton.disabled = isBusy || activeAudioNodes.size === 0;
}

function scheduleEndCleanup(ctx: AudioContext, startTime: number, duration: number): void {
  const nodesToCleanUp = [...activeAudioNodes];

  if (nodesToCleanUp.length === 0) {
    updateStopButton();
    return;
  }

  const delaySeconds = startTime + duration + CLEANUP_MARGIN_SECONDS - ctx.currentTime;
  scheduleCleanup(delaySeconds, nodesToCleanUp);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function playTechnique(id: TechniqueId): Promise<void> {
  const technique = TECHNIQUES[id];
  setButtonsBusy(true);
  setStatus(`Starting ${technique.label}…`);

  try {
    stopActiveNodes();
    const ctx = await ensureAudioContext();
    const playContext = createTechniqueContext(ctx);

    const playbackTiming = (await technique.play(playContext)) ?? {
      startTime: playContext.startTime,
      duration: playContext.duration,
    };
    scheduleEndCleanup(ctx, playbackTiming.startTime, playbackTiming.duration);
  } catch (error) {
    stopActiveNodes();
    setStatus(`Could not play ${technique.label}: ${errorMessage(error)}`);
    console.error(error);
  } finally {
    setButtonsBusy(false);
  }
}

function wireTechniqueButtons(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('button[data-technique]');

  for (const button of buttons) {
    const id = button.dataset.technique;
    if (!id || !isTechniqueId(id)) {
      throw new Error(`Unknown technique id: ${id ?? '(missing)'}`);
    }

    techniqueButtons.set(id, button);
    button.addEventListener('click', () => {
      void playTechnique(id);
    });
  }
}

function wireStopButton(): void {
  stopButton.addEventListener('click', () => {
    stopActiveNodes();
    setStatus('Stopped. Choose a technique to hear the C3–G3–E4–C5 comparison chord.');
  });
}

wireTechniqueButtons();
wireStopButton();
setStatus(`Ready. Choose a technique to hear the comparison chord.\n\nChord:\n${formatChord()}`);
updateStopButton();
