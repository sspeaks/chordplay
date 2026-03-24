# ChordPlay Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone static web app that ports chordplay's barbershop harmony chord player to the browser with Web Audio API synthesis, interactive toggles, chord visualization, and syntax reference.

**Architecture:** React SPA with TypeScript core engine ported from Haskell. All audio synthesis happens client-side via Web Audio API. No backend needed — deploys as static files. Core engine modules (types, music theory, parser, voice leading, audio) are pure TypeScript with no React dependencies, tested independently with Vitest.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Web Audio API

---

## File Structure

```
web/
├── index.html                      # Vite entry HTML
├── package.json                    # Dependencies + scripts
├── tsconfig.json                   # TypeScript config
├── vite.config.ts                  # Vite config
├── src/
│   ├── main.tsx                    # React DOM mount
│   ├── App.tsx                     # Root component, state, wiring
│   ├── types.ts                    # PitchClass, ChordType, Pitch, ChordSymbol, etc.
│   ├── engine/
│   │   ├── musicTheory.ts          # Intervals, voicing, pitch/freq, just intonation
│   │   ├── musicTheory.test.ts     # Tests for music theory (port of MusicTheorySpec.hs)
│   │   ├── parser.ts               # Chord symbol parser
│   │   ├── parser.test.ts          # Tests for parser (port of ParserSpec.hs)
│   │   ├── voiceLeading.ts         # Smooth voice leading algorithm
│   │   ├── voiceLeading.test.ts    # Tests for voice leading
│   │   ├── audio.ts                # Web Audio API synthesis engine
│   │   └── audio.test.ts           # Tests for audio math (not playback)
│   ├── components/
│   │   ├── Toolbar.tsx             # Toggle controls bar
│   │   ├── ChordInput.tsx          # Text input with parse validation + highlight
│   │   ├── PlaybackControls.tsx    # Play/Stop/Prev/Next + tempo slider
│   │   ├── NoteCards.tsx           # Voice card visualization
│   │   ├── TuningComparison.tsx    # Just vs Equal frequency display
│   │   └── SyntaxReference.tsx     # Slide-out reference panel
│   └── styles/
│       └── index.css               # Global dark theme styles
```

---

### Task 1: Scaffold Vite + React + TypeScript Project

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "chordplay-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "~5.6.2",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `web/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
  },
})
```

- [ ] **Step 4: Create `web/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ChordPlay — Barbershop Harmony Explorer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `web/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 6: Create `web/src/App.tsx` (placeholder)**

```tsx
export default function App() {
  return (
    <div className="app">
      <h1>♩ ChordPlay Web</h1>
      <p>Barbershop Harmony Explorer</p>
    </div>
  )
}
```

- [ ] **Step 7: Create `web/src/styles/index.css` (minimal reset)**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #12121e;
  color: #e0e0e0;
}

#root {
  min-height: 100vh;
}
```

- [ ] **Step 8: Install dependencies**

Run: `cd web && npm install`
Expected: `node_modules/` created, no errors

- [ ] **Step 9: Verify dev server starts**

Run: `cd web && npx vite --host 0.0.0.0 &` then `curl -s http://localhost:5173 | head -5`
Expected: HTML response containing "ChordPlay"
Then kill the dev server.

- [ ] **Step 10: Commit**

```bash
git add web/
git commit -m "feat(web): scaffold Vite + React + TypeScript project

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Port Core Types

**Files:**
- Create: `web/src/types.ts`

- [ ] **Step 1: Create `web/src/types.ts`**

Port all types from `src/ChordPlay/MusicTheory.hs` lines 23-46.

```typescript
// Chromatic pitch classes — matches Haskell's PitchClass enum order
export const PITCH_CLASSES = ['C','Cs','D','Ds','E','F','Fs','G','Gs','A','As','B'] as const;
export type PitchClass = typeof PITCH_CLASSES[number];

export const CHORD_TYPES = [
  'Major','Minor','Dom7','Maj7','Min7',
  'Dim','Dim7','Aug','HalfDim7',
  'Sus4','Sus2','MinMaj7','Maj6','Min6',
  'Dom9'
] as const;
export type ChordType = typeof CHORD_TYPES[number];

export type SmoothMode = 'equal' | 'bass';

export interface Pitch {
  readonly pitchClass: PitchClass;
  readonly octave: number;
}

export interface ChordSymbol {
  readonly root: PitchClass;
  readonly quality: ChordType;
  readonly inversion: number | null;  // null = auto-voice in smooth mode
}

export type Tuning = 'just' | 'equal';
export type PlayStyle = 'block' | 'arpeggio';
export type VoiceLeading = 'off' | 'smooth' | 'bass';

// Result type for parser
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// Voice part labels for visualization
export const VOICE_PARTS = ['Bass', 'Bari', 'Tenor', 'Lead'] as const;
export type VoicePart = typeof VOICE_PARTS[number];
```

- [ ] **Step 2: Verify types compile**

Run: `cd web && npx tsc --noEmit src/types.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts
git commit -m "feat(web): port core types from Haskell

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Port Music Theory Module

**Files:**
- Create: `web/src/engine/musicTheory.ts`
- Create: `web/src/engine/musicTheory.test.ts`

This is a faithful port of `src/ChordPlay/MusicTheory.hs`. Every function, every constant, every algorithm.

- [ ] **Step 1: Write failing tests**

Port from `test/MusicTheorySpec.hs`. Cover: `pitchClassToInt`, `pitchToMidi`, `pitchFrequency`, `chordIntervals`, `voiceChord`, `chordPitchClasses`, `nearestPitch`.

