# "Ah" Vowel Synthesis Research Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone research page where you can play a sustained "Ah" vowel, see its spectrum, and tweak every formant/synthesis parameter in real time until it sounds convincingly human.

**Architecture:** Hybrid additive synthesis — formant-shaped harmonic oscillators (Gaussian envelope × spectral tilt) plus filtered noise for breathiness and LFO modulations for vibrato/jitter. A separate Vite entry point serves the research page alongside the main app. The formant computation module (`engine/formants.ts`) is shared and will be reused when this work is integrated into the main app.

**Tech Stack:** TypeScript, Web Audio API, Canvas 2D, Vite 6

**Spec:** `docs/superpowers/specs/2026-03-24-ah-vowel-research-design.md`

**Environment:** This is a Nix flake project with direnv. Commands run from the `web/` directory. If `node`/`npx` aren't on PATH, prefix with `nix develop --command bash -c "cd web && <command>"`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `web/src/engine/formants.ts` | Create | Formant profiles (Bass/Bari/Tenor/Lead), `computeHarmonics()`, `computeHarmonicsFromProfile()` |
| `web/src/engine/formants.test.ts` | Create | Unit tests for formant computation |
| `web/src/research/formantSynth.ts` | Create | Hybrid synth engine class — harmonic core + breathiness + vibrato + jitter |
| `web/src/research/spectrumAnalyzer.ts` | Create | Canvas-based FFT spectrum + waveform visualization |
| `web/src/research/ah-sound.html` | Create | Standalone HTML entry — layout, sliders, presets, canvases |
| `web/src/research/ah-sound.ts` | Create | Wires DOM events to synth engine + visualization |
| `web/vite.config.ts` | Modify | Add research page as second rollup input entry |

---

### Task 1: Create formants module

**Files:**
- Create: `web/src/engine/formants.ts`
- Create: `web/src/engine/formants.test.ts`

- [ ] **Step 1: Write failing tests**

Create `web/src/engine/formants.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeHarmonics,
  computeHarmonicsFromProfile,
  VOICE_FORMANTS,
  MAX_HARMONIC_FREQ,
} from './formants';

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
    expect(VOICE_FORMANTS.Bass[0]!.freq).toBeLessThan(
      VOICE_FORMANTS.Tenor[0]!.freq,
    );
  });

  it('Lead has brighter F3/F4 than Tenor', () => {
    expect(VOICE_FORMANTS.Lead[2]!.amp).toBeGreaterThan(
      VOICE_FORMANTS.Tenor[2]!.amp,
    );
    expect(VOICE_FORMANTS.Lead[3]!.amp).toBeGreaterThan(
      VOICE_FORMANTS.Tenor[3]!.amp,
    );
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
    const f0 = 110;
    const result = computeHarmonics(f0, 'Bass');
    const maxHarmonicFreq = Math.max(...result.map(([h]) => h * f0));
    expect(maxHarmonicFreq).toBeLessThanOrEqual(MAX_HARMONIC_FREQ);
  });

  it('Bass at 110 Hz has more harmonics than Tenor at 330 Hz', () => {
    const bassResult = computeHarmonics(110, 'Bass');
    const tenorResult = computeHarmonics(330, 'Tenor');
    expect(bassResult.length).toBeGreaterThan(tenorResult.length);
  });

  it('harmonics near F1 are louder than harmonics between formants', () => {
    // Bass at 110 Hz: harmonic 6 (660 Hz) near F1 (650 Hz),
    // harmonic 8 (880 Hz) falls between F1 and F2
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
      if (
        leadMap.has(h) &&
        Math.abs(bassMap.get(h)! - leadMap.get(h)!) > 0.01
      ) {
        hasDifference = true;
        break;
      }
    }
    expect(hasDifference).toBe(true);
  });
});

describe('computeHarmonicsFromProfile', () => {
  it('accepts a custom tilt exponent', () => {
    const steep = computeHarmonicsFromProfile(220, VOICE_FORMANTS.Bass, 2.0);
    const shallow = computeHarmonicsFromProfile(220, VOICE_FORMANTS.Bass, 0.5);
    const steepH10 = steep.find(([h]) => h === 10);
    const shallowH10 = shallow.find(([h]) => h === 10);
    if (steepH10 && shallowH10) {
      expect(steepH10[1]).toBeLessThan(shallowH10[1]);
    }
  });

  it('accepts a custom formant profile', () => {
    const customProfile = [
      { freq: 500, amp: 1.0, bw: 100 },
      { freq: 1500, amp: 0.5, bw: 100 },
    ];
    const result = computeHarmonicsFromProfile(220, customProfile);
    expect(result.length).toBeGreaterThan(0);
    const maxAmp = Math.max(...result.map(([, a]) => a));
    expect(maxAmp).toBeCloseTo(1.0, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd web && npx vitest --run src/engine/formants.test.ts
```
Expected: FAIL — module `./formants` not found.

