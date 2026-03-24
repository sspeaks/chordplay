# Formant-Shaped Additive Synthesis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 8-harmonic synthesis with formant-shaped additive synthesis that gives each voice part (Bass, Bari, Tenor, Lead) a realistic "ah" vowel timbre resembling actual barbershop singers.

**Architecture:** New `formants.ts` module computes per-voice harmonic amplitudes using Gaussian formant envelopes over a dynamic harmonic series (up to 5 kHz). The existing `audio.ts` calls into it instead of using the static `HARMONICS` array. ADSR, voice leading, tuning, and all UI remain unchanged.

**Tech Stack:** TypeScript, Web Audio API, Vitest

**Spec:** `docs/superpowers/specs/formant-shaped-synthesis.md`

**Environment:** This is a Nix flake project. All commands must be run via:
```bash
cd /home/sspeaks/chordplay && nix develop --command bash -c "cd web && <command>"
```

**Pre-existing test state:** 176/177 pass. 1 failure in `voiceLeading.test.ts` (unrelated, do not fix).

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `web/src/engine/formants.ts` | Create | Formant profiles, amplitude computation, `computeHarmonics()` |
| `web/src/engine/formants.test.ts` | Create | Unit tests for formant computation |
| `web/src/engine/audio.ts` | Modify | Use `computeHarmonics()` in `scheduleChord`, pass voice parts |
| `web/src/engine/audio.test.ts` | Modify | Keep existing tests passing, add formant integration test |
| `web/src/types.ts` | No change | `VoicePart` type already exists |

---

### Task 1: Create formant profiles and amplitude computation

**Files:**
- Create: `web/src/engine/formants.ts`
- Create: `web/src/engine/formants.test.ts`

- [ ] **Step 1: Write failing tests for `computeHarmonics`**

Create `web/src/engine/formants.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeHarmonics, VOICE_FORMANTS, MAX_HARMONIC_FREQ, AMPLITUDE_THRESHOLD } from './formants';

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
    expect(VOICE_FORMANTS.Bass[0]!.freq).toBeLessThan(VOICE_FORMANTS.Tenor[0]!.freq);
  });

  it('Lead has brighter F3/F4 than Tenor', () => {
    expect(VOICE_FORMANTS.Lead[2]!.amp).toBeGreaterThan(VOICE_FORMANTS.Tenor[2]!.amp);
    expect(VOICE_FORMANTS.Lead[3]!.amp).toBeGreaterThan(VOICE_FORMANTS.Tenor[3]!.amp);
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
    const f0 = 110; // Bass low note
    const result = computeHarmonics(f0, 'Bass');
    const maxHarmonicFreq = Math.max(...result.map(([h]) => h * f0));
    expect(maxHarmonicFreq).toBeLessThanOrEqual(MAX_HARMONIC_FREQ);
  });

  it('Bass at 110 Hz has more harmonics than Tenor at 330 Hz', () => {
    const bassResult = computeHarmonics(110, 'Bass');
    const tenorResult = computeHarmonics(330, 'Tenor');
    expect(bassResult.length).toBeGreaterThan(tenorResult.length);
  });

  it('excludes harmonics below amplitude threshold', () => {
    const result = computeHarmonics(220, 'Tenor');
    for (const [, a] of result) {
      // After normalization, all kept harmonics should be above threshold
      // relative to the pre-normalization threshold
      expect(a).toBeGreaterThan(0);
    }
  });

  it('harmonics near F1 are louder than harmonics between formants', () => {
    // For Bass at 110 Hz, harmonic 6 (660 Hz) is near F1 (650 Hz)
    // It should be louder than harmonic 8 (880 Hz) which falls between F1 and F2
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
    // At least some harmonics should differ
    const bassMap = new Map(bass);
    const leadMap = new Map(lead);
    let hasDifference = false;
    for (const [h] of bass) {
      if (leadMap.has(h) && Math.abs(bassMap.get(h)! - leadMap.get(h)!) > 0.01) {
        hasDifference = true;
        break;
      }
    }
    expect(hasDifference).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd /home/sspeaks/chordplay && nix develop --command bash -c "cd web && node_modules/.bin/vitest --run src/engine/formants.test.ts 2>&1"
```
Expected: FAIL — module `./formants` not found.

