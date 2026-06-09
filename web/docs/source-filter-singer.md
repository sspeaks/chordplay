# Source-filter singer approach

This document captures the current source-filter singer experiment so we can keep tuning it without rediscovering the architecture.

## Goal

The source-filter singer is the first ChordPlay demo technique that tries to synthesize a human singing a specific pitch without using samples. It is intended to replace "stack of clean sine harmonics" realism experiments with a more voice-like model:

```text
note frequency -> glottal-like source -> breath/noise -> vocal-tract formant filters -> envelope/pan/output
```

The current demo lives in:

- `web/src/research/c-chord-realism.html`
- `web/src/research/c-chord-realism.ts`
- `web/src/research/source-filter-voice-processor.js`

Open it during development at:

```text
http://localhost:5173/src/research/c-chord-realism.html
```

## Why this approach

Sampled voices sounded the most realistic in the C chord demo because they are real recorded voices. The source-filter singer is the best fully synthetic direction because it models the important parts of singing directly:

- `f0`: the exact sung note frequency.
- Glottal source: a periodic voiced excitation, closer to vocal-fold buzz than sine waves.
- Breath: noise mixed into the voiced source.
- Vocal tract: resonant formant filters that shape the source into a vowel.
- Human instability: vibrato, jitter, shimmer, and per-voice offsets.

This keeps exact pitch control for harmony exploration while avoiding the licensing, bundle-size, and formant-shift issues of sample playback.

## Current signal chain

The main thread creates one `AudioWorkletNode` per C chord tone in `c-chord-realism.ts`.

```text
C3/G3/E4/C5 tone
  -> AudioWorkletNode("source-filter-voice")
  -> envelope GainNode
  -> optional StereoPannerNode
  -> destination
```

Inside the worklet, `source-filter-voice-processor.js` generates one mono voice:

```text
frequency AudioParam
  -> phase accumulator
  -> glottalSource(phase, brightness)
  -> + breath noise
  -> parallel bandpass formant filters
  -> shimmer gain
  -> soft saturation
  -> output
```

## Main-thread integration

`c-chord-realism.ts` handles browser and demo concerns:

- Adds `source-filter-singer` to the technique registry.
- Loads the worklet with:

```ts
ctx.audioWorklet.addModule(new URL('./source-filter-voice-processor.js', import.meta.url));
```

- Caches worklet loading per `AudioContext`.
- Creates one worklet node per chord voice.
- Sets params:
  - `frequency`
  - `gain`
  - `vibratoRate`
  - `vibratoDepth`
  - `breath`
  - `brightness`
  - `jitter`
  - `shimmer`
  - `vowel`
- Sends formants through `worklet.port.postMessage({ voiceSettings: { formants, seed } })`.
- Applies the same deterministic voice offsets/panning used by the spatial demo.
- Falls back to the direct formant preset path if AudioWorklet loading fails.

Current integration constants:

```ts
const SOURCE_FILTER_PARAM_GAIN = 0.58;
const SOURCE_FILTER_OUTPUT_GAIN = 0.34;
const SOURCE_FILTER_BRIGHTNESS = 0.52;
const SOURCE_FILTER_JITTER = 0.0025;
const SOURCE_FILTER_SHIMMER = 0.018;
const SOURCE_FILTER_VOWEL = 0;
```

The technique currently uses the `Choir Blend` preset formants as its vocal-tract shape.

## Worklet processor contract

Processor file:

```text
web/src/research/source-filter-voice-processor.js
```

Registered processor name:

```js
source-filter-voice
```

AudioParams:

| Param | Meaning | Current role |
|---|---|---|
| `frequency` | Fundamental pitch in Hz | Exact sung note frequency, a-rate |
| `gain` | Internal worklet gain | Main-thread scheduled gate/envelope mirror |
| `vibratoRate` | Vibrato speed in Hz | Currently inherited from preset |
| `vibratoDepth` | Fractional pitch deviation | Currently inherited from preset |
| `breath` | Breath/noise amount | Currently inherited from preset |
| `brightness` | Source/filter brightness | Narrows/brightens filter response |
| `jitter` | Per-cycle pitch instability | Adds small random pitch offsets |
| `shimmer` | Per-cycle amplitude instability | Adds small random level offsets |
| `vowel` | Built-in vowel morph | Used only when custom formants are reset |

Messages:

```js
{
  voiceSettings: {
    formants: [{ freq, amp, bw }],
    seed
  }
}
```

The main thread currently sends concrete formants from `PRESETS`, so the worklet does not need to duplicate ChordPlay preset lookup logic.

