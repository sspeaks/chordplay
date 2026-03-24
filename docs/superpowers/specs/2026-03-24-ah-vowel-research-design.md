# "Ah" Vowel Synthesis Research Page — Design Spec

## Problem

ChordPlay's formant synthesis spec defines voice profiles on paper, but there's
no way to hear the result in isolation and iterate on realism. We need a
standalone research environment where we can play a single sustained "Ah" vowel,
see its spectrum, and tweak every formant parameter in real time until it sounds
convincingly human.

## Approach

Hybrid additive synthesis: formant-shaped harmonic oscillators (from the
existing spec) plus filtered noise for breathiness and subtle modulations
(vibrato, amplitude jitter) for organic texture. All parameters are
slider-controllable with real-time updates — no restart needed when changing
values.

## Scope

- **In scope**: Standalone research page in `web/src/research/`, spectrum
  visualization, full parameter control, voice presets
- **Out of scope**: Integration into the main ChordPlay app, multi-voice
  chords, ADSR envelopes, playback sequencing

## Design

### 1. Project Structure

The research page lives alongside the main app as a separate Vite entry point:

```
web/src/engine/
└── formants.ts           ← formant profiles + computeHarmonics() (new file)

web/src/research/
├── ah-sound.html         ← standalone HTML entry
├── ah-sound.ts           ← wires up UI + audio
├── formantSynth.ts       ← hybrid synth engine
└── spectrumAnalyzer.ts   ← canvas-based FFT + waveform visualization
```

Vite config gets a second entry in `build.rollupOptions.input` so
`ah-sound.html` builds alongside the main app. During dev, accessible at
`http://localhost:5173/src/research/ah-sound.html`.

**Prerequisite**: `web/src/engine/formants.ts` does not exist yet (it is
defined in the formant-shaped-synthesis spec but has not been implemented).
This research page must create it as part of its scope. The synth engine
imports formant profiles from `engine/formants.ts` as preset starting points.

### 2. Hybrid Synth Engine (`formantSynth.ts`)

#### Signal Chain

```
┌─────────────────────────────┐
│ Harmonic Core (additive)    │
│ N sine oscillators shaped   │
│ by formant Gaussians +      │──┐
│ spectral tilt (1/n^k)       │  │
└─────────────────────────────┘  │
                                 ├─→ Master Gain → AnalyserNode → Destination
┌─────────────────────────────┐  │
│ Breathiness Layer           │  │
│ White noise → 5 parallel    │──┘
│ BiquadFilter (bandpass) at  │
│ each formant freq, mixed    │
│ at adjustable breath level  │
└─────────────────────────────┘

Modulations applied to harmonic core:
 • Vibrato: LFO (sine ~5Hz) → OscillatorNode.frequency
 • Amplitude jitter: LFO (~3Hz, random-ish) → GainNode
```

#### Harmonic Core

For a given fundamental frequency `f0`, compute harmonics up to 5000 Hz:

```
maxHarmonic = floor(5000 / f0)
```

For each harmonic `n` at frequency `f = n × f0`:

```
amplitude(n) = spectralTilt(n) × formantEnvelope(f)
spectralTilt(n) = 1 / n^k   where k is adjustable (default k=1, i.e. -6 dB/oct)
formantEnvelope(f) = Σ_i  amp[i] × exp(-0.5 × ((f - freq[i]) / bw[i])²)
```

`bw` is used as the Gaussian σ (standard deviation) directly. The effective
−3 dB full-width is approximately `2.355 × bw`.

Harmonics below amplitude threshold (0.001 pre-normalization) are skipped.
Final amplitudes normalized so the loudest harmonic is 1.0.

Each harmonic is a `sine` `OscillatorNode` with its own `GainNode`.

#### Breathiness Layer

A single `AudioBufferSourceNode` generating white noise, split into 5 parallel
`BiquadFilterNode` (bandpass) paths, one per formant:

- Filter frequency = formant center frequency
- Filter Q = formant freq / formant bandwidth
- Output gain = formant amplitude × breath mix level

All 5 filtered noise signals sum into the master gain.

#### Vibrato

A low-frequency `OscillatorNode` (sine) connected to each harmonic
oscillator's `frequency` `AudioParam` via a `GainNode` that scales the LFO
output to `f0 × vibratoDepth`.

#### Amplitude Jitter

A second LFO at ~3 Hz with a small random component, connected to the master
gain node to create subtle amplitude fluctuations.

### 3. Controllable Parameters

