# Formant-Shaped Additive Synthesis for Barbershop Voice Timbre

## Problem

ChordPlay currently uses a static harmonic series (8 harmonics with fixed
amplitudes) identical for all four voice parts. This produces a "synthetic organ"
timbre rather than sounding like human barbershop singers. Real barbershop voices
exhibit:

1. **Formant structure** — vowel-specific resonance peaks shaped by the vocal
   tract, giving voice its human character.
2. **Per-voice timbre differences** — a bass voice has lower formants and a
   darker timbre than a tenor/lead.
3. **Singer's formant** — a spectral energy cluster around 2500–3500 Hz that
   gives trained singers their characteristic "ring" and projection.

## Proposed Solution

Replace the flat harmonic rolloff with **formant-shaped additive synthesis**:
per-voice Gaussian formant envelopes applied to a dynamically-sized harmonic
series, producing a realistic "ah" vowel barbershop timbre.

## Scope

- **In scope**: Web TypeScript audio engine only (`web/src/engine/`)
- **Out of scope**: Haskell backend audio, UI changes, new user-facing controls

## Design

### 1. Formant Profiles

Each voice part gets a distinct set of five formant peaks for the "ah" (IPA [ɑ])
vowel. Values are drawn from vocal acoustics literature (Sundberg 1987, Titze 2000).

Each formant is defined as `{ freq: Hz, amp: relative, bw: bandwidth in Hz }`.

#### Bass (lowest voice, largest vocal tract)

| Formant | Freq (Hz) | Amplitude | Bandwidth (Hz) |
|---------|-----------|-----------|-----------------|
| F1      | 650       | 1.0       | 80              |
| F2      | 1100      | 0.7       | 90              |
| F3      | 2450      | 0.65      | 120             |
| F4      | 3300      | 0.45      | 150             |
| F5      | 4100      | 0.2       | 200             |

#### Baritone

| Formant | Freq (Hz) | Amplitude | Bandwidth (Hz) |
|---------|-----------|-----------|-----------------|
| F1      | 700       | 1.0       | 80              |
| F2      | 1150      | 0.7       | 90              |
| F3      | 2500      | 0.65      | 120             |
| F4      | 3350      | 0.45      | 150             |
| F5      | 4200      | 0.2       | 200             |

#### Tenor

| Formant | Freq (Hz) | Amplitude | Bandwidth (Hz) |
|---------|-----------|-----------|-----------------|
| F1      | 750       | 1.0       | 80              |
| F2      | 1200      | 0.7       | 90              |
| F3      | 2550      | 0.65      | 120             |
| F4      | 3400      | 0.45      | 150             |
| F5      | 4300      | 0.2       | 200             |

#### Lead (same tract size as tenor, brighter projection)

| Formant | Freq (Hz) | Amplitude | Bandwidth (Hz) |
|---------|-----------|-----------|-----------------|
| F1      | 750       | 1.0       | 80              |
| F2      | 1200      | 0.7       | 90              |
| F3      | 2550      | 0.75      | 120             |
| F4      | 3400      | 0.55      | 150             |
| F5      | 4300      | 0.2       | 200             |

**Singer's formant boost**: F3 and F4 amplitudes are boosted above neutral
speaking voice levels. Lead gets the strongest boost (F3=0.75, F4=0.55) for
brighter projection; other voices use F3=0.65, F4=0.45.

**Bandwidth convention**: The `bw` values in the tables above are used as the
Gaussian σ (standard deviation) parameter directly. The effective −3 dB
full-width is approximately `2.355 × bw`.

### 2. Amplitude Computation

For a given voice part and fundamental frequency `f0`, the amplitude of
harmonic number `n` (at frequency `f = n × f0`) is:

```
amplitude(n, voicePart) = spectralTilt(n) × formantEnvelope(n × f0, voicePart)
```

Where:

**Spectral tilt** models the glottal source rolloff:
```
spectralTilt(n) = 1 / n
```
(Approximately −6 dB/octave, typical of a pressed/efficient singing voice.
This matches the existing HARMONICS rolloff slope.)