## Current audible feedback

Initial subjective feedback:

- The source-filter singer is the most promising synthetic approach.
- Vibrato is a bit too much.
- There is a speaker buzz/resonance during playback.

Treat this as the first tuning target before adding more features.

## Tuning checklist

### 1. Reduce vibrato first

The current source-filter technique inherits vibrato from the `Choir Blend` preset, which has audible vibrato. For barbershop-style chord lock, start much lower:

```ts
setWorkletParam(worklet, 'vibratoRate', 5.0, voiceStart);
setWorkletParam(worklet, 'vibratoDepth', 0.0015, voiceStart);
```

Possible presets:

| Mode | `vibratoRate` | `vibratoDepth` | Use |
|---|---:|---:|---|
| Locked barbershop | 0 | 0 | Maximum chord lock |
| Subtle human | 5.0 | 0.001-0.003 | Recommended next default |
| Solo singer | 5.2-5.8 | 0.006-0.012 | Too much for locked chords |

Future improvement: add vibrato delay so the pitch starts stable and vibrato fades in after 400-800 ms.

### 2. Investigate the buzz

The buzz could come from several places:

| Suspect | Why | Tweak |
|---|---|---|
| Glottal source shape | Current closure has a sharp negative pulse | Soften `glottalSource()` closing segment or low-pass source before filters |
| Brightness/formant Q | Narrow high formants can excite speaker resonances | Lower `SOURCE_FILTER_BRIGHTNESS` from `0.52` to `0.35-0.45` |
| Output level | Four voices plus filter resonance may overload small speakers | Lower `SOURCE_FILTER_OUTPUT_GAIN` from `0.34` to `0.24-0.28` |
| Breath/noise | Noise through formants can sound fizzy | Reduce `breath` or breath noise scale in the processor |
| High-frequency content | Formant cluster around 2.5-4.2 kHz can be harsh | Add a gentle lowpass after worklet output, around 5-7 kHz |

Recommended first buzz experiment:

```ts
const SOURCE_FILTER_OUTPUT_GAIN = 0.26;
const SOURCE_FILTER_BRIGHTNESS = 0.40;
const SOURCE_FILTER_SHIMMER = 0.010;
```

If the buzz remains, soften `glottalSource()` in `source-filter-voice-processor.js`.

### 3. Add an optional post-worklet lowpass

If small speakers buzz, route each worklet through a lowpass before the envelope:

```text
AudioWorkletNode -> BiquadFilterNode(lowpass, 6000 Hz) -> envelope GainNode
```

This should be a tuning control, not necessarily always-on, because higher formants contribute to vocal presence.

### 4. Separate chord and solo defaults

The same settings should not be used for every context.

| Context | Vibrato | Breath | Brightness | Goal |
|---|---:|---:|---:|---|
| Barbershop chord | none to tiny | low | medium-low | Lock and ring |
| Choir blend | subtle | low-medium | medium | Smooth ensemble |
| Solo voice | stronger | medium | medium-high | Expressive singer |

## Implementation notes

### Why AudioWorklet

The source-filter voice runs per sample and needs stable audio-thread timing. AudioWorklet keeps the DSP off the main UI thread and avoids scheduling hundreds of oscillator/filter nodes per voice.

### Why plain JavaScript

The processor is plain `.js` because AudioWorklet runs in a special global scope. Keeping the file as JavaScript avoids TypeScript configuration for worklet globals and keeps `addModule()` straightforward.

### Why formants are sent by message

AudioParams are good for scalar controls. Formants are structured data, so the main thread sends them as a message. This lets the demo reuse `PRESETS` and later `VOICE_FORMANTS` without duplicating data in the processor.

### Why there is still an envelope GainNode

The worklet has a `gain` param, but the main thread still wraps it in an envelope `GainNode` so the existing cleanup/fade behavior works consistently with other demo techniques.

## Next experiments

1. Lower vibrato defaults for `source-filter-singer`.
2. Lower output gain and brightness to address speaker buzz.
3. Add a post-worklet lowpass toggle or constant.
4. Add vibrato onset delay.
5. Try per-voice formants instead of one shared `Choir Blend` preset.
6. Add a simple UI panel for source-filter controls:
   - vibrato amount
   - brightness
   - breath
   - output gain
   - vowel
7. Compare source-filter singer against current formant presets with the same panning/room path.

## Validation commands

From `web/`:

```bash
npm test
npm run build
```

The build should emit both the C chord realism page and the worklet asset.