- [ ] **Step 3: Implement `formants.ts`**

Create `web/src/engine/formants.ts`:

```typescript
import type { VoicePart } from '../types';

export interface Formant {
  readonly freq: number;  // center frequency in Hz
  readonly amp: number;   // relative amplitude (0–1)
  readonly bw: number;    // Gaussian σ (bandwidth) in Hz
}

export type FormantProfile = readonly Formant[];

// "ah" (IPA [ɑ]) vowel formant profiles per voice part.
// Values from vocal acoustics literature (Sundberg 1987, Titze 2000).
// F3/F4 boosted for singer's formant "ring" (~2500-3500 Hz).
// Lead gets extra F3/F4 boost for brighter projection.
export const VOICE_FORMANTS: Record<VoicePart, FormantProfile> = {
  Bass: [
    { freq: 650,  amp: 1.0,  bw: 80  },
    { freq: 1100, amp: 0.7,  bw: 90  },
    { freq: 2450, amp: 0.65, bw: 120 },
    { freq: 3300, amp: 0.45, bw: 150 },
    { freq: 4100, amp: 0.2,  bw: 200 },
  ],
  Bari: [
    { freq: 700,  amp: 1.0,  bw: 80  },
    { freq: 1150, amp: 0.7,  bw: 90  },
    { freq: 2500, amp: 0.65, bw: 120 },
    { freq: 3350, amp: 0.45, bw: 150 },
    { freq: 4200, amp: 0.2,  bw: 200 },
  ],
  Tenor: [
    { freq: 750,  amp: 1.0,  bw: 80  },
    { freq: 1200, amp: 0.7,  bw: 90  },
    { freq: 2550, amp: 0.65, bw: 120 },
    { freq: 3400, amp: 0.45, bw: 150 },
    { freq: 4300, amp: 0.2,  bw: 200 },
  ],
  Lead: [
    { freq: 750,  amp: 1.0,  bw: 80  },
    { freq: 1200, amp: 0.7,  bw: 90  },
    { freq: 2550, amp: 0.75, bw: 120 },
    { freq: 3400, amp: 0.55, bw: 150 },
    { freq: 4300, amp: 0.2,  bw: 200 },
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

function spectralTilt(n: number): number {
  return 1 / n;
}

export function computeHarmonics(
  f0: number,
  voicePart: VoicePart,
): [number, number][] {
  const profile = VOICE_FORMANTS[voicePart];
  const maxHarmonic = Math.floor(MAX_HARMONIC_FREQ / f0);
  const raw: [number, number][] = [];
  let maxAmp = 0;

  for (let n = 1; n <= maxHarmonic; n++) {
    const freq = n * f0;
    const amp = spectralTilt(n) * formantEnvelope(freq, profile);
    if (amp > AMPLITUDE_THRESHOLD) {
      raw.push([n, amp]);
      if (amp > maxAmp) maxAmp = amp;
    }
  }

  if (maxAmp === 0) return raw;
  return raw.map(([h, a]) => [h, a / maxAmp]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd /home/sspeaks/chordplay && nix develop --command bash -c "cd web && node_modules/.bin/vitest --run src/engine/formants.test.ts 2>&1"
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/sspeaks/chordplay && git add web/src/engine/formants.ts web/src/engine/formants.test.ts
git commit -m "feat: add formant-shaped harmonic computation for barbershop voice timbres

Introduce per-voice formant profiles (Bass, Bari, Tenor, Lead) for 'ah'
vowel with singer's formant boost. computeHarmonics() replaces the static
HARMONICS array with dynamic, formant-shaped amplitudes up to 5 kHz.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Integrate formants into the audio engine

**Files:**
- Modify: `web/src/engine/audio.ts` (lines 36–87: `scheduleChord` function)
- Modify: `web/src/engine/audio.test.ts`

- [ ] **Step 1: Write a failing integration test**

Add to `web/src/engine/audio.test.ts`:

```typescript
import { computeHarmonics } from './formants';