**Formant envelope** is the sum of Gaussian resonance peaks:
```
formantEnvelope(f, voicePart) = Σ_i  amp[i] × exp(-0.5 × ((f - freq[i]) / bw[i])²)
```

The product of these two functions gives the final harmonic amplitude. The
result is normalized so the **loudest harmonic** has amplitude 1.0 (not the
fundamental — low bass notes naturally have a weak fundamental since it falls
far below F1; listeners perceive pitch from the harmonic pattern).

### 3. Dynamic Harmonic Count

Instead of a fixed 8 harmonics, compute harmonics up to a frequency ceiling:

```
MAX_HARMONIC_FREQ = 5000  // Hz — covers all 5 formants
maxHarmonic = floor(MAX_HARMONIC_FREQ / f0)
```

Examples:
- Bass at 110 Hz → 45 harmonics
- Baritone at 175 Hz → 28 harmonics
- Tenor at 260 Hz → 19 harmonics
- Lead at 330 Hz → 15 harmonics

Harmonics with computed amplitude below a threshold (0.001) are skipped to
save oscillators.

### 4. File Structure

#### New file: `web/src/engine/formants.ts`

Exports:
- `FormantProfile` type — `{ freq: number; amp: number; bw: number }[]`
- `VOICE_FORMANTS: Record<VoicePart, FormantProfile>` — the four profiles
- `computeHarmonics(f0: number, voicePart: VoicePart): [number, number][]`
  — returns `[harmonicNumber, amplitude]` pairs for the given fundamental
  and voice type, ready to replace the static `HARMONICS` array.
  Normalizes so the loudest harmonic has amplitude 1.0.
- `MAX_HARMONIC_FREQ` constant (5000 Hz)
- `AMPLITUDE_THRESHOLD` constant (0.001)

#### Modified: `web/src/engine/audio.ts`

Changes to `scheduleChord`:
- New signature adds `voiceParts`:
  ```typescript
  function scheduleChord(
    ctx: BaseAudioContext, destination: AudioNode,
    freqs: number[], voiceParts: readonly VoicePart[],
    startTime: number, duration: number, style: PlayStyle,
  )
  ```
- For each voice, call `computeHarmonics(baseFreq, voicePart)` instead of
  iterating over the static `HARMONICS` array
- Master gain may need recalibration since more oscillators contribute;
  normalize per-voice by dividing each amplitude by the harmonic count
- Everything else (ADSR envelope, gain scheduling, arpeggio delay) unchanged

The static `HARMONICS` export is preserved for backward compatibility and tests.

#### Modified callers:

`scheduleChord` is called from:
1. `renderSequenceOffline` — passes voice part array
2. `ChordPlayer.playChord` — passes voice part array

Both already have the `freqs` array indexed by voice position (0=Bass,
1=Bari, 2=Tenor, 3=Lead per `VOICE_PARTS`).

### 5. Backward Compatibility

- The `HARMONICS` constant remains exported (used in tests)
- The `envelope()` function is unchanged
- ADSR parameters are unchanged
- All existing tests continue to pass
- No UI changes required

### 6. Test Plan

- Unit tests for `computeHarmonics`:
  - Returns fundamental with amplitude 1.0
  - Bass has more harmonics than tenor for the same note
  - Amplitudes follow formant peaks (e.g., harmonics near F1 are louder)
  - Harmonics below threshold are excluded
  - Respects MAX_HARMONIC_FREQ ceiling
- Integration: existing `audio.test.ts` continues to pass
- Manual: play a chord sequence and verify it sounds more voice-like

### 7. Performance Considerations

Worst case: 4 voices × 45 harmonics = 180 oscillators per chord (vs. current
4 × 8 = 32). The user has explicitly chosen realism over performance. Modern
browsers handle hundreds of oscillators comfortably. The amplitude threshold
pruning will typically reduce the actual count to ~100–120.