```typescript
import { describe, it, expect } from 'vitest';
import {
  pitchClassToInt,
  pitchClassFromInt,
  pitchToMidi,
  pitchFrequency,
  chordIntervals,
  voiceChord,
  chordPitchClasses,
  nearestPitch,
  justFrequencies,
  equalFrequencies,
  midiToPitch,
} from './musicTheory';
import type { Pitch } from '../types';

describe('pitchClassToInt', () => {
  it('maps C=0 through B=11', () => {
    expect(pitchClassToInt('C')).toBe(0);
    expect(pitchClassToInt('Cs')).toBe(1);
    expect(pitchClassToInt('A')).toBe(9);
    expect(pitchClassToInt('B')).toBe(11);
  });
});

describe('pitchToMidi', () => {
  it('A4 = 69', () => {
    expect(pitchToMidi({ pitchClass: 'A', octave: 4 })).toBe(69);
  });
  it('C4 = 60', () => {
    expect(pitchToMidi({ pitchClass: 'C', octave: 4 })).toBe(60);
  });
  it('C3 = 48', () => {
    expect(pitchToMidi({ pitchClass: 'C', octave: 3 })).toBe(48);
  });
});

describe('pitchFrequency', () => {
  it('A4 = 440 Hz', () => {
    expect(pitchFrequency({ pitchClass: 'A', octave: 4 })).toBeCloseTo(440.0, 1);
  });
  it('A5 = 880 Hz', () => {
    expect(pitchFrequency({ pitchClass: 'A', octave: 5 })).toBeCloseTo(880.0, 1);
  });
});

describe('chordIntervals', () => {
  it('Major = [0,4,7,12]', () => {
    expect(chordIntervals('Major')).toEqual([0, 4, 7, 12]);
  });
  it('Dom7 = [0,4,7,10]', () => {
    expect(chordIntervals('Dom7')).toEqual([0, 4, 7, 10]);
  });
  it('Min7 = [0,3,7,10]', () => {
    expect(chordIntervals('Min7')).toEqual([0, 3, 7, 10]);
  });
  it('Dim7 = [0,3,6,9]', () => {
    expect(chordIntervals('Dim7')).toEqual([0, 3, 6, 9]);
  });
  it('HalfDim7 = [0,3,6,10]', () => {
    expect(chordIntervals('HalfDim7')).toEqual([0, 3, 6, 10]);
  });
  it('Dom9 = [-5,2,4,10] (rootless)', () => {
    expect(chordIntervals('Dom9')).toEqual([-5, 2, 4, 10]);
  });
});

describe('voiceChord', () => {
  it('C Major root position has 4 notes', () => {
    const pitches = voiceChord('C', 'Major', 0);
    expect(pitches).toHaveLength(4);
  });
  it('C Major root position starts on C3', () => {
    const pitches = voiceChord('C', 'Major', 0);
    expect(pitches[0]).toEqual({ pitchClass: 'C', octave: 3 });
  });
  it('inversions stay in [-3,3]', () => {
    const inv3 = voiceChord('C', 'Major', 3);
    const inv4 = voiceChord('C', 'Major', 4); // clamped to 3
    expect(inv3).toEqual(inv4);
  });
  it('1st inversion rotates lowest note up an octave', () => {
    const root = voiceChord('C', 'Major', 0);
    const first = voiceChord('C', 'Major', 1);
    // Root position: C3 E3 G3 C4
    // 1st inversion: E3 G3 C4 C4 — first note goes up
    expect(pitchToMidi(first[0]!)).toBeGreaterThan(pitchToMidi(root[0]!));
  });
});

describe('chordPitchClasses', () => {
  it('C Major = [C, E, G, C]', () => {
    expect(chordPitchClasses('C', 'Major')).toEqual(['C', 'E', 'G', 'C']);
  });
  it('D Dom7 = [D, Fs, A, C]', () => {
    expect(chordPitchClasses('D', 'Dom7')).toEqual(['D', 'Fs', 'A', 'C']);
  });
});

describe('nearestPitch', () => {
  it('finds nearest C to midi 61 → C4 (midi 60)', () => {
    const p = nearestPitch('C', 61);
    expect(pitchToMidi(p)).toBe(60);
  });
  it('ties go low: nearest C to midi 66 → C4 (midi 60, not C5=72)', () => {
    const p = nearestPitch('C', 66);
    expect(pitchToMidi(p)).toBe(60);
  });
});

describe('midiToPitch', () => {
  it('69 → A4', () => {
    expect(midiToPitch(69)).toEqual({ pitchClass: 'A', octave: 4 });
  });
  it('60 → C4', () => {
    expect(midiToPitch(60)).toEqual({ pitchClass: 'C', octave: 4 });
  });
});

describe('justFrequencies', () => {
  it('root frequency matches A4 = 440 Hz for A chord', () => {
    const pitches: Pitch[] = [
      { pitchClass: 'A', octave: 3 },
      { pitchClass: 'Cs', octave: 4 },
      { pitchClass: 'E', octave: 4 },
      { pitchClass: 'A', octave: 4 },
    ];
    const freqs = justFrequencies('A', pitches);
    // A3 = 220 Hz (1/1), Cs4 = 275 Hz (5/4), E4 = 330 Hz (3/2), A4 = 440 Hz (2/1)
    expect(freqs[0]).toBeCloseTo(220.0, 0);
    expect(freqs[1]).toBeCloseTo(275.0, 0);
    expect(freqs[2]).toBeCloseTo(330.0, 0);
    expect(freqs[3]).toBeCloseTo(440.0, 0);
  });
});

describe('equalFrequencies', () => {
  it('A4 = 440 Hz in equal temperament', () => {
    const pitches: Pitch[] = [{ pitchClass: 'A', octave: 4 }];
    const freqs = equalFrequencies(pitches);
    expect(freqs[0]).toBeCloseTo(440.0, 1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/musicTheory.test.ts`
Expected: FAIL — module `./musicTheory` not found

- [ ] **Step 3: Write `musicTheory.ts` implementation**

Port from `src/ChordPlay/MusicTheory.hs` lines 48-130 and `src/ChordPlay/Audio.hs` lines 33-59.

```typescript
import { PITCH_CLASSES, type PitchClass, type ChordType, type Pitch } from '../types';

export function pitchClassToInt(pc: PitchClass): number {
  return PITCH_CLASSES.indexOf(pc);
}

export function pitchClassFromInt(n: number): PitchClass {
  const idx = ((n % 12) + 12) % 12;  // handle negatives
  return PITCH_CLASSES[idx]!;
}

export function pitchToMidi(p: Pitch): number {
  return (p.octave + 1) * 12 + pitchClassToInt(p.pitchClass);
}

export function midiToPitch(midi: number): Pitch {
  const pc = pitchClassFromInt(midi % 12);
  const oct = Math.floor(midi / 12) - 1;
  return { pitchClass: pc, octave: oct };
}

export function pitchFrequency(p: Pitch): number {
  const midi = pitchToMidi(p);
  return 440.0 * Math.pow(2.0, (midi - 69) / 12.0);
}

const INTERVALS: Record<ChordType, readonly number[]> = {
  Major:    [0, 4, 7, 12],
  Minor:    [0, 3, 7, 12],
  Dom7:     [0, 4, 7, 10],
  Maj7:     [0, 4, 7, 11],
  Min7:     [0, 3, 7, 10],
  Dim:      [0, 3, 6, 12],
  Dim7:     [0, 3, 6, 9],
  Aug:      [0, 4, 8, 12],
  HalfDim7: [0, 3, 6, 10],
  Sus4:     [0, 5, 7, 12],
  Sus2:     [0, 2, 7, 12],
  MinMaj7:  [0, 3, 7, 11],
  Maj6:     [0, 4, 7, 9],
  Min6:     [0, 3, 7, 9],
  Dom9:     [-5, 2, 4, 10],  // rootless: 5, 9, 3, b7
};

export function chordIntervals(ct: ChordType): readonly number[] {
  return INTERVALS[ct];
}

export function chordPitchClasses(root: PitchClass, ct: ChordType): PitchClass[] {
  const rootInt = pitchClassToInt(root);
  return chordIntervals(ct).map(i => pitchClassFromInt(rootInt + i));
}

export function voiceChord(root: PitchClass, ct: ChordType, inv: number): Pitch[] {
  const baseMidi = pitchToMidi({ pitchClass: root, octave: 3 });
  const intervals = chordIntervals(ct);
  const basePitches = intervals.map(i => midiToPitch(baseMidi + i));
  const clampedInv = Math.max(-3, Math.min(3, inv));
  return applyInversion(clampedInv, basePitches);
}

function applyInversion(n: number, ps: Pitch[]): Pitch[] {
  if (n === 0 || ps.length === 0) return ps;
  if (n > 0) return applyInversion(n - 1, rotateUp(ps));
  return applyInversion(n + 1, rotateDown(ps));
}

function rotateUp(ps: Pitch[]): Pitch[] {
  if (ps.length === 0) return ps;
  const [first, ...rest] = ps;
  return [...rest, { pitchClass: first!.pitchClass, octave: first!.octave + 1 }];
}

function rotateDown(ps: Pitch[]): Pitch[] {
  if (ps.length === 0) return ps;
  const last = ps[ps.length - 1]!;
  return [{ pitchClass: last.pitchClass, octave: last.octave - 1 }, ...ps.slice(0, -1)];
}

export function nearestPitch(pc: PitchClass, targetMidi: number): Pitch {
  const pcInt = pitchClassToInt(pc);
  const octFloat = (targetMidi - pcInt) / 12.0 - 1.0;
  const octLow = Math.floor(octFloat);
  const octHigh = Math.ceil(octFloat);
  const midiLow = (octLow + 1) * 12 + pcInt;
  const midiHigh = (octHigh + 1) * 12 + pcInt;
  // Ties go low (matches Haskell's <= behavior)
  if (Math.abs(midiLow - targetMidi) <= Math.abs(midiHigh - targetMidi)) {
    return { pitchClass: pc, octave: octLow };
  }
  return { pitchClass: pc, octave: octHigh };
}

// Just intonation ratios — pure harmonic frequency ratios
function justRatio(semitones: number): number {
  if (semitones < 0) return justRatio(semitones + 12) / 2.0;
  if (semitones >= 12) return 2.0 * justRatio(semitones - 12);
  const ratios: Record<number, number> = {
    0: 1/1,       // unison
    1: 16/15,     // minor 2nd
    2: 9/8,       // major 2nd
    3: 6/5,       // minor 3rd
    4: 5/4,       // major 3rd
    5: 4/3,       // perfect 4th
    6: 7/5,       // tritone (septimal)
    7: 3/2,       // perfect 5th
    8: 8/5,       // minor 6th
    9: 5/3,       // major 6th
    10: 7/4,      // minor 7th (septimal — the barbershop 7th)
    11: 15/8,     // major 7th
  };
  return ratios[semitones]!;
}

export function justFrequencies(root: PitchClass, pitches: Pitch[]): number[] {
  if (pitches.length === 0) return [];
  const midis = pitches.map(pitchToMidi);
  const bassMidi = Math.min(...midis);
  const rootPc = pitchClassToInt(root);
  const rootMidi = bassMidi - (((bassMidi - rootPc) % 12) + 12) % 12;
  const rootFreq = 440.0 * Math.pow(2.0, (rootMidi - 69) / 12.0);
  return pitches.map(p => rootFreq * justRatio(pitchToMidi(p) - rootMidi));
}

export function equalFrequencies(pitches: Pitch[]): number[] {
  return pitches.map(pitchFrequency);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/musicTheory.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/musicTheory.ts web/src/engine/musicTheory.test.ts
git commit -m "feat(web): port music theory module with tests

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Port Chord Parser

**Files:**
- Create: `web/src/engine/parser.ts`
- Create: `web/src/engine/parser.test.ts`

Port from `src/ChordPlay/Parser.hs`. The Haskell version uses Parsec; we'll write a hand-rolled recursive descent parser since it's simple (no ambiguity, fixed grammar).

- [ ] **Step 1: Write failing tests**

Port from `test/ParserSpec.hs`.

```typescript
import { describe, it, expect } from 'vitest';
import { parseChord, parseChordSequence } from './parser';
import type { ChordSymbol } from '../types';

