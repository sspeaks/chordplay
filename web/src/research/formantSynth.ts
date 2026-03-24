import {
  computeHarmonicsFromProfile,
  type Formant,
} from '../engine/formants';

export interface SynthParams {
  f0: number;
  tiltExponent: number;
  breathMix: number;
  vibratoRate: number;
  vibratoDepth: number; // fraction: 0.01 = 1%
  ampJitter: number;
  formants: Formant[];
}

export const DEFAULT_PARAMS: SynthParams = {
  f0: 220,
  tiltExponent: 1.0,
  breathMix: 0.05,
  vibratoRate: 5,
  vibratoDepth: 0.01,
  ampJitter: 0.02,
  formants: [
    { freq: 700, amp: 1.0, bw: 80 },
    { freq: 1150, amp: 0.7, bw: 90 },
    { freq: 2500, amp: 0.65, bw: 120 },
    { freq: 3350, amp: 0.45, bw: 150 },
    { freq: 4200, amp: 0.2, bw: 200 },
  ],
};

export class FormantSynth {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private sources: AudioBufferSourceNode[] = [];
  private nodes: AudioNode[] = [];
  private running = false;
  private rebuildTimer: number | null = null;
  private params: SynthParams;

  constructor(params?: Partial<SynthParams>) {
    this.params = { ...DEFAULT_PARAMS, ...params };
    if (params?.formants) {
      this.params.formants = params.formants.map((f) => ({ ...f }));
    }
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.connect(this.ctx.destination);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(this.analyser);

    this.buildGraph();

    const now = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime(0, now);
    this.masterGain.gain.linearRampToValueAtTime(0.3, now + 0.05);

    this.running = true;
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.rebuildTimer !== null) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }

    this.teardownGraph();

    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.analyser = null;
    this.masterGain = null;
  }

  updateParams(newParams: Partial<SynthParams>): void {
    if (newParams.formants) {
      this.params.formants = newParams.formants.map((f) => ({ ...f }));
    }
    if (newParams.f0 !== undefined) this.params.f0 = newParams.f0;
    if (newParams.tiltExponent !== undefined)
      this.params.tiltExponent = newParams.tiltExponent;
    if (newParams.breathMix !== undefined)
      this.params.breathMix = newParams.breathMix;
    if (newParams.vibratoRate !== undefined)
      this.params.vibratoRate = newParams.vibratoRate;
    if (newParams.vibratoDepth !== undefined)
      this.params.vibratoDepth = newParams.vibratoDepth;
    if (newParams.ampJitter !== undefined)
      this.params.ampJitter = newParams.ampJitter;

    if (!this.running) return;
    this.scheduleRebuild();
  }

  getParams(): SynthParams {
    return {
      ...this.params,
      formants: this.params.formants.map((f) => ({ ...f })),
    };
  }

  private scheduleRebuild(): void {
    if (this.rebuildTimer !== null) return;
    this.rebuildTimer = window.setTimeout(() => {
      this.rebuildTimer = null;
      this.rebuild();
    }, 30);
  }

  private rebuild(): void {
    if (!this.ctx || !this.masterGain || !this.running) return;

    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + 0.02);

    setTimeout(() => {
      if (!this.running || !this.ctx || !this.masterGain) return;
      this.teardownGraph();
      this.buildGraph();
      const now2 = this.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(0, now2);
      this.masterGain.gain.linearRampToValueAtTime(0.3, now2 + 0.02);
    }, 30);
  }

  private buildGraph(): void {
    if (!this.ctx || !this.masterGain) return;

    // 1. Harmonic core
    const harmonics = computeHarmonicsFromProfile(
      this.params.f0,
      this.params.formants,
      this.params.tiltExponent,
    );

    // RMS normalization to prevent clipping
    const sumSq = harmonics.reduce((s, [, a]) => s + a * a, 0);
    const rmsNorm = Math.sqrt(sumSq) || 1;

    for (const [n, amp] of harmonics) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = n * this.params.f0;

      const gain = this.ctx.createGain();
      gain.gain.value = amp / rmsNorm;

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();

      this.oscillators.push(osc);
      this.nodes.push(gain);
    }

    // 2. Vibrato — LFO modulates each harmonic oscillator's frequency
    // proportionally (n × f0 × depth) for natural pitch vibrato
    if (this.params.vibratoDepth > 0 && this.params.vibratoRate > 0) {
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = this.params.vibratoRate;

      for (const osc of this.oscillators) {
        const mod = this.ctx.createGain();
        mod.gain.value = osc.frequency.value * this.params.vibratoDepth;
        lfo.connect(mod);
        mod.connect(osc.frequency);
        this.nodes.push(mod);
      }

      lfo.start();
      this.oscillators.push(lfo);
    }

    // 3. Breathiness — white noise through bandpass filters at formant freqs
    if (this.params.breathMix > 0) {
      const bufferSize = 2 * this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const breathGain = this.ctx.createGain();
      breathGain.gain.value = this.params.breathMix;
      breathGain.connect(this.masterGain);
      this.nodes.push(breathGain);

      for (const formant of this.params.formants) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = formant.freq;
        filter.Q.value = formant.freq / (formant.bw * 2);

        const fGain = this.ctx.createGain();
        fGain.gain.value = formant.amp * 0.2;

        noise.connect(filter);
        filter.connect(fGain);
        fGain.connect(breathGain);

        this.nodes.push(filter, fGain);
      }

      noise.start();
      this.sources.push(noise);
    }

    // 4. Amplitude jitter — slow LFO on master gain for organic texture
    if (this.params.ampJitter > 0) {
      const jLfo = this.ctx.createOscillator();
      jLfo.type = 'sine';
      jLfo.frequency.value = 3.17; // slightly irrational to avoid obvious periodicity

      const jGain = this.ctx.createGain();
      jGain.gain.value = this.params.ampJitter;

      jLfo.connect(jGain);
      jGain.connect(this.masterGain.gain);
      jLfo.start();

      this.oscillators.push(jLfo);
      this.nodes.push(jGain);
    }
  }

  private teardownGraph(): void {
    for (const osc of this.oscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.oscillators = [];

    for (const src of this.sources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];

    for (const node of this.nodes) {
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.nodes = [];
  }
}