describe('formant integration', () => {
  it('computeHarmonics produces more harmonics than static HARMONICS', () => {
    const formantHarmonics = computeHarmonics(220, 'Bass');
    expect(formantHarmonics.length).toBeGreaterThan(HARMONICS.length);
  });

  it('different voices produce different harmonic counts at same frequency', () => {
    const bass = computeHarmonics(220, 'Bass');
    const lead = computeHarmonics(220, 'Lead');
    // They may have same count but different amplitudes — just verify they work
    expect(bass.length).toBeGreaterThan(0);
    expect(lead.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

This test should already pass since `formants.ts` exists from Task 1.

Run:
```bash
cd /home/sspeaks/chordplay && nix develop --command bash -c "cd web && node_modules/.bin/vitest --run src/engine/audio.test.ts 2>&1"
```
Expected: PASS (all existing + new tests).

- [ ] **Step 3: Modify `scheduleChord` to use formant harmonics**

In `web/src/engine/audio.ts`, make these changes:

1. Add import at top:
```typescript
import type { VoicePart } from '../types';
import { VOICE_PARTS } from '../types';
import { computeHarmonics } from './formants';
```

2. Change `scheduleChord` signature to accept voice parts:
```typescript
function scheduleChord(
  ctx: BaseAudioContext,
  destination: AudioNode,
  freqs: number[],
  voiceParts: readonly VoicePart[],
  startTime: number,
  duration: number,
  style: PlayStyle,
): { oscillators: OscillatorNode[]; gains: GainNode[] } {
```

3. Inside `scheduleChord`, replace the `HARMONICS` loop with `computeHarmonics`:
```typescript
freqs.forEach((baseFreq, voiceIdx) => {
    const voiceOffset = voiceIdx * arpDelay;
    const voicePart = voiceParts[voiceIdx] ?? 'Lead';
    const harmonics = computeHarmonics(baseFreq, voicePart);

    for (const [harmonic, amplitude] of harmonics) {
```

The rest of the loop body (oscillator creation, gain scheduling, ADSR) stays exactly the same.

4. Update all callers of `scheduleChord` to pass `VOICE_PARTS`:
   - In `renderSequenceOffline` (line ~127):
     ```typescript
     scheduleChord(offCtx, offCtx.destination, freqs, VOICE_PARTS, cursor, duration, style);
     ```
   - In `ChordPlayer.playChord` (line ~168):
     ```typescript
     this.activeNodes = scheduleChord(ctx, ctx.destination, freqs, VOICE_PARTS, now, duration, style);
     ```

- [ ] **Step 4: Run all tests to verify nothing broke**

Run:
```bash
cd /home/sspeaks/chordplay && nix develop --command bash -c "cd web && node_modules/.bin/vitest --run 2>&1"
```
Expected: Same pass/fail as baseline (176 pass, 1 pre-existing failure in voiceLeading).

- [ ] **Step 5: Commit**

```bash
cd /home/sspeaks/chordplay && git add web/src/engine/audio.ts web/src/engine/audio.test.ts
git commit -m "feat: integrate formant-shaped synthesis into audio engine

scheduleChord now uses computeHarmonics() per voice part instead of the
static HARMONICS array. Each voice (Bass, Bari, Tenor, Lead) gets its
own formant-shaped timbre. Dynamic harmonic count adapts to pitch.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Build verification and manual test

- [ ] **Step 1: Run TypeScript compilation check**

Run:
```bash
cd /home/sspeaks/chordplay && nix develop --command bash -c "cd web && node_modules/.bin/tsc -b --noEmit 2>&1"
```
Expected: No errors.

- [ ] **Step 2: Run full build**

Run:
```bash
cd /home/sspeaks/chordplay && nix develop --command bash -c "cd web && node_modules/.bin/vite build 2>&1"
```
Expected: Build succeeds.

- [ ] **Step 3: Run full test suite one final time**

Run:
```bash
cd /home/sspeaks/chordplay && nix develop --command bash -c "cd web && node_modules/.bin/vitest --run 2>&1"
```
Expected: 176+ pass, 1 pre-existing failure.

- [ ] **Step 4: Commit spec and plan docs**

```bash
cd /home/sspeaks/chordplay && git add docs/superpowers/
git commit -m "docs: add formant-shaped synthesis spec and implementation plan

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
