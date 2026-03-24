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