function expectChord(input: string, expected: ChordSymbol) {
  const result = parseChord(input);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value).toEqual(expected);
  }
}

function expectFail(input: string) {
  const result = parseChord(input);
  expect(result.ok).toBe(false);
}

describe('parseChord', () => {
  it('C → C Major', () => {
    expectChord('C', { root: 'C', quality: 'Major', inversion: null });
  });
  it('Am → A Minor', () => {
    expectChord('Am', { root: 'A', quality: 'Minor', inversion: null });
  });
  it('Bb7 → Bb Dom7', () => {
    expectChord('Bb7', { root: 'As', quality: 'Dom7', inversion: null });
  });
  it('F#m7 → F# Min7', () => {
    expectChord('F#m7', { root: 'Fs', quality: 'Min7', inversion: null });
  });
  it('Ebmaj7 → Eb Maj7', () => {
    expectChord('Ebmaj7', { root: 'Ds', quality: 'Maj7', inversion: null });
  });
  it('Gdim7 → G Dim7', () => {
    expectChord('Gdim7', { root: 'G', quality: 'Dim7', inversion: null });
  });
  it('C+ → C Aug', () => {
    expectChord('C+', { root: 'C', quality: 'Aug', inversion: null });
  });
  it('Caug → C Aug', () => {
    expectChord('Caug', { root: 'C', quality: 'Aug', inversion: null });
  });
  it('Cm7b5 → C HalfDim7', () => {
    expectChord('Cm7b5', { root: 'C', quality: 'HalfDim7', inversion: null });
  });
  it('Csus4 → C Sus4', () => {
    expectChord('Csus4', { root: 'C', quality: 'Sus4', inversion: null });
  });
  it('CmMaj7 → C MinMaj7', () => {
    expectChord('CmMaj7', { root: 'C', quality: 'MinMaj7', inversion: null });
  });
  it('C6 → C Maj6', () => {
    expectChord('C6', { root: 'C', quality: 'Maj6', inversion: null });
  });
  it('Cm6 → C Min6', () => {
    expectChord('Cm6', { root: 'C', quality: 'Min6', inversion: null });
  });
  it('A9 → A Dom9 (rootless)', () => {
    expectChord('A9', { root: 'A', quality: 'Dom9', inversion: null });
  });

  // Inversions
  it('1G7 → G Dom7, inversion 1', () => {
    expectChord('1G7', { root: 'G', quality: 'Dom7', inversion: 1 });
  });
  it('2Eb → Eb Major, inversion 2', () => {
    expectChord('2Eb', { root: 'Ds', quality: 'Major', inversion: 2 });
  });
  it('-1G7 → G Dom7, inversion -1', () => {
    expectChord('-1G7', { root: 'G', quality: 'Dom7', inversion: -1 });
  });
  it('0C → C Major, inversion 0', () => {
    expectChord('0C', { root: 'C', quality: 'Major', inversion: 0 });
  });

  // Errors
  it('empty string fails', () => {
    expectFail('');
  });
  it('invalid root fails', () => {
    expectFail('X7');
  });
});