| Parameter | Default | Range | Update Method |
|-----------|---------|-------|---------------|
| F0 (fundamental) | 220 Hz | 80–600 Hz | Rebuild oscillators |
| Per-formant freq (×5) | from spec | ±50% | `BiquadFilter.frequency`, recompute harmonics |
| Per-formant amp (×5) | from spec | 0–1 | Recompute harmonic gains |
| Per-formant bandwidth (×5) | from spec | 20–400 Hz | `BiquadFilter.Q`, recompute harmonics |
| Spectral tilt exponent | 1.0 | 0.3–2.0 | Recompute harmonic gains |
| Breath mix | 0.05 | 0–0.5 | Breath gain node |
| Vibrato rate | 5 Hz | 0–8 Hz | LFO `frequency` param |
| Vibrato depth | 1% | 0–5% | LFO gain param |
| Amp jitter | 0.02 | 0–0.1 | Jitter gain param |

Parameters that change gain values update `AudioParam` values smoothly
(`setTargetAtTime` with short time constant). Parameters that change the
harmonic structure (F0, formant freq/bandwidth) tear down and rebuild
oscillators with a brief crossfade to avoid clicks.

### 4. UI Layout

Dark theme matching the existing ChordPlay app (same CSS variables/font).

```
┌──────────────────────────────────────────────┐
│  "Ah" Vowel Research    [▶ Play] [⏹ Stop]    │
├──────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐  │
│  │  Spectrum Analyzer (FFT)               │  │
│  │  X: 0–5 kHz (log scale)               │  │
│  │  Y: dB (linear mapped)                │  │
│  │  Shows harmonic peaks                  │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  Waveform (time domain)                │  │
│  └────────────────────────────────────────┘  │
├──────────────────────────────────────────────┤
│  Global Controls                             │
│  Fundamental: [====●==========] 220 Hz       │
│  Spectral Tilt: [=====●=======] -6 dB/oct    │
│  Breath Mix: [●===============] 0.05         │
│  Vibrato Rate: [====●=========] 5 Hz         │
│  Vibrato Depth: [●============] 1%           │
│  Amp Jitter: [●===============] 0.02         │
├──────────────────────────────────────────────┤
│  Formants                                    │
│  F1: Freq [=●==] 650  Amp [===●] 1.0  BW [●] 80  │
│  F2: Freq [=●==] 1100 Amp [==●=] 0.7  BW [●] 90  │
│  F3: Freq [==●=] 2450 Amp [==●=] 0.65 BW [●] 120 │
│  F4: Freq [==●=] 3300 Amp [=●==] 0.45 BW [●] 150 │
│  F5: Freq [===●] 4100 Amp [●===] 0.2  BW [●] 200 │
├──────────────────────────────────────────────┤
│  Presets: [Bass] [Bari] [Tenor] [Lead]       │
│  [Reset to Default]                           │
└──────────────────────────────────────────────┘
```

### 5. Spectrum Analyzer (`spectrumAnalyzer.ts`)

Uses an `AnalyserNode` with `fftSize = 4096` (2048 frequency bins at 44.1 kHz
→ ~10.7 Hz resolution per bin — sufficient to resolve individual harmonics at
220 Hz).

Two `<canvas>` elements:

1. **Frequency spectrum**: Draws `getByteFrequencyData()` as a filled curve.
   X-axis 0–5 kHz. Y-axis in dB (0–255 mapped). Updates via
   `requestAnimationFrame`.

2. **Waveform**: Draws `getByteTimeDomainData()` as an oscilloscope trace.
   Shows ~2 periods of the waveform.

Both canvases use the dark theme background with a contrasting line color.

### 6. Voice Presets

Four preset buttons load the formant profiles from `engine/formants.ts`
(Bass, Bari, Tenor, Lead). Clicking a preset:

1. Sets all 15 formant sliders to the profile values
2. Triggers harmonic recomputation
3. Does not change global controls (F0, breath, vibrato, jitter)

"Reset to Default" reverts everything including global controls.

### 7. Error Handling

- `AudioContext` creation guarded with try/catch; shows message if
  Web Audio is unavailable
- Play button handles the "user gesture required" policy by
  calling `ctx.resume()` on first click
- Slider inputs validated to stay within defined ranges

### 8. Testing

This is a research/exploration tool — no automated tests for the research
page UI itself. Validation is by ear and visual spectrum inspection.

`engine/formants.ts` (created as part of this work) should have unit tests
for `computeHarmonics` since it will be reused by the main app later. Tests
live at `web/src/engine/formants.test.ts` and cover: normalization, harmonic
count limits, formant peak shaping, and voice part differentiation.