- [ ] **Step 3: Implement `formants.ts`**

Create `web/src/engine/formants.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd web && npx vitest --run src/engine/formants.test.ts
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/formants.ts web/src/engine/formants.test.ts
git commit -m "feat: add formant profiles and harmonic computation module

Per-voice formant profiles (Bass, Bari, Tenor, Lead) for 'ah' vowel with
singer's formant boost. computeHarmonics() and computeHarmonicsFromProfile()
replace the static HARMONICS array with dynamic formant-shaped amplitudes
up to 5 kHz. Configurable spectral tilt exponent.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Create hybrid synth engine

**Files:**
- Create: `web/src/research/formantSynth.ts`

- [ ] **Step 1: Create the `research/` directory**

```bash
mkdir -p web/src/research
```

- [ ] **Step 2: Implement `formantSynth.ts`**

Create `web/src/research/formantSynth.ts`:

```typescript
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
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd web && npx tsc --noEmit
```
Expected: No errors. (Must use full project check — single-file tsc doesn't work with `moduleResolution: bundler`.)

- [ ] **Step 4: Commit**

```bash
git add web/src/research/formantSynth.ts
git commit -m "feat: add hybrid formant synth engine for research page

FormantSynth class with harmonic core (formant-shaped additive synthesis),
breathiness layer (filtered noise), vibrato (proportional LFO), and
amplitude jitter. All parameters update in real time via debounced rebuild.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Create spectrum analyzer

**Files:**
- Create: `web/src/research/spectrumAnalyzer.ts`

- [ ] **Step 1: Implement `spectrumAnalyzer.ts`**

Create `web/src/research/spectrumAnalyzer.ts`:

```typescript
export class SpectrumAnalyzer {
  private analyser: AnalyserNode;
  private freqCanvas: HTMLCanvasElement;
  private waveCanvas: HTMLCanvasElement;
  private freqCtx: CanvasRenderingContext2D;
  private waveCtx: CanvasRenderingContext2D;
  private freqData: Uint8Array;
  private timeData: Uint8Array;
  private animId: number | null = null;
  private f0: number;

  constructor(
    analyser: AnalyserNode,
    freqCanvas: HTMLCanvasElement,
    waveCanvas: HTMLCanvasElement,
    f0: number,
  ) {
    this.analyser = analyser;
    this.freqCanvas = freqCanvas;
    this.waveCanvas = waveCanvas;
    this.freqCtx = freqCanvas.getContext('2d')!;
    this.waveCtx = waveCanvas.getContext('2d')!;
    this.freqData = new Uint8Array(analyser.frequencyBinCount);
    this.timeData = new Uint8Array(analyser.fftSize);
    this.f0 = f0;
  }

  start(): void {
    const draw = () => {
      this.drawSpectrum();
      this.drawWaveform();
      this.animId = requestAnimationFrame(draw);
    };
    draw();
  }

  stop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.clearCanvases();
  }

  setF0(f0: number): void {
    this.f0 = f0;
  }

  private clearCanvases(): void {
    this.freqCtx.fillStyle = '#1a1a2e';
    this.freqCtx.fillRect(0, 0, this.freqCanvas.width, this.freqCanvas.height);
    this.waveCtx.fillStyle = '#1a1a2e';
    this.waveCtx.fillRect(0, 0, this.waveCanvas.width, this.waveCanvas.height);
  }

  private drawSpectrum(): void {
    this.analyser.getByteFrequencyData(this.freqData);
    const ctx = this.freqCtx;
    const w = this.freqCanvas.width;
    const h = this.freqCanvas.height;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    const sampleRate = this.analyser.context.sampleRate;
    const binCount = this.analyser.frequencyBinCount;
    const maxFreq = 5000;
    const maxBin = Math.min(
      Math.ceil((maxFreq / (sampleRate / 2)) * binCount),
      binCount,
    );

    // Grid lines at 1 kHz intervals
    ctx.strokeStyle = '#262638';
    ctx.lineWidth = 0.5;
    for (let freq = 1000; freq <= 5000; freq += 1000) {
      const x = (freq / maxFreq) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Spectrum curve
    ctx.strokeStyle = '#2a9d8f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < maxBin; i++) {
      const x = (i / maxBin) * w;
      const y = h - (this.freqData[i]! / 255) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Frequency labels
    ctx.fillStyle = '#666';
    ctx.font = '10px JetBrains Mono, monospace';
    for (let freq = 1000; freq <= 5000; freq += 1000) {
      const x = (freq / maxFreq) * w;
      ctx.fillText(`${freq / 1000}k`, x - 8, h - 4);
    }
  }

  private drawWaveform(): void {
    this.analyser.getByteTimeDomainData(this.timeData);
    const ctx = this.waveCtx;
    const w = this.waveCanvas.width;
    const h = this.waveCanvas.height;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = '#262638';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Show ~2 periods of the waveform based on current f0
    const sampleRate = this.analyser.context.sampleRate;
    const samplesPerPeriod = sampleRate / this.f0;
    const samplesToShow = Math.min(
      Math.ceil(samplesPerPeriod * 2),
      this.timeData.length,
    );

    ctx.strokeStyle = '#4a6fa5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < samplesToShow; i++) {
      const x = (i / samplesToShow) * w;
      const y = (this.timeData[i]! / 255) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd web && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/research/spectrumAnalyzer.ts
git commit -m "feat: add canvas spectrum analyzer and waveform display

SpectrumAnalyzer class using AnalyserNode (fftSize 4096). FFT spectrum
0–5 kHz with grid lines, and waveform display zoomed to ~2 periods.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Create research page

**Files:**
- Create: `web/src/research/ah-sound.html`
- Create: `web/src/research/ah-sound.ts`

- [ ] **Step 1: Create `ah-sound.html`**

Create `web/src/research/ah-sound.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ah Vowel Research — ChordPlay</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #12121e;
      color: #e0e0e0;
      font-family: 'JetBrains Mono', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 24px;
      max-width: 840px;
      margin: 0 auto;
      line-height: 1.6;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    h1 { font-size: 1.4rem; font-weight: 500; }
    h2 {
      font-size: 0.85rem;
      font-weight: 500;
      color: #aaa;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
      margin-top: 20px;
    }
    button {
      background: #1e1e30;
      color: #e0e0e0;
      border: 1px solid #333;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.85rem;
    }
    button:hover:not(:disabled) { background: #2a2a3e; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    .controls { display: flex; gap: 8px; }
    canvas {
      width: 100%;
      background: #1a1a2e;
      border: 1px solid #262638;
      border-radius: 4px;
      margin-bottom: 8px;
      display: block;
    }
    section { margin-bottom: 8px; }
    .slider-row {
      display: grid;
      grid-template-columns: 120px 1fr 80px;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .slider-row label {
      font-size: 0.8rem;
      color: #aaa;
    }
    .slider-row .value {
      font-size: 0.8rem;
      color: #2a9d8f;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    input[type="range"] {
      -webkit-appearance: none;
      width: 100%;
      height: 4px;
      background: #333;
      border-radius: 2px;
      outline: none;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      background: #4a6fa5;
      border-radius: 50%;
      cursor: pointer;
    }
    .formant-group {
      background: #1a1a2e;
      border: 1px solid #262638;
      border-radius: 4px;
      padding: 10px 14px;
      margin-bottom: 6px;
    }
    .formant-group h3 {
      font-size: 0.8rem;
      font-weight: 500;
      color: #4a6fa5;
      margin-bottom: 6px;
    }
    .presets {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <header>
    <h1>"Ah" Vowel Research</h1>
    <div class="controls">
      <button id="play-btn">▶ Play</button>
      <button id="stop-btn" disabled>⏹ Stop</button>
    </div>
  </header>

  <section>
    <canvas id="spectrum" width="800" height="200"></canvas>
    <canvas id="waveform" width="800" height="120"></canvas>
  </section>

  <section>
    <h2>Global Controls</h2>
    <div class="slider-row">
      <label>Fundamental</label>
      <input type="range" id="f0" min="80" max="600" value="220" step="1">
      <span class="value" id="f0-val">220 Hz</span>
    </div>
    <div class="slider-row">
      <label>Spectral Tilt</label>
      <input type="range" id="tilt" min="0.3" max="2.0" value="1.0" step="0.1">
      <span class="value" id="tilt-val">-6 dB/oct</span>
    </div>
    <div class="slider-row">
      <label>Breath Mix</label>
      <input type="range" id="breath" min="0" max="0.5" value="0.05" step="0.01">
      <span class="value" id="breath-val">0.05</span>
    </div>
    <div class="slider-row">
      <label>Vibrato Rate</label>
      <input type="range" id="vib-rate" min="0" max="8" value="5" step="0.1">
      <span class="value" id="vib-rate-val">5.0 Hz</span>
    </div>
    <div class="slider-row">
      <label>Vibrato Depth</label>
      <input type="range" id="vib-depth" min="0" max="5" value="1" step="0.1">
      <span class="value" id="vib-depth-val">1.0%</span>
    </div>
    <div class="slider-row">
      <label>Amp Jitter</label>
      <input type="range" id="jitter" min="0" max="0.1" value="0.02" step="0.005">
      <span class="value" id="jitter-val">0.020</span>
    </div>
  </section>

  <section>
    <h2>Formants</h2>

    <div class="formant-group">
      <h3>F1</h3>
      <div class="slider-row">
        <label>Freq</label>
        <input type="range" id="f1-freq" min="200" max="1000" value="700" step="10">
        <span class="value" id="f1-freq-val">700 Hz</span>
      </div>
      <div class="slider-row">
        <label>Amp</label>
        <input type="range" id="f1-amp" min="0" max="1" value="1.0" step="0.05">
        <span class="value" id="f1-amp-val">1.00</span>
      </div>
      <div class="slider-row">
        <label>Bandwidth</label>
        <input type="range" id="f1-bw" min="20" max="400" value="80" step="10">
        <span class="value" id="f1-bw-val">80 Hz</span>
      </div>
    </div>

    <div class="formant-group">
      <h3>F2</h3>
      <div class="slider-row">
        <label>Freq</label>
        <input type="range" id="f2-freq" min="500" max="2000" value="1150" step="10">
        <span class="value" id="f2-freq-val">1150 Hz</span>
      </div>
      <div class="slider-row">
        <label>Amp</label>
        <input type="range" id="f2-amp" min="0" max="1" value="0.7" step="0.05">
        <span class="value" id="f2-amp-val">0.70</span>
      </div>
      <div class="slider-row">
        <label>Bandwidth</label>
        <input type="range" id="f2-bw" min="20" max="400" value="90" step="10">
        <span class="value" id="f2-bw-val">90 Hz</span>
      </div>
    </div>

    <div class="formant-group">
      <h3>F3</h3>
      <div class="slider-row">
        <label>Freq</label>
        <input type="range" id="f3-freq" min="1500" max="3500" value="2500" step="10">
        <span class="value" id="f3-freq-val">2500 Hz</span>
      </div>
      <div class="slider-row">
        <label>Amp</label>
        <input type="range" id="f3-amp" min="0" max="1" value="0.65" step="0.05">
        <span class="value" id="f3-amp-val">0.65</span>
      </div>
      <div class="slider-row">
        <label>Bandwidth</label>
        <input type="range" id="f3-bw" min="20" max="400" value="120" step="10">
        <span class="value" id="f3-bw-val">120 Hz</span>
      </div>
    </div>

    <div class="formant-group">
      <h3>F4</h3>
      <div class="slider-row">
        <label>Freq</label>
        <input type="range" id="f4-freq" min="2500" max="4500" value="3350" step="10">
        <span class="value" id="f4-freq-val">3350 Hz</span>
      </div>
      <div class="slider-row">
        <label>Amp</label>
        <input type="range" id="f4-amp" min="0" max="1" value="0.45" step="0.05">
        <span class="value" id="f4-amp-val">0.45</span>
      </div>
      <div class="slider-row">
        <label>Bandwidth</label>
        <input type="range" id="f4-bw" min="20" max="400" value="150" step="10">
        <span class="value" id="f4-bw-val">150 Hz</span>
      </div>
    </div>

    <div class="formant-group">
      <h3>F5</h3>
      <div class="slider-row">
        <label>Freq</label>
        <input type="range" id="f5-freq" min="3000" max="5500" value="4200" step="10">
        <span class="value" id="f5-freq-val">4200 Hz</span>
      </div>
      <div class="slider-row">
        <label>Amp</label>
        <input type="range" id="f5-amp" min="0" max="1" value="0.2" step="0.05">
        <span class="value" id="f5-amp-val">0.20</span>
      </div>
      <div class="slider-row">
        <label>Bandwidth</label>
        <input type="range" id="f5-bw" min="20" max="400" value="200" step="10">
        <span class="value" id="f5-bw-val">200 Hz</span>
      </div>
    </div>
  </section>

  <div class="presets">
    <button id="preset-bass">Bass</button>
    <button id="preset-bari">Bari</button>
    <button id="preset-tenor">Tenor</button>
    <button id="preset-lead">Lead</button>
    <button id="reset-btn">Reset</button>
  </div>

  <script type="module" src="./ah-sound.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create `ah-sound.ts`**

Create `web/src/research/ah-sound.ts`:

```typescript
import '@fontsource/jetbrains-mono';
import { FormantSynth, DEFAULT_PARAMS, type SynthParams } from './formantSynth';
import { SpectrumAnalyzer } from './spectrumAnalyzer';
import { VOICE_FORMANTS, type Formant } from '../engine/formants';
import type { VoicePart } from '../types';

let synth: FormantSynth | null = null;
let analyzer: SpectrumAnalyzer | null = null;

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function readFormants(): Formant[] {
  const formants: Formant[] = [];
  for (let i = 1; i <= 5; i++) {
    formants.push({
      freq: Number(el<HTMLInputElement>(`f${i}-freq`).value),
      amp: Number(el<HTMLInputElement>(`f${i}-amp`).value),
      bw: Number(el<HTMLInputElement>(`f${i}-bw`).value),
    });
  }
  return formants;
}

function readParams(): SynthParams {
  return {
    f0: Number(el<HTMLInputElement>('f0').value),
    tiltExponent: Number(el<HTMLInputElement>('tilt').value),
    breathMix: Number(el<HTMLInputElement>('breath').value),
    vibratoRate: Number(el<HTMLInputElement>('vib-rate').value),
    vibratoDepth: Number(el<HTMLInputElement>('vib-depth').value) / 100,
    ampJitter: Number(el<HTMLInputElement>('jitter').value),
    formants: readFormants(),
  };
}

function updateDisplays(): void {
  el('f0-val').textContent = `${el<HTMLInputElement>('f0').value} Hz`;
  const tilt = Number(el<HTMLInputElement>('tilt').value);
  el('tilt-val').textContent = `${(-6 * tilt).toFixed(0)} dB/oct`;
  el('breath-val').textContent = Number(
    el<HTMLInputElement>('breath').value,
  ).toFixed(2);
  el('vib-rate-val').textContent = `${Number(el<HTMLInputElement>('vib-rate').value).toFixed(1)} Hz`;
  el('vib-depth-val').textContent = `${Number(el<HTMLInputElement>('vib-depth').value).toFixed(1)}%`;
  el('jitter-val').textContent = Number(
    el<HTMLInputElement>('jitter').value,
  ).toFixed(3);

  for (let i = 1; i <= 5; i++) {
    el(`f${i}-freq-val`).textContent = `${el<HTMLInputElement>(`f${i}-freq`).value} Hz`;
    el(`f${i}-amp-val`).textContent = Number(
      el<HTMLInputElement>(`f${i}-amp`).value,
    ).toFixed(2);
    el(`f${i}-bw-val`).textContent = `${el<HTMLInputElement>(`f${i}-bw`).value} Hz`;
  }
}

function loadPreset(voicePart: VoicePart): void {
  const profile = VOICE_FORMANTS[voicePart];
  for (let i = 0; i < profile.length; i++) {
    const f = profile[i]!;
    el<HTMLInputElement>(`f${i + 1}-freq`).value = String(f.freq);
    el<HTMLInputElement>(`f${i + 1}-amp`).value = String(f.amp);
    el<HTMLInputElement>(`f${i + 1}-bw`).value = String(f.bw);
  }
  onParamChange();
}

function onParamChange(): void {
  updateDisplays();
  if (synth) {
    const params = readParams();
    synth.updateParams(params);
    if (analyzer) {
      analyzer.setF0(params.f0);
    }
  }
}

// Play / Stop
el('play-btn').addEventListener('click', async () => {
  synth = new FormantSynth(readParams());
  await synth.start();

  const analyserNode = synth.getAnalyser();
  if (analyserNode) {
    analyzer = new SpectrumAnalyzer(
      analyserNode,
      el<HTMLCanvasElement>('spectrum'),
      el<HTMLCanvasElement>('waveform'),
      readParams().f0,
    );
    analyzer.start();
  }

  el<HTMLButtonElement>('play-btn').disabled = true;
  el<HTMLButtonElement>('stop-btn').disabled = false;
});

el('stop-btn').addEventListener('click', () => {
  if (analyzer) {
    analyzer.stop();
    analyzer = null;
  }
  if (synth) {
    synth.stop();
    synth = null;
  }
  el<HTMLButtonElement>('play-btn').disabled = false;
  el<HTMLButtonElement>('stop-btn').disabled = true;
});

// Wire all sliders
const sliderIds = [
  'f0', 'tilt', 'breath', 'vib-rate', 'vib-depth', 'jitter',
  ...Array.from({ length: 5 }, (_, i) => [
    `f${i + 1}-freq`, `f${i + 1}-amp`, `f${i + 1}-bw`,
  ]).flat(),
];

for (const id of sliderIds) {
  el<HTMLInputElement>(id).addEventListener('input', onParamChange);
}

// Presets
for (const part of ['Bass', 'Bari', 'Tenor', 'Lead'] as const) {
  el(`preset-${part.toLowerCase()}`).addEventListener('click', () =>
    loadPreset(part),
  );
}

// Reset
el('reset-btn').addEventListener('click', () => {
  el<HTMLInputElement>('f0').value = String(DEFAULT_PARAMS.f0);
  el<HTMLInputElement>('tilt').value = String(DEFAULT_PARAMS.tiltExponent);
  el<HTMLInputElement>('breath').value = String(DEFAULT_PARAMS.breathMix);
  el<HTMLInputElement>('vib-rate').value = String(DEFAULT_PARAMS.vibratoRate);
  el<HTMLInputElement>('vib-depth').value = String(
    DEFAULT_PARAMS.vibratoDepth * 100,
  );
  el<HTMLInputElement>('jitter').value = String(DEFAULT_PARAMS.ampJitter);

  for (let i = 0; i < DEFAULT_PARAMS.formants.length; i++) {
    const f = DEFAULT_PARAMS.formants[i]!;
    el<HTMLInputElement>(`f${i + 1}-freq`).value = String(f.freq);
    el<HTMLInputElement>(`f${i + 1}-amp`).value = String(f.amp);
    el<HTMLInputElement>(`f${i + 1}-bw`).value = String(f.bw);
  }
  onParamChange();
});

// Initialize display values
updateDisplays();
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd web && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/research/ah-sound.html web/src/research/ah-sound.ts
git commit -m "feat: add Ah vowel research page with full parameter control

Standalone HTML page with play/stop, spectrum analyzer, waveform display,
global controls (f0, spectral tilt, breath, vibrato, jitter), per-formant
sliders (freq, amp, bandwidth × 5), and voice part presets.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Update Vite config

**Files:**
- Modify: `web/vite.config.ts`

- [ ] **Step 1: Add research page as second entry**

Replace the full content of `web/vite.config.ts` with:

```typescript
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'ah-research': resolve(__dirname, 'src/research/ah-sound.html'),
      },
    },
  },
  test: {
    globals: true,
  },
})
```

Note: `__dirname` is not available in ESM. The `fileURLToPath` + `dirname` pattern provides it.

- [ ] **Step 2: Verify build succeeds**

Run:
```bash
cd web && npx vite build
```
Expected: Build succeeds with two entry points listed in output.

- [ ] **Step 3: Commit**

```bash
git add web/vite.config.ts
git commit -m "build: add research page as second Vite entry point

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run formants unit tests**

Run:
```bash
cd web && npx vitest --run src/engine/formants.test.ts
```
Expected: All PASS.

- [ ] **Step 2: Run entire test suite**

Run:
```bash
cd web && npx vitest --run
```
Expected: Same pass/fail as baseline (pre-existing voiceLeading failure is OK).

- [ ] **Step 3: Run production build**

Run:
```bash
cd web && npx tsc -b --noEmit && npx vite build
```
Expected: No type errors, build succeeds.

- [ ] **Step 4: Verify dev server serves research page**

Run:
```bash
cd web && npx vite --open src/research/ah-sound.html
```
Expected: Browser opens at `http://localhost:5173/src/research/ah-sound.html` showing the research UI.