describe('parseChordSequence', () => {
  it('parses space-separated chords', () => {
    const result = parseChordSequence('C Am7 G7');
    expect(result).toHaveLength(3);
    expect(result[0]!.ok).toBe(true);
    expect(result[1]!.ok).toBe(true);
    expect(result[2]!.ok).toBe(true);
  });
  it('marks invalid chords as errors', () => {
    const result = parseChordSequence('C XYZ G');
    expect(result).toHaveLength(3);
    expect(result[0]!.ok).toBe(true);
    expect(result[1]!.ok).toBe(false);
    expect(result[2]!.ok).toBe(true);
  });
  it('handles empty input', () => {
    const result = parseChordSequence('');
    expect(result).toHaveLength(0);
  });
  it('handles myRomance.txt content', () => {
    const result = parseChordSequence('D A7 A9 D D7 Ab7 G6 Gm6 D F#7');
    expect(result).toHaveLength(10);
    expect(result.every(r => r.ok)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/parser.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write `parser.ts` implementation**

```typescript
import type { PitchClass, ChordType, ChordSymbol, ParseResult } from '../types';

export function parseChord(input: string): ParseResult<ChordSymbol> {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Empty input' };
  }

  let pos = 0;

  // Parse optional inversion prefix: [-]digit
  let inversion: number | null = null;
  if (pos < trimmed.length) {
    const negMatch = trimmed.slice(pos).match(/^(-?\d)/);
    if (negMatch) {
      // But only if followed by a letter A-G (otherwise "9" might be a quality)
      // Check if the character after the digit(s) is A-G
      const afterDigits = pos + negMatch[0].length;
      if (afterDigits < trimmed.length && /[A-G]/.test(trimmed[afterDigits]!)) {
        inversion = parseInt(negMatch[0], 10);
        pos = afterDigits;
      }
    }
  }

  // Parse root: letter + optional accidental
  if (pos >= trimmed.length || !/[A-G]/.test(trimmed[pos]!)) {
    return { ok: false, error: `Expected root note (A-G), got '${trimmed[pos] ?? 'end of input'}'` };
  }
  const letter = trimmed[pos]!;
  pos++;

  let accidental: string | null = null;
  if (pos < trimmed.length && (trimmed[pos] === '#' || trimmed[pos] === 'b')) {
    accidental = trimmed[pos]!;
    pos++;
  }

  const root = resolveRoot(letter, accidental);
  if (root === null) {
    return { ok: false, error: `Invalid note: ${letter}${accidental ?? ''}` };
  }

  // Parse quality from remaining string
  const rest = trimmed.slice(pos);
  const quality = parseQuality(rest);
  if (quality === null) {
    return { ok: false, error: `Unknown quality: '${rest}'` };
  }

  return { ok: true, value: { root, quality, inversion } };
}

export function parseChordSequence(input: string): ParseResult<ChordSymbol>[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];
  const tokens = trimmed.split(/\s+/);
  return tokens.map(parseChord);
}

function resolveRoot(letter: string, accidental: string | null): PitchClass | null {
  const key = letter + (accidental ?? '');
  const MAP: Record<string, PitchClass> = {
    'C': 'C', 'C#': 'Cs',
    'D': 'D', 'Db': 'Cs', 'D#': 'Ds',
    'E': 'E', 'Eb': 'Ds',
    'F': 'F',
    'G': 'G', 'F#': 'Fs', 'Gb': 'Fs', 'G#': 'Gs',
    'A': 'A', 'Ab': 'Gs', 'A#': 'As',
    'B': 'B', 'Bb': 'As',
  };
  return MAP[key] ?? null;
}

// Quality parser — order matters! Try longest/most specific first.
// Matches the Haskell parser's `try` ordering exactly.
function parseQuality(s: string): ChordType | null {
  const QUALITIES: [string, ChordType][] = [
    ['mMaj7', 'MinMaj7'],
    ['maj7', 'Maj7'],
    ['maj', 'Major'],
    ['dim7b5', 'HalfDim7'],
    ['dim7', 'Dim7'],
    ['dim', 'Dim'],
    ['m7b5', 'HalfDim7'],
    ['m7', 'Min7'],
    ['m6', 'Min6'],
    ['min', 'Minor'],
    ['m', 'Minor'],
    ['aug', 'Aug'],
    ['+', 'Aug'],
    ['sus4', 'Sus4'],
    ['sus2', 'Sus2'],
    ['9', 'Dom9'],
    ['7', 'Dom7'],
    ['6', 'Maj6'],
  ];
  for (const [suffix, quality] of QUALITIES) {
    if (s === suffix) return quality;
  }
  if (s === '') return 'Major';
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/parser.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/parser.ts web/src/engine/parser.test.ts
git commit -m "feat(web): port chord parser with tests

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Port Smooth Voice Leading

**Files:**
- Create: `web/src/engine/voiceLeading.ts`
- Create: `web/src/engine/voiceLeading.test.ts`

Port from `src/ChordPlay/MusicTheory.hs` lines 134-173 (smoothVoice + voiceChordSequence).

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { smoothVoice, voiceChordSequence } from './voiceLeading';
import { pitchToMidi, voiceChord } from './musicTheory';
import type { Pitch, ChordSymbol } from '../types';

describe('smoothVoice', () => {
  it('minimizes total movement (SmoothEqual)', () => {
    // Starting from C Major root position: C3 E3 G3 C4
    const prev = voiceChord('C', 'Major', 0);
    // Moving to F Major — should place notes close to previous
    const result = smoothVoice('equal', prev, ['F', 'A', 'C', 'F']);
    const midis = result.map(pitchToMidi);
    // All notes should stay within a reasonable range of the previous chord
    const prevMidis = prev.map(pitchToMidi);
    const maxMovement = Math.max(...midis.map((m, i) => Math.abs(m - prevMidis[i]!)));
    expect(maxMovement).toBeLessThanOrEqual(7); // no voice jumps more than a 5th
  });

  it('penalizes semitone clusters', () => {
    // The algorithm should avoid placing two notes 1 semitone apart
    const prev: Pitch[] = [
      { pitchClass: 'C', octave: 3 },
      { pitchClass: 'E', octave: 3 },
      { pitchClass: 'G', octave: 3 },
      { pitchClass: 'C', octave: 4 },
    ];
    const result = smoothVoice('equal', prev, ['C', 'E', 'G', 'C']);
    const midis = result.map(pitchToMidi).sort((a, b) => a - b);
    const gaps = midis.slice(1).map((m, i) => m - midis[i]!);
    // No gaps of exactly 1 semitone
    expect(gaps.every(g => g !== 1)).toBe(true);
  });
});

describe('voiceChordSequence', () => {
  it('returns empty for empty input', () => {
    expect(voiceChordSequence(null, [])).toEqual([]);
  });

  it('without smooth mode, uses explicit inversions', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null },
      { root: 'G', quality: 'Major', inversion: null },
    ];
    const result = voiceChordSequence(null, chords);
    expect(result).toHaveLength(2);
    result.forEach(voicing => expect(voicing).toHaveLength(4));
  });

  it('with smooth mode, voices stay close', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null },
      { root: 'F', quality: 'Major', inversion: null },
      { root: 'G', quality: 'Dom7', inversion: null },
      { root: 'C', quality: 'Major', inversion: null },
    ];
    const result = voiceChordSequence('equal', chords);
    expect(result).toHaveLength(4);
    // Check adjacent chords have smooth transitions
    for (let i = 1; i < result.length; i++) {
      const prevMidis = result[i - 1]!.map(pitchToMidi).sort((a, b) => a - b);
      const currMidis = result[i]!.map(pitchToMidi).sort((a, b) => a - b);
      const totalMovement = prevMidis.reduce((sum, m, j) => sum + Math.abs(m - currMidis[j]!), 0);
      expect(totalMovement).toBeLessThan(24); // less than 2 octaves total movement
    }
  });

  it('explicit inversion overrides smooth', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null },
      { root: 'G', quality: 'Major', inversion: 2 },  // forced 2nd inversion
    ];
    const result = voiceChordSequence('equal', chords);
    const forced = voiceChord('G', 'Major', 2);
    expect(result[1]).toEqual(forced);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts`
Expected: FAIL

- [ ] **Step 3: Write `voiceLeading.ts` implementation**

```typescript
import type { Pitch, PitchClass, ChordSymbol, SmoothMode } from '../types';
import { pitchToMidi, nearestPitch, voiceChord, chordPitchClasses } from './musicTheory';

// Generate all permutations of an array
function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i]!, ...perm]);
    }
  }
  return result;
}

export function smoothVoice(mode: SmoothMode, prevPitches: Pitch[], nextPCs: PitchClass[]): Pitch[] {
  const sorted = [...prevPitches].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
  const prevMidis = sorted.map(pitchToMidi);
  const weights = mode === 'bass' ? [2, 1, 1, 1] : [1, 1, 1, 1];

  const perms = permutations(nextPCs);

  let bestCost = Infinity;
  let bestMax = Infinity;
  let bestPlaced: Pitch[] = sorted;

  for (const perm of perms) {
    const placed = perm.map((pc, i) => nearestPitch(pc, prevMidis[i]!));
    const placedMidis = placed.map(pitchToMidi);
    const movements = prevMidis.map((pm, i) => Math.abs(pm - placedMidis[i]!));
    const totalCost = movements.reduce((sum, m, i) => sum + m * weights[i]!, 0);
    const maxMove = Math.max(...movements);

    // Cluster penalty: penalize adjacent notes 1 semitone apart
    const sortedMidis = [...placedMidis].sort((a, b) => a - b);
    const gaps = sortedMidis.slice(1).map((m, i) => m - sortedMidis[i]!);
    const clusterPenalty = 12 * gaps.filter(g => g === 1).length;

    const cost = totalCost + clusterPenalty;

    if (cost < bestCost || (cost === bestCost && maxMove < bestMax)) {
      bestCost = cost;
      bestMax = maxMove;
      bestPlaced = placed;
    }
  }

  return bestPlaced;
}

export function voiceChordSequence(mode: SmoothMode | null, chords: ChordSymbol[]): Pitch[][] {
  if (chords.length === 0) return [];

  if (mode === null) {
    return chords.map(c => voiceChord(c.root, c.quality, c.inversion ?? 0));
  }

  const first = chords[0]!;
  const firstVoicing = voiceChord(first.root, first.quality, first.inversion ?? 0);
  const result: Pitch[][] = [firstVoicing];

  let prev = firstVoicing;
  for (let i = 1; i < chords.length; i++) {
    const chord = chords[i]!;
    let voicing: Pitch[];
    if (chord.inversion !== null) {
      voicing = voiceChord(chord.root, chord.quality, chord.inversion);
    } else {
      voicing = smoothVoice(mode, prev, chordPitchClasses(chord.root, chord.quality));
    }
    result.push(voicing);
    prev = voicing;
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/voiceLeading.ts web/src/engine/voiceLeading.test.ts
git commit -m "feat(web): port smooth voice leading algorithm with tests

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Build Web Audio Synthesis Engine

**Files:**
- Create: `web/src/engine/audio.ts`
- Create: `web/src/engine/audio.test.ts`

Port the synthesis math from `src/ChordPlay/Audio.hs`. Uses Web Audio API `OscillatorNode` + `GainNode` instead of PCM generation.

- [ ] **Step 1: Write failing tests**

Test the pure math functions (envelope, waveform generation). We can't test actual audio playback in Node/Vitest, but we can test the computational parts.

```typescript
import { describe, it, expect } from 'vitest';
import { envelope, HARMONICS, SAMPLE_RATE } from './audio';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/audio.test.ts`
Expected: FAIL

- [ ] **Step 3: Write `audio.ts` implementation**

```typescript
import type { Pitch, PitchClass, Tuning, PlayStyle } from '../types';
import { justFrequencies, equalFrequencies } from './musicTheory';

export const SAMPLE_RATE = 44100;

// ADSR envelope parameters (seconds)
const ATTACK = 0.020;
const DECAY = 0.100;
const RELEASE = 0.200;
const SUSTAIN = 0.70;

// Barbershop-tuned harmonic amplitudes [harmonic number, amplitude]
// H7 boosted to reinforce septimal 7th (7/4) in V7 chords
export const HARMONICS: readonly [number, number][] = [
  [1, 1.0], [2, 0.7], [3, 0.55], [4, 0.35],
  [5, 0.25], [6, 0.12], [7, 0.18], [8, 0.06],
];

export function envelope(duration: number, t: number): number {
  if (t < 0) return 0;
  if (t < ATTACK) return t / ATTACK;
  if (t < ATTACK + DECAY) {
    const decayProgress = (t - ATTACK) / DECAY;
    return 1.0 - (1.0 - SUSTAIN) * decayProgress;
  }
  if (t < duration - RELEASE) return SUSTAIN;
  if (t < duration) {
    const releaseProgress = (t - (duration - RELEASE)) / RELEASE;
    return SUSTAIN * (1.0 - releaseProgress);
  }
  return 0.0;
}

// Manages Web Audio playback for a set of chord voicings
export class ChordPlayer {
  private ctx: AudioContext | null = null;
  private activeNodes: { oscillators: OscillatorNode[]; gains: GainNode[] } | null = null;
  private playbackTimer: number | null = null;
  private playbackResolve: (() => void) | null = null;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    return this.ctx;
  }

  // Play a single chord. Returns a promise that resolves when the chord finishes.
  async playChord(
    root: PitchClass,
    pitches: Pitch[],
    duration: number,
    tuning: Tuning,
    style: PlayStyle,
  ): Promise<void> {
    this.stopCurrent();
    const ctx = this.getContext();
    if (ctx.state === 'suspended') await ctx.resume();

    const freqs = tuning === 'just'
      ? justFrequencies(root, pitches)
      : equalFrequencies(pitches);

    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.3 / freqs.length; // prevent clipping
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;
    const arpDelay = style === 'arpeggio' ? 0.080 : 0;

    freqs.forEach((baseFreq, voiceIdx) => {
      const voiceOffset = voiceIdx * arpDelay;

      for (const [harmonic, amplitude] of HARMONICS) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = baseFreq * harmonic;

        const gain = ctx.createGain();
        gain.gain.value = 0;

        // Schedule ADSR envelope
        const start = now + voiceOffset;
        const attackEnd = start + ATTACK;
        const decayEnd = attackEnd + DECAY;
        const releaseStart = start + duration - RELEASE;
        const end = start + duration;

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(amplitude, attackEnd);
        gain.gain.linearRampToValueAtTime(amplitude * SUSTAIN, decayEnd);
        gain.gain.setValueAtTime(amplitude * SUSTAIN, releaseStart);
        gain.gain.linearRampToValueAtTime(0, end);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(start);
        osc.stop(end + 0.01);

        oscillators.push(osc);
        gains.push(gain);
      }
    });

    this.activeNodes = { oscillators, gains };

    const totalDuration = duration + (freqs.length - 1) * arpDelay;
    return new Promise(resolve => {
      this.playbackResolve = resolve;
      this.playbackTimer = window.setTimeout(() => {
        this.activeNodes = null;
        this.playbackTimer = null;
        this.playbackResolve = null;
        resolve();
      }, totalDuration * 1000);
    });
  }

  // Play a sequence of chords with a callback after each one
  async playSequence(
    chords: { root: PitchClass; pitches: Pitch[] }[],
    duration: number,
    tuning: Tuning,
    style: PlayStyle,
    onChordStart?: (index: number) => void,
  ): Promise<void> {
    for (let i = 0; i < chords.length; i++) {
      const chord = chords[i]!;
      onChordStart?.(i);
      await this.playChord(chord.root, chord.pitches, duration, tuning, style);
      // Brief silence between chords
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  stopCurrent(): void {
    if (this.playbackTimer !== null) {
      window.clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    // Resolve the pending promise so playSequence can continue/exit
    if (this.playbackResolve) {
      this.playbackResolve();
      this.playbackResolve = null;
    }
    if (this.activeNodes) {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      for (const gain of this.activeNodes.gains) {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.02);
        } catch { /* node may already be disconnected */ }
      }
      for (const osc of this.activeNodes.oscillators) {
        try { osc.stop(now + 0.03); } catch { /* already stopped */ }
      }
      this.activeNodes = null;
    }
  }

  destroy(): void {
    this.stopCurrent();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/audio.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/audio.ts web/src/engine/audio.test.ts
git commit -m "feat(web): build Web Audio synthesis engine with tests

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Build UI Components + App Shell + Dark Theme

**Files:**
- Create: `web/src/components/Toolbar.tsx`
- Create: `web/src/components/ChordInput.tsx`
- Create: `web/src/components/PlaybackControls.tsx`
- Create: `web/src/components/NoteCards.tsx`
- Create: `web/src/components/TuningComparison.tsx`
- Create: `web/src/components/SyntaxReference.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles/index.css`

This task builds all 6 React components, the App shell, and the dark theme CSS. They're grouped because the components are small, tightly coupled through props, and need to be wired together to test visually.

- [ ] **Step 1: Create `web/src/components/Toolbar.tsx`**

```tsx
import type { VoiceLeading, PlayStyle, Tuning } from '../types';

interface ToolbarProps {
  voiceLeading: VoiceLeading;
  playStyle: PlayStyle;
  tuning: Tuning;
  onVoiceLeadingChange: (v: VoiceLeading) => void;
  onPlayStyleChange: (s: PlayStyle) => void;
  onTuningChange: (t: Tuning) => void;
  onToggleSyntaxHelp: () => void;
}

function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="toggle-group">
      <span className="toggle-label">{label}</span>
      {options.map(opt => (
        <button
          key={opt.value}
          className={`toggle-btn ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function Toolbar({
  voiceLeading, playStyle, tuning,
  onVoiceLeadingChange, onPlayStyleChange, onTuningChange, onToggleSyntaxHelp,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <ToggleGroup
          label="Voice Leading"
          options={[
            { value: 'off' as VoiceLeading, label: 'Off' },
            { value: 'smooth' as VoiceLeading, label: 'Smooth' },
            { value: 'bass' as VoiceLeading, label: 'Bass-weighted' },
          ]}
          value={voiceLeading}
          onChange={onVoiceLeadingChange}
        />
        <span className="toolbar-divider">│</span>
        <ToggleGroup
          label="Style"
          options={[
            { value: 'block' as PlayStyle, label: 'Block' },
            { value: 'arpeggio' as PlayStyle, label: 'Arpeggio' },
          ]}
          value={playStyle}
          onChange={onPlayStyleChange}
        />
        <span className="toolbar-divider">│</span>
        <ToggleGroup
          label="Tuning"
          options={[
            { value: 'just' as Tuning, label: 'Just' },
            { value: 'equal' as Tuning, label: 'Equal' },
          ]}
          value={tuning}
          onChange={onTuningChange}
        />
      </div>
      <button className="syntax-help-btn" onClick={onToggleSyntaxHelp}>
        📖 Syntax Help
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `web/src/components/ChordInput.tsx`**

```tsx
import { useMemo } from 'react';
import { parseChordSequence } from '../engine/parser';

interface ChordInputProps {
  value: string;
  onChange: (v: string) => void;
  currentChordIndex: number | null;
  isPlaying: boolean;
}

export default function ChordInput({ value, onChange, currentChordIndex, isPlaying }: ChordInputProps) {
  const tokens = useMemo(() => {
    if (!value.trim()) return [];
    const parts = value.trim().split(/(\s+)/);
    const results = parseChordSequence(value);
    let chordIdx = 0;
    return parts.map(part => {
      if (/^\s+$/.test(part)) {
        return { text: part, isSpace: true, isValid: true, chordIndex: -1 };
      }
      const result = results[chordIdx];
      const idx = chordIdx;
      chordIdx++;
      return {
        text: part,
        isSpace: false,
        isValid: result?.ok ?? false,
        chordIndex: idx,
      };
    });
  }, [value]);

  return (
    <div className="chord-input-container">
      <div className="chord-input-display" aria-hidden="true">
        {tokens.map((token, i) => {
          if (token.isSpace) return <span key={i}>{token.text}</span>;
          const isActive = isPlaying && token.chordIndex === currentChordIndex;
          const className = [
            'chord-token',
            !token.isValid ? 'chord-invalid' : '',
            isActive ? 'chord-active' : '',
          ].filter(Boolean).join(' ');
          return <span key={i} className={className}>{token.text}</span>;
        })}
      </div>
      <textarea
        className="chord-input-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Enter chords: C Am7 F G7 ..."
        spellCheck={false}
        rows={2}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create `web/src/components/PlaybackControls.tsx`**

```tsx
interface PlaybackControlsProps {
  isPlaying: boolean;
  tempo: number;
  currentChordIndex: number;
  totalChords: number;
  onPlay: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onTempoChange: (t: number) => void;
}

export default function PlaybackControls({
  isPlaying, tempo, currentChordIndex, totalChords,
  onPlay, onStop, onPrev, onNext, onTempoChange,
}: PlaybackControlsProps) {
  return (
    <div className="playback-controls">
      <div className="playback-buttons">
        <button className={`play-btn ${isPlaying ? 'playing' : ''}`} onClick={isPlaying ? onStop : onPlay}>
          {isPlaying ? '⏹ Stop' : '▶ Play'}
        </button>
        <button className="control-btn" onClick={onPrev} disabled={isPlaying}>⏮</button>
        <button className="control-btn" onClick={onNext} disabled={isPlaying}>⏭</button>
      </div>
      <span className="playback-divider">│</span>
      <div className="tempo-control">
        <span className="tempo-label">TEMPO</span>
        <input
          type="range"
          className="tempo-slider"
          min={0.3}
          max={3.0}
          step={0.1}
          value={tempo}
          onChange={e => onTempoChange(parseFloat(e.target.value))}
        />
        <span className="tempo-value">{tempo.toFixed(1)}s</span>
      </div>
      {totalChords > 0 && (
        <span className="chord-counter">
          Chord {currentChordIndex + 1} of {totalChords}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `web/src/components/NoteCards.tsx`**

```tsx
import type { Pitch, PitchClass } from '../types';
import { pitchToMidi, justFrequencies, equalFrequencies } from '../engine/musicTheory';
import { VOICE_PARTS, type Tuning } from '../types';

interface NoteCardsProps {
  root: PitchClass | null;
  pitches: Pitch[];
  tuning: Tuning;
}

const INTERVAL_NAMES: Record<number, { name: string; ratio: string }> = {
  0:  { name: 'Root', ratio: '1/1' },
  1:  { name: 'min 2nd', ratio: '16/15' },
  2:  { name: 'Maj 2nd', ratio: '9/8' },
  3:  { name: 'min 3rd', ratio: '6/5' },
  4:  { name: 'Maj 3rd', ratio: '5/4' },
  5:  { name: 'P4th', ratio: '4/3' },
  6:  { name: 'Tritone', ratio: '7/5' },
  7:  { name: 'P5th', ratio: '3/2' },
  8:  { name: 'min 6th', ratio: '8/5' },
  9:  { name: 'Maj 6th', ratio: '5/3' },
  10: { name: '♭7th', ratio: '7/4' },
  11: { name: 'Maj 7th', ratio: '15/8' },
};

const VOICE_COLORS = ['#2a9d8f', '#7a5fca', '#4a6fa5', '#e07a5f'];

const DISPLAY_NAMES: Record<string, string> = {
  C: 'C', Cs: 'C♯', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'F♯', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};

function formatPitch(p: Pitch): string {
  return `${DISPLAY_NAMES[p.pitchClass] ?? p.pitchClass}${p.octave}`;
}

export default function NoteCards({ root, pitches, tuning }: NoteCardsProps) {
  if (!root || pitches.length === 0) {
    return (
      <div className="note-cards empty">
        <p>Enter chords and press Play to see voicing details</p>
      </div>
    );
  }

  const freqs = tuning === 'just'
    ? justFrequencies(root, pitches)
    : equalFrequencies(pitches);

  const rootInt = pitchToMidi({ pitchClass: root, octave: 0 });

  return (
    <div className="note-cards">
      {pitches.map((pitch, i) => {
        const semitones = ((pitchToMidi(pitch) - rootInt) % 12 + 12) % 12;
        const interval = INTERVAL_NAMES[semitones] ?? { name: '?', ratio: '?' };
        const color = VOICE_COLORS[i % VOICE_COLORS.length]!;
        const part = VOICE_PARTS[i] ?? `Voice ${i + 1}`;

        return (
          <div key={i} className="note-card" style={{ borderColor: color }}>
            <div className="note-name" style={{ color }}>{formatPitch(pitch)}</div>
            <div className="voice-part">{part}</div>
            <div className="note-freq">{freqs[i]!.toFixed(1)} Hz</div>
            <div className="note-interval">{interval.name} · {interval.ratio}</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Create `web/src/components/TuningComparison.tsx`**

```tsx
import type { Pitch, PitchClass } from '../types';
import { justFrequencies, equalFrequencies } from '../engine/musicTheory';

interface TuningComparisonProps {
  root: PitchClass | null;
  pitches: Pitch[];
  chordName: string;
}

const DISPLAY_NAMES: Record<string, string> = {
  C: 'C', Cs: 'C♯', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'F♯', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};

function formatPitch(p: Pitch): string {
  return `${DISPLAY_NAMES[p.pitchClass] ?? p.pitchClass}${p.octave}`;
}

function centsDifference(justFreq: number, equalFreq: number): number {
  return 1200 * Math.log2(equalFreq / justFreq);
}

export default function TuningComparison({ root, pitches, chordName }: TuningComparisonProps) {
  if (!root || pitches.length === 0) return null;

  const justFreqs = justFrequencies(root, pitches);
  const equalFreqs = equalFrequencies(pitches);

  return (
    <div className="tuning-comparison">
      <div className="tuning-header">Tuning Comparison — {chordName}</div>
      <div className="tuning-columns">
        <div className="tuning-col">
          <span className="tuning-col-label just">JUST INTONATION</span>
          {pitches.map((p, i) => (
            <div key={i} className="tuning-row">
              {formatPitch(p)}: {justFreqs[i]!.toFixed(2)} Hz
            </div>
          ))}
        </div>
        <div className="tuning-col">
          <span className="tuning-col-label equal">EQUAL TEMPERAMENT</span>
          {pitches.map((p, i) => {
            const cents = centsDifference(justFreqs[i]!, equalFreqs[i]!);
            const centsStr = Math.abs(cents) < 0.1
              ? ''
              : ` (${cents > 0 ? '+' : ''}${cents.toFixed(1)}¢)`;
            return (
              <div key={i} className="tuning-row">
                {formatPitch(p)}: {equalFreqs[i]!.toFixed(2)} Hz
                {centsStr && <span className="cents">{centsStr}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `web/src/components/SyntaxReference.tsx`**

```tsx
interface SyntaxReferenceProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SyntaxReference({ isOpen, onClose }: SyntaxReferenceProps) {
  return (
    <div className={`syntax-reference ${isOpen ? 'open' : ''}`}>
      <div className="syntax-reference-content">
        <div className="syntax-header">
          <h3>Syntax Reference</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <section>
          <h4 className="ref-section-title">Chord Format</h4>
          <div className="format-example">
            <span className="fmt-inversion">[inversion]</span>
            <span className="fmt-root">root</span>
            <span className="fmt-quality">quality</span>
          </div>
          <p className="ref-example">Example: <code>2Bbm7</code> → B♭ minor 7, 2nd inversion</p>
        </section>

        <section>
          <h4 className="ref-section-title root-color">Roots</h4>
          <div className="root-chips">
            {['C','C♯/D♭','D','D♯/E♭','E','F','F♯/G♭','G','G♯/A♭','A','A♯/B♭','B'].map(r => (
              <span key={r} className="chip">{r}</span>
            ))}
          </div>
        </section>

        <section>
          <h4 className="ref-section-title quality-color">Qualities</h4>
          <div className="quality-grid">
            {[
              ['(blank)', 'Major'],
              ['m', 'Minor'],
              ['7', 'Dominant 7'],
              ['maj7', 'Major 7'],
              ['m7', 'Minor 7'],
              ['dim', 'Diminished'],
              ['dim7', 'Dim 7'],
              ['aug / +', 'Augmented'],
              ['m7b5', 'Half-Dim 7'],
              ['sus4', 'Suspended 4'],
              ['sus2', 'Suspended 2'],
              ['mMaj7', 'Minor-Major 7'],
              ['6', 'Major 6'],
              ['m6', 'Minor 6'],
              ['9', 'Dom 9 (rootless)'],
            ].map(([sym, name]) => (
              <div key={sym} className="quality-item">
                <code>{sym}</code> <span>{name}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h4 className="ref-section-title inversion-color">Inversions (optional prefix)</h4>
          <div className="inversion-info">
            <div><code>0</code> Root position</div>
            <div><code>1</code> 1st inv ↑ · <code>2</code> 2nd inv ↑ · <code>3</code> 3rd inv ↑</div>
            <div><code>-1</code> 1st inv ↓ · <code>-2</code> 2nd inv ↓ · <code>-3</code> 3rd inv ↓</div>
            <p className="ref-note">Omit for auto-voicing (used with smooth mode)</p>
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Wire up `web/src/App.tsx`**

```tsx
import { useState, useCallback, useRef, useMemo } from 'react';
import type { VoiceLeading, PlayStyle, Tuning, ChordSymbol } from './types';
import { parseChordSequence } from './engine/parser';
import { voiceChordSequence } from './engine/voiceLeading';
import { ChordPlayer } from './engine/audio';
import Toolbar from './components/Toolbar';
import ChordInput from './components/ChordInput';
import PlaybackControls from './components/PlaybackControls';
import NoteCards from './components/NoteCards';
import TuningComparison from './components/TuningComparison';
import SyntaxReference from './components/SyntaxReference';

const DISPLAY_NAMES: Record<string, string> = {
  C: 'C', Cs: 'C♯', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'F♯', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};
const QUALITY_DISPLAY: Record<string, string> = {
  Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
  Dim: 'dim', Dim7: 'dim7', Aug: 'aug', HalfDim7: 'm7b5',
  Sus4: 'sus4', Sus2: 'sus2', MinMaj7: 'mMaj7', Maj6: '6', Min6: 'm6', Dom9: '9',
};

function chordDisplayName(cs: ChordSymbol): string {
  return `${DISPLAY_NAMES[cs.root] ?? cs.root}${QUALITY_DISPLAY[cs.quality] ?? ''}`;
}

export default function App() {
  const [chordText, setChordText] = useState('D A7 A9 D D7 Ab7 G6 Gm6 D F#7');
  const [voiceLeading, setVoiceLeading] = useState<VoiceLeading>('off');
  const [playStyle, setPlayStyle] = useState<PlayStyle>('block');
  const [tuning, setTuning] = useState<Tuning>('just');
  const [tempo, setTempo] = useState(1.2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  const [syntaxHelpOpen, setSyntaxHelpOpen] = useState(false);
  const playerRef = useRef<ChordPlayer | null>(null);
  const playingRef = useRef(false);

  const parsedChords = useMemo(() => {
    const results = parseChordSequence(chordText);
    return results
      .filter((r): r is { ok: true; value: ChordSymbol } => r.ok)
      .map(r => r.value);
  }, [chordText]);

  const smoothMode = voiceLeading === 'smooth' ? 'equal' as const
    : voiceLeading === 'bass' ? 'bass' as const
    : null;

  const voicings = useMemo(
    () => voiceChordSequence(smoothMode, parsedChords),
    [smoothMode, parsedChords],
  );

  const currentPitches = voicings[currentChordIndex] ?? [];
  const currentRoot = parsedChords[currentChordIndex]?.root ?? null;
  const currentChordName = parsedChords[currentChordIndex]
    ? chordDisplayName(parsedChords[currentChordIndex]!)
    : '';

  const handlePlay = useCallback(async () => {
    if (parsedChords.length === 0) return;
    if (!playerRef.current) playerRef.current = new ChordPlayer();

    setIsPlaying(true);
    playingRef.current = true;

    const chords = parsedChords.map((cs, i) => ({
      root: cs.root,
      pitches: voicings[i]!,
    }));

    try {
      await playerRef.current.playSequence(chords, tempo, tuning, playStyle, (idx) => {
        if (playingRef.current) setCurrentChordIndex(idx);
      });
    } finally {
      playingRef.current = false;
      setIsPlaying(false);
    }
  }, [parsedChords, voicings, tempo, tuning, playStyle]);

  const handleStop = useCallback(() => {
    playingRef.current = false;
    playerRef.current?.stopCurrent();
    setIsPlaying(false);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentChordIndex(i => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentChordIndex(i => Math.min(parsedChords.length - 1, i + 1));
  }, [parsedChords.length]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>♩ ChordPlay Web</h1>
        <span className="app-subtitle">Barbershop Harmony Explorer</span>
      </header>

      <Toolbar
        voiceLeading={voiceLeading}
        playStyle={playStyle}
        tuning={tuning}
        onVoiceLeadingChange={setVoiceLeading}
        onPlayStyleChange={setPlayStyle}
        onTuningChange={setTuning}
        onToggleSyntaxHelp={() => setSyntaxHelpOpen(o => !o)}
      />

      <ChordInput
        value={chordText}
        onChange={setChordText}
        currentChordIndex={currentChordIndex}
        isPlaying={isPlaying}
      />

      <PlaybackControls
        isPlaying={isPlaying}
        tempo={tempo}
        currentChordIndex={currentChordIndex}
        totalChords={parsedChords.length}
        onPlay={handlePlay}
        onStop={handleStop}
        onPrev={handlePrev}
        onNext={handleNext}
        onTempoChange={setTempo}
      />

      <NoteCards root={currentRoot} pitches={currentPitches} tuning={tuning} />

      <TuningComparison root={currentRoot} pitches={currentPitches} chordName={currentChordName} />

      <SyntaxReference isOpen={syntaxHelpOpen} onClose={() => setSyntaxHelpOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 8: Write the full dark theme CSS (`web/src/styles/index.css`)**

Write the complete CSS targeting all component classes: `.app`, `.app-header`, `.toolbar`, `.toggle-group`, `.toggle-btn`, `.chord-input-container`, `.chord-token`, `.chord-active`, `.chord-invalid`, `.playback-controls`, `.play-btn`, `.tempo-slider`, `.note-cards`, `.note-card`, `.tuning-comparison`, `.syntax-reference`, etc. Use the design mockup colors: background `#12121e`, surfaces `#1e1e30` / `#2a2a3e`, accents teal `#2a9d8f`, blue `#4a6fa5`, purple `#7a5fca`, coral `#e07a5f`.

The full CSS should cover:
- Dark background with layered surface colors
- Toolbar layout (flex, wrap, gap)
- Toggle buttons (inactive: `#2a2a3e`, active: `#4a6fa5` with glow)
- Chord input overlay technique (textarea + display layer)
- Active chord highlighting with accent background + box-shadow
- Invalid chord red border/color
- Note cards as flex row, border colored by voice
- Tuning comparison two-column layout
- Syntax reference slide-out panel (transform + transition)
- Responsive: flex-wrap on narrow screens
- Monospace font for code/chords

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #12121e;
  color: #e0e0e0;
}

#root {
  min-height: 100vh;
}

/* App shell */
.app {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 16px;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 16px 0;
  border-bottom: 1px solid #262638;
}

.app-header h1 {
  font-size: 20px;
  font-weight: 600;
  color: #e0e0e0;
}

.app-subtitle {
  font-size: 13px;
  color: #666;
}

/* Toolbar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid #262638;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-divider {
  color: #333;
  margin: 0 4px;
  user-select: none;
}

.toggle-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toggle-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #666;
  margin-right: 2px;
}

.toggle-btn {
  background: #2a2a3e;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  color: #888;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toggle-btn:hover {
  border-color: #4a6fa5;
  color: #aaf;
}

.toggle-btn.active {
  background: #4a6fa5;
  border-color: #4a6fa5;
  color: white;
  box-shadow: 0 0 8px rgba(74, 111, 165, 0.3);
}

.syntax-help-btn {
  background: #2a2a3e;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  color: #aaf;
  cursor: pointer;
  transition: all 0.15s ease;
}

.syntax-help-btn:hover {
  border-color: #4a6fa5;
}

/* Chord Input */
.chord-input-container {
  position: relative;
  margin: 16px 0;
}

.chord-input-display {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 14px 16px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 15px;
  line-height: 1.8;
  color: #e0e0e0;
  pointer-events: none;
  white-space: pre-wrap;
  word-wrap: break-word;
  border: 1px solid transparent;
  border-radius: 8px;
}

.chord-input-textarea {
  width: 100%;
  padding: 14px 16px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 15px;
  line-height: 1.8;
  color: transparent;
  caret-color: #e0e0e0;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 8px;
  resize: vertical;
  outline: none;
  min-height: 60px;
}

.chord-input-textarea:focus {
  border-color: #4a6fa5;
}

.chord-input-textarea::placeholder {
  color: #555;
}

.chord-token {
  transition: all 0.15s ease;
}

.chord-invalid {
  color: #e05f5f;
  text-decoration: wavy underline #e05f5f;
}

.chord-active {
  background: #4a6fa5;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  box-shadow: 0 0 10px rgba(74, 111, 165, 0.4);
}

/* Playback Controls */
.playback-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 0 0 16px;
}

.playback-buttons {
  display: flex;
  gap: 6px;
}

.play-btn {
  background: #4a6fa5;
  border: none;
  border-radius: 6px;
  padding: 6px 18px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;
}

.play-btn:hover {
  background: #5a7fb5;
}

.play-btn.playing {
  background: #e05f5f;
}

.play-btn.playing:hover {
  background: #f06f6f;
}

.control-btn {
  background: #2a2a3e;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 13px;
  color: #888;
  cursor: pointer;
  transition: all 0.15s ease;
}

.control-btn:hover:not(:disabled) {
  border-color: #4a6fa5;
  color: #aaf;
}

.control-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.playback-divider {
  color: #333;
  font-size: 16px;
  user-select: none;
}

.tempo-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tempo-label {
  font-size: 11px;
  color: #666;
}

.tempo-slider {
  width: 120px;
  accent-color: #4a6fa5;
}

.tempo-value {
  font-family: monospace;
  font-size: 12px;
  color: #aaa;
  min-width: 40px;
}

.chord-counter {
  font-size: 11px;
  color: #555;
  margin-left: auto;
}

/* Note Cards */
.note-cards {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  padding: 16px 0;
  border-top: 1px solid #262638;
}

.note-cards.empty {
  justify-content: center;
}

.note-cards.empty p {
  color: #555;
  font-size: 13px;
}

.note-card {
  background: #1e1e30;
  border: 1px solid;
  border-radius: 10px;
  padding: 14px 18px;
  text-align: center;
  min-width: 90px;
  transition: all 0.2s ease;
}

.note-name {
  font-size: 22px;
  font-weight: bold;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.voice-part {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #555;
  margin-top: 2px;
}

.note-freq {
  font-size: 12px;
  font-family: monospace;
  color: #aaa;
  margin-top: 8px;
}

.note-interval {
  font-size: 10px;
  color: #555;
  margin-top: 3px;
}

/* Tuning Comparison */
.tuning-comparison {
  background: #1a1a2e;
  border: 1px solid #262638;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.tuning-header {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #666;
  margin-bottom: 8px;
}

.tuning-columns {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.tuning-col {
  flex: 1;
  min-width: 200px;
}

.tuning-col-label {
  font-size: 11px;
  font-weight: bold;
  display: block;
  margin-bottom: 4px;
}

.tuning-col-label.just {
  color: #2a9d8f;
}

.tuning-col-label.equal {
  color: #e07a5f;
}

.tuning-row {
  font-family: monospace;
  font-size: 11px;
  color: #aaa;
  line-height: 1.6;
}

.cents {
  color: #e07a5f;
}

/* Syntax Reference Panel */
.syntax-reference {
  position: fixed;
  top: 0;
  right: 0;
  width: 340px;
  height: 100vh;
  background: #1a1a2e;
  border-left: 1px solid #333;
  transform: translateX(100%);
  transition: transform 0.25s ease;
  z-index: 100;
  overflow-y: auto;
}

.syntax-reference.open {
  transform: translateX(0);
}

.syntax-reference-content {
  padding: 20px;
}

.syntax-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.syntax-header h3 {
  font-size: 16px;
  color: #aaf;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
}

.close-btn:hover {
  color: #e0e0e0;
}

.ref-section-title {
  font-size: 13px;
  font-weight: bold;
  color: #4a6fa5;
  margin-bottom: 6px;
}

.ref-section-title.root-color {
  color: #2a9d8f;
}

.ref-section-title.quality-color {
  color: #7a5fca;
}

.ref-section-title.inversion-color {
  color: #e07a5f;
}

.syntax-reference section {
  margin-bottom: 16px;
}

.format-example {
  font-family: monospace;
  background: #12121e;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #262638;
  font-size: 14px;
}

.fmt-inversion { color: #e07a5f; }
.fmt-root { color: #2a9d8f; }
.fmt-quality { color: #7a5fca; }

.ref-example {
  font-size: 12px;
  color: #888;
  margin-top: 6px;
}

.ref-example code {
  color: #e0e0e0;
  font-family: monospace;
}

.root-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chip {
  background: #2a2a3e;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #aaa;
}

.quality-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.quality-item {
  font-size: 11px;
  color: #aaa;
}

.quality-item code {
  color: #e0e0e0;
  font-family: monospace;
}

.inversion-info {
  font-size: 11px;
  color: #aaa;
  line-height: 1.8;
}

.inversion-info code {
  color: #e0e0e0;
  font-family: monospace;
}

.ref-note {
  color: #666;
  font-size: 11px;
  margin-top: 4px;
}
```

- [ ] **Step 9: Verify the build compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 10: Verify dev server renders correctly**

Run: `cd web && npx vite --host 0.0.0.0 &` then open in browser
Expected: Full UI visible with dark theme, toggles, input, and note cards
Then kill the dev server.

- [ ] **Step 11: Run all tests**

Run: `cd web && npx vitest run`
Expected: All engine tests pass

- [ ] **Step 12: Commit**

```bash
git add web/src/
git commit -m "feat(web): build UI components, app shell, and dark theme

Components: Toolbar, ChordInput, PlaybackControls, NoteCards,
TuningComparison, SyntaxReference. Full state management in App.tsx.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: Integration Testing & Polish

**Files:**
- Possibly modify any files from previous tasks based on testing

- [ ] **Step 1: Run all tests**

Run: `cd web && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Build for production**

Run: `cd web && npm run build`
Expected: Build succeeds, `dist/` directory created

- [ ] **Step 3: Test production build**

Run: `cd web && npx vite preview --host 0.0.0.0 &` then open in browser
Expected: App loads and functions correctly from production build
Then kill the preview server.

- [ ] **Step 4: Manual smoke test checklist**

In the browser, verify:
- [ ] Typing chords parses correctly (green) and invalid chords show red
- [ ] Toggle Voice Leading between Off/Smooth/Bass-weighted
- [ ] Toggle Style between Block/Arpeggio
- [ ] Toggle Tuning between Just/Equal
- [ ] Click Play → chords play through speakers, current chord highlights
- [ ] Click Stop → playback stops immediately
- [ ] Tempo slider changes chord duration
- [ ] Note cards show correct notes, frequencies, intervals for each chord
- [ ] Tuning comparison shows cent differences
- [ ] Syntax Help panel slides in/out
- [ ] Prev/Next buttons navigate between chords when stopped

- [ ] **Step 5: Fix any issues found**

Address any bugs discovered during smoke testing.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(web): integration testing and polish

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
