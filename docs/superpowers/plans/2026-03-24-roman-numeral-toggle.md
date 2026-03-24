# Roman Numeral Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Roman numeral notation mode with bidirectional conversion, a Roman numeral parser, secondary dominant detection, and a key selector UI.

**Architecture:** Dual-parser system where both the existing standard parser and a new Roman numeral parser produce `ChordSymbol`. A notation mode toggle switches the active parser and bidirectionally transforms the textarea text. A key selector dropdown provides tonal context for Roman numeral interpretation.

**Tech Stack:** TypeScript, React 18, Vitest, Vite

**Spec:** `docs/superpowers/specs/2026-03-24-roman-numeral-toggle-design.md`

**Test runner:** `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run"`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `web/src/types.ts` | Modify | Add `NotationMode`, `KeyQuality`, `KeySignature` types |
| `web/src/engine/parser.ts` | Modify | Export `parseQuality()` as a named export |
| `web/src/engine/romanNumerals.ts` | Create | Scale degree ↔ pitch class logic, key model, enharmonic spelling |
| `web/src/engine/romanParser.ts` | Create | Roman numeral chord parser |
| `web/src/engine/romanConverter.ts` | Create | Bidirectional text conversion, secondary dominant detection, standard chord formatting |
| `web/src/engine/romanNumerals.test.ts` | Create | Tests for scale degree logic |
| `web/src/engine/romanParser.test.ts` | Create | Tests for Roman parser |
| `web/src/engine/romanConverter.test.ts` | Create | Tests for conversion and roundtripping |
| `web/src/components/ChordInput.tsx` | Modify | Accept pre-parsed `ParseResult[]` via props |
| `web/src/components/Toolbar.tsx` | Modify | Add notation mode toggle and key selector dropdown |
| `web/src/App.tsx` | Modify | Add state, parser routing, mode/key change handlers, pass parseResults to ChordInput |

---

## Task 1: Add new types

**Files:**
- Modify: `web/src/types.ts`

- [ ] **Step 1: Add types**

Add to the end of `web/src/types.ts`, before the closing of the file:

```typescript
export type NotationMode = 'standard' | 'roman';
export type KeyQuality = 'major' | 'minor';

export interface KeySignature {
  readonly root: PitchClass;
  readonly quality: KeyQuality;
}
```

- [ ] **Step 2: Verify build**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run"`
Expected: All 72 existing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts
git commit -m "feat: add NotationMode, KeyQuality, KeySignature types"
```

---

## Task 2: Export `parseQuality` from parser.ts

**Files:**
- Modify: `web/src/engine/parser.ts`

- [ ] **Step 1: Make `parseQuality` a named export**

In `web/src/engine/parser.ts`, change `function parseQuality` (line 76) to `export function parseQuality`. No other changes needed — the function body stays identical.

Before:
```typescript
function parseQuality(s: string): ChordType | null {
```

After:
```typescript
export function parseQuality(s: string): ChordType | null {
```

- [ ] **Step 2: Run tests**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run"`
Expected: All 72 tests still pass.

- [ ] **Step 3: Commit**

```bash
git add web/src/engine/parser.ts
git commit -m "refactor: export parseQuality for reuse by Roman numeral parser"
```

---

## Task 3: Scale degree logic (`romanNumerals.ts`)

**Files:**
- Create: `web/src/engine/romanNumerals.ts`
- Create: `web/src/engine/romanNumerals.test.ts`

- [ ] **Step 1: Write failing tests**

Create `web/src/engine/romanNumerals.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  scaleDegreeToPC,
  pcToScaleDegree,
  isSharpKey,
  pcToStandardName,
} from './romanNumerals';
import type { KeySignature } from '../types';

const Dmaj: KeySignature = { root: 'D', quality: 'major' };
const Cmaj: KeySignature = { root: 'C', quality: 'major' };
const Amaj: KeySignature = { root: 'A', quality: 'major' };
const Amin: KeySignature = { root: 'A', quality: 'minor' };
const Fmaj: KeySignature = { root: 'F', quality: 'major' };
const Fsmaj: KeySignature = { root: 'Fs', quality: 'major' };
const Bbmaj: KeySignature = { root: 'As', quality: 'major' };

describe('scaleDegreeToPC', () => {
  it('I in D major = D', () => {
    expect(scaleDegreeToPC(Dmaj, 1, 0)).toBe('D');
  });
  it('V in D major = A', () => {
    expect(scaleDegreeToPC(Dmaj, 5, 0)).toBe('A');
  });
  it('IV in C major = F', () => {
    expect(scaleDegreeToPC(Cmaj, 4, 0)).toBe('F');
  });
  it('VII in C major = B', () => {
    expect(scaleDegreeToPC(Cmaj, 7, 0)).toBe('B');
  });
  it('bVII in C major = Bb (As)', () => {
    expect(scaleDegreeToPC(Cmaj, 7, -1)).toBe('As');
  });
  it('#IV in C major = F# (Fs)', () => {
    expect(scaleDegreeToPC(Cmaj, 4, 1)).toBe('Fs');
  });
  it('III in A minor = C', () => {
    expect(scaleDegreeToPC(Amin, 3, 0)).toBe('C');
  });
  it('VII in A minor = G', () => {
    expect(scaleDegreeToPC(Amin, 7, 0)).toBe('G');
  });
  it('all 7 degrees of D major', () => {
    const expected = ['D', 'E', 'Fs', 'G', 'A', 'B', 'Cs'];
    for (let deg = 1; deg <= 7; deg++) {
      expect(scaleDegreeToPC(Dmaj, deg, 0)).toBe(expected[deg - 1]);
    }
  });
  it('all 7 degrees of A minor', () => {
    const expected = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    for (let deg = 1; deg <= 7; deg++) {
      expect(scaleDegreeToPC(Amin, deg, 0)).toBe(expected[deg - 1]);
    }
  });
});

describe('pcToScaleDegree', () => {
  it('D in D major = degree 1, accidental 0', () => {
    expect(pcToScaleDegree(Dmaj, 'D')).toEqual({ degree: 1, accidental: 0 });
  });
  it('A in D major = degree 5, accidental 0', () => {
    expect(pcToScaleDegree(Dmaj, 'A')).toEqual({ degree: 5, accidental: 0 });
  });
  it('Gs (Ab) in D major = degree 5, accidental -1 (bV)', () => {
    expect(pcToScaleDegree(Dmaj, 'Gs')).toEqual({ degree: 5, accidental: -1 });
  });
  it('Ds (Eb) in C major = degree 3, accidental -1 (bIII)', () => {
    expect(pcToScaleDegree(Cmaj, 'Ds')).toEqual({ degree: 3, accidental: -1 });
  });
  it('Fs in C major = degree 4, accidental 1 (#IV)', () => {
    expect(pcToScaleDegree(Cmaj, 'Fs')).toEqual({ degree: 4, accidental: 1 });
  });
  it('C in A minor = degree 3, accidental 0', () => {
    expect(pcToScaleDegree(Amin, 'C')).toEqual({ degree: 3, accidental: 0 });
  });
});

describe('isSharpKey', () => {
  it('D major is sharp', () => {
    expect(isSharpKey(Dmaj)).toBe(true);
  });
  it('F major is flat', () => {
    expect(isSharpKey(Fmaj)).toBe(false);
  });
  it('C major is flat (default)', () => {
    expect(isSharpKey(Cmaj)).toBe(false);
  });
  it('F# major is sharp', () => {
    expect(isSharpKey(Fsmaj)).toBe(true);
  });
  it('Bb major is flat', () => {
    expect(isSharpKey(Bbmaj)).toBe(false);
  });
});

describe('pcToStandardName', () => {
  it('Cs in sharp key = C#', () => {
    expect(pcToStandardName('Cs', true)).toBe('C#');
  });
  it('Cs in flat key = Db', () => {
    expect(pcToStandardName('Cs', false)).toBe('Db');
  });
  it('Ds in sharp key = D#', () => {
    expect(pcToStandardName('Ds', true)).toBe('D#');
  });
  it('Ds in flat key = Eb', () => {
    expect(pcToStandardName('Ds', false)).toBe('Eb');
  });
  it('natural notes are unchanged', () => {
    expect(pcToStandardName('C', true)).toBe('C');
    expect(pcToStandardName('D', false)).toBe('D');
    expect(pcToStandardName('A', true)).toBe('A');
  });
  it('Fs always = F#', () => {
    expect(pcToStandardName('Fs', true)).toBe('F#');
    expect(pcToStandardName('Fs', false)).toBe('Gb');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run src/engine/romanNumerals.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `romanNumerals.ts`**

Create `web/src/engine/romanNumerals.ts`:

```typescript
import { PITCH_CLASSES, type PitchClass, type KeySignature } from '../types';
import { pitchClassToInt, pitchClassFromInt } from './musicTheory';

// Scale intervals (semitones from root for degrees 1-7)
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10] as const;

function scaleIntervals(quality: 'major' | 'minor'): readonly number[] {
  return quality === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;
}

/** Convert a scale degree (1-7) + chromatic accidental to a PitchClass. */
export function scaleDegreeToPC(
  key: KeySignature,
  degree: number,
  accidental: number,
): PitchClass {
  const rootInt = pitchClassToInt(key.root);
  const intervals = scaleIntervals(key.quality);
  const diatonicSemitones = intervals[degree - 1]!;
  return pitchClassFromInt(rootInt + diatonicSemitones + accidental);
}

export interface ScaleDegreeInfo {
  degree: number;     // 1-7
  accidental: number; // -1, 0, or 1
}

/** Convert a PitchClass to its scale degree + accidental in the given key. */
export function pcToScaleDegree(
  key: KeySignature,
  pc: PitchClass,
): ScaleDegreeInfo {
  const rootInt = pitchClassToInt(key.root);
  const pcInt = pitchClassToInt(pc);
  const semitones = ((pcInt - rootInt) % 12 + 12) % 12;
  const intervals = scaleIntervals(key.quality);

  // Exact diatonic match
  const exactIdx = intervals.indexOf(semitones);
  if (exactIdx !== -1) {
    return { degree: exactIdx + 1, accidental: 0 };
  }

  // Sharp: semitones is one above a diatonic degree
  const sharpIdx = intervals.indexOf(semitones - 1);
  if (sharpIdx !== -1) {
    return { degree: sharpIdx + 1, accidental: 1 };
  }

  // Flat: semitones is one below a diatonic degree
  const flatIdx = intervals.indexOf(semitones + 1);
  if (flatIdx !== -1) {
    return { degree: flatIdx + 1, accidental: -1 };
  }

  // Fallback: shouldn't happen for chromatic pitches within ±1 semitone,
  // but handle double-sharps/flats by finding closest degree
  let bestDeg = 1;
  let bestAcc = 0;
  let bestDist = 99;
  for (let d = 0; d < 7; d++) {
    const diff = semitones - intervals[d]!;
    const wrapped = ((diff % 12) + 12) % 12;
    const dist = Math.min(wrapped, 12 - wrapped);
    if (dist < bestDist) {
      bestDist = dist;
      bestDeg = d + 1;
      bestAcc = wrapped <= 6 ? wrapped : wrapped - 12;
    }
  }
  return { degree: bestDeg, accidental: bestAcc };
}

// Sharp keys: G, D, A, E, B, F# (and their relative minors)
const SHARP_KEY_ROOTS: ReadonlySet<PitchClass> = new Set(['G', 'D', 'A', 'E', 'B', 'Fs']);
const SHARP_MINOR_ROOTS: ReadonlySet<PitchClass> = new Set(['E', 'B', 'Fs', 'Cs', 'Gs']);

/** Whether a key uses sharp spellings (vs flat). C major defaults to flat. */
export function isSharpKey(key: KeySignature): boolean {
  if (key.quality === 'minor') {
    return SHARP_MINOR_ROOTS.has(key.root);
  }
  return SHARP_KEY_ROOTS.has(key.root);
}

// Enharmonic display names
const SHARP_NAMES: Record<PitchClass, string> = {
  C: 'C', Cs: 'C#', D: 'D', Ds: 'D#', E: 'E', F: 'F',
  Fs: 'F#', G: 'G', Gs: 'G#', A: 'A', As: 'A#', B: 'B',
};

const FLAT_NAMES: Record<PitchClass, string> = {
  C: 'C', Cs: 'Db', D: 'D', Ds: 'Eb', E: 'E', F: 'F',
  Fs: 'Gb', G: 'G', Gs: 'Ab', A: 'A', As: 'Bb', B: 'B',
};

/** Convert a PitchClass to a standard note name, using sharps or flats. */
export function pcToStandardName(pc: PitchClass, useSharps: boolean): string {
  return useSharps ? SHARP_NAMES[pc] : FLAT_NAMES[pc];
}

// Roman numeral symbols
const ROMAN_UPPER = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;
const ROMAN_LOWER = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'] as const;

/** Format a scale degree as an uppercase Roman numeral (1-7). */
export function degreeToRomanUpper(degree: number): string {
  return ROMAN_UPPER[degree] ?? '';
}

/** Format a scale degree as a lowercase Roman numeral (1-7). */
export function degreeToRomanLower(degree: number): string {
  return ROMAN_LOWER[degree] ?? '';
}

/**
 * Parse a Roman numeral string (e.g. "IV", "vii", "III").
 * Returns [degree (1-7), isUpperCase] or null if invalid.
 * Consumes characters from the start of the string and returns remaining.
 */
export function parseRomanNumeral(s: string): { degree: number; upper: boolean; rest: string } | null {
  // Try longest match first
  const PATTERNS: [string, number, boolean][] = [
    ['VII', 7, true], ['vii', 7, false],
    ['VI', 6, true], ['vi', 6, false],
    ['IV', 4, true], ['iv', 4, false],
    ['V', 5, true], ['v', 5, false],
    ['III', 3, true], ['iii', 3, false],
    ['II', 2, true], ['ii', 2, false],
    ['I', 1, true], ['i', 1, false],
  ];
  for (const [pat, deg, upper] of PATTERNS) {
    if (s.startsWith(pat)) {
      return { degree: deg, upper, rest: s.slice(pat.length) };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run src/engine/romanNumerals.test.ts"`
Expected: All tests PASS.

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run"`
Expected: All tests pass (72 existing + new ones).

- [ ] **Step 6: Commit**

```bash
git add web/src/engine/romanNumerals.ts web/src/engine/romanNumerals.test.ts
git commit -m "feat: add scale degree logic and key model for Roman numeral support"
```

---

## Task 4: Roman numeral parser (`romanParser.ts`)

**Files:**
- Create: `web/src/engine/romanParser.ts`
- Create: `web/src/engine/romanParser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `web/src/engine/romanParser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseRomanChord, parseRomanSequence } from './romanParser';
import type { ChordSymbol, KeySignature } from '../types';

const Cmaj: KeySignature = { root: 'C', quality: 'major' };
const Dmaj: KeySignature = { root: 'D', quality: 'major' };
const Amin: KeySignature = { root: 'A', quality: 'minor' };

function expectChord(input: string, key: KeySignature, expected: ChordSymbol) {
  const result = parseRomanChord(input, key);
  expect(result.ok, `Expected '${input}' to parse OK but got: ${result.ok ? '' : result.error}`).toBe(true);
  if (result.ok) {
    expect(result.value).toEqual(expected);
  }
}

function expectFail(input: string, key: KeySignature) {
  const result = parseRomanChord(input, key);
  expect(result.ok).toBe(false);
}

describe('parseRomanChord', () => {
  // Basic diatonic chords in C major
  it('I in C = C Major', () => {
    expectChord('I', Cmaj, { root: 'C', quality: 'Major', inversion: null });
  });
  it('ii in C = D Minor', () => {
    expectChord('ii', Cmaj, { root: 'D', quality: 'Minor', inversion: null });
  });
  it('iii in C = E Minor', () => {
    expectChord('iii', Cmaj, { root: 'E', quality: 'Minor', inversion: null });
  });
  it('IV in C = F Major', () => {
    expectChord('IV', Cmaj, { root: 'F', quality: 'Major', inversion: null });
  });
  it('V in C = G Major', () => {
    expectChord('V', Cmaj, { root: 'G', quality: 'Major', inversion: null });
  });
  it('vi in C = A Minor', () => {
    expectChord('vi', Cmaj, { root: 'A', quality: 'Minor', inversion: null });
  });
  it('VII in C = B Major', () => {
    expectChord('VII', Cmaj, { root: 'B', quality: 'Major', inversion: null });
  });

  // Quality suffixes
  it('V7 in C = G Dom7', () => {
    expectChord('V7', Cmaj, { root: 'G', quality: 'Dom7', inversion: null });
  });
  it('IVmaj7 in C = F Maj7', () => {
    expectChord('IVmaj7', Cmaj, { root: 'F', quality: 'Maj7', inversion: null });
  });
  it('ii7 in C = D Min7 (lowercase + 7 = min7)', () => {
    // lowercase numeral implies minor, "7" suffix on minor = min7
    // Actually, per spec: parseQuality('7') = 'Dom7', and this overrides case.
    // So ii7 = D Dom7. The case provides default, suffix overrides.
    expectChord('ii7', Cmaj, { root: 'D', quality: 'Dom7', inversion: null });
  });
  it('iim7 in C = D Min7', () => {
    expectChord('iim7', Cmaj, { root: 'D', quality: 'Min7', inversion: null });
  });
  it('viidim in C = B Dim', () => {
    expectChord('viidim', Cmaj, { root: 'B', quality: 'Dim', inversion: null });
  });
  it('viidim7 in C = B Dim7', () => {
    expectChord('viidim7', Cmaj, { root: 'B', quality: 'Dim7', inversion: null });
  });
  it('viim7b5 in C = B HalfDim7', () => {
    expectChord('viim7b5', Cmaj, { root: 'B', quality: 'HalfDim7', inversion: null });
  });
  it('III+ in C = E Aug', () => {
    expectChord('III+', Cmaj, { root: 'E', quality: 'Aug', inversion: null });
  });
  it('Isus4 in C = C Sus4', () => {
    expectChord('Isus4', Cmaj, { root: 'C', quality: 'Sus4', inversion: null });
  });
  it('V9 in C = G Dom9', () => {
    expectChord('V9', Cmaj, { root: 'G', quality: 'Dom9', inversion: null });
  });
  it('I6 in C = C Maj6', () => {
    expectChord('I6', Cmaj, { root: 'C', quality: 'Maj6', inversion: null });
  });

  // Accidentals
  it('bVII in C = Bb Major', () => {
    expectChord('bVII', Cmaj, { root: 'As', quality: 'Major', inversion: null });
  });
  it('bVII7 in C = Bb Dom7', () => {
    expectChord('bVII7', Cmaj, { root: 'As', quality: 'Dom7', inversion: null });
  });
  it('#IV in C = F# Major', () => {
    expectChord('#IV', Cmaj, { root: 'Fs', quality: 'Major', inversion: null });
  });
  it('bIII in C = Eb Major', () => {
    expectChord('bIII', Cmaj, { root: 'Ds', quality: 'Major', inversion: null });
  });

  // Different keys
  it('I in D = D Major', () => {
    expectChord('I', Dmaj, { root: 'D', quality: 'Major', inversion: null });
  });
  it('V7 in D = A Dom7', () => {
    expectChord('V7', Dmaj, { root: 'A', quality: 'Dom7', inversion: null });
  });
  it('vi in D = B Minor', () => {
    expectChord('vi', Dmaj, { root: 'B', quality: 'Minor', inversion: null });
  });

  // Minor key
  it('i in A minor = A Minor', () => {
    expectChord('i', Amin, { root: 'A', quality: 'Minor', inversion: null });
  });
  it('III in A minor = C Major', () => {
    expectChord('III', Amin, { root: 'C', quality: 'Major', inversion: null });
  });
  it('V7 in A minor = E Dom7', () => {
    // V in A minor natural = E (degree 5, semitone 7 from A)
    expectChord('V7', Amin, { root: 'E', quality: 'Dom7', inversion: null });
  });

  // Secondary dominants
  it('V7/V in C = D7 (dominant of G)', () => {
    expectChord('V7/V', Cmaj, { root: 'D', quality: 'Dom7', inversion: null });
  });
  it('V7/ii in C = A7 (dominant of Dm=D)', () => {
    expectChord('V7/ii', Cmaj, { root: 'A', quality: 'Dom7', inversion: null });
  });
  it('V7/vi in D = C#7 (dominant of Bm=B)', () => {
    // vi in D = B, V of B = F#... wait
    // V7/vi in D: target vi = B, V of B (as major) = F#, so F#7
    expectChord('V7/vi', Dmaj, { root: 'Fs', quality: 'Dom7', inversion: null });
  });
  it('V/IV in C = C Major (dominant of F)', () => {
    expectChord('V/IV', Cmaj, { root: 'C', quality: 'Major', inversion: null });
  });

  // Inversions
  it('1V7 in C = G Dom7, inversion 1', () => {
    expectChord('1V7', Cmaj, { root: 'G', quality: 'Dom7', inversion: 1 });
  });
  it('-1IV in C = F Major, inversion -1', () => {
    expectChord('-1IV', Cmaj, { root: 'F', quality: 'Major', inversion: -1 });
  });

  // Errors
  it('empty string fails', () => {
    expectFail('', Cmaj);
  });
  it('invalid numeral fails', () => {
    expectFail('X7', Cmaj);
  });
  it('invalid quality suffix fails', () => {
    expectFail('Ixyz', Cmaj);
  });
});

describe('parseRomanSequence', () => {
  it('parses space-separated Roman numerals', () => {
    const result = parseRomanSequence('I V7 vi IV', Cmaj);
    expect(result).toHaveLength(4);
    expect(result.every(r => r.ok)).toBe(true);
  });
  it('marks invalid tokens as errors', () => {
    const result = parseRomanSequence('I XYZ V', Cmaj);
    expect(result).toHaveLength(3);
    expect(result[0]!.ok).toBe(true);
    expect(result[1]!.ok).toBe(false);
    expect(result[2]!.ok).toBe(true);
  });
  it('handles empty input', () => {
    const result = parseRomanSequence('', Cmaj);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run src/engine/romanParser.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `romanParser.ts`**

Create `web/src/engine/romanParser.ts`:

```typescript
import type { PitchClass, ChordType, ChordSymbol, ParseResult, KeySignature } from '../types';
import { parseQuality } from './parser';
import { scaleDegreeToPC, parseRomanNumeral } from './romanNumerals';

export function parseRomanChord(input: string, key: KeySignature): ParseResult<ChordSymbol> {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Empty input' };
  }

  let pos = 0;

  // Parse optional inversion prefix: [-]digit followed by a Roman numeral char or accidental
  let inversion: number | null = null;
  const invMatch = trimmed.match(/^(-?\d)/);
  if (invMatch) {
    const afterDigits = invMatch[0].length;
    if (afterDigits < trimmed.length && /[#bIiVv]/.test(trimmed[afterDigits]!)) {
      inversion = parseInt(invMatch[0], 10);
      pos = afterDigits;
    }
  }

  // Parse optional accidental prefix: # or b
  let accidental = 0;
  if (pos < trimmed.length && trimmed[pos] === '#') {
    accidental = 1;
    pos++;
  } else if (pos < trimmed.length && trimmed[pos] === 'b') {
    accidental = -1;
    pos++;
  }

  // Parse Roman numeral
  const numeralResult = parseRomanNumeral(trimmed.slice(pos));
  if (!numeralResult) {
    return { ok: false, error: `Expected Roman numeral (I-VII), got '${trimmed.slice(pos)}'` };
  }

  const { degree, upper, rest } = numeralResult;

  // Split rest on '/' for secondary dominant
  const slashIdx = rest.indexOf('/');
  let qualityStr: string;
  let secondaryTarget: string | null = null;

  if (slashIdx !== -1) {
    qualityStr = rest.slice(0, slashIdx);
    secondaryTarget = rest.slice(slashIdx + 1);
  } else {
    qualityStr = rest;
  }

  // Parse quality suffix (if any)
  let quality: ChordType;
  if (qualityStr === '') {
    quality = upper ? 'Major' : 'Minor';
  } else {
    const parsed = parseQuality(qualityStr);
    if (parsed === null) {
      return { ok: false, error: `Unknown quality: '${qualityStr}'` };
    }
    quality = parsed;
  }

  // Resolve root pitch class
  let root: PitchClass;
  if (secondaryTarget) {
    // Parse the target as a Roman numeral to get the target pitch class
    const targetResult = parseRomanNumeral(secondaryTarget);
    if (!targetResult || targetResult.rest !== '') {
      return { ok: false, error: `Invalid secondary target: '${secondaryTarget}'` };
    }
    // Resolve target degree to pitch class in the original key
    const targetPC = scaleDegreeToPC(key, targetResult.degree, 0);
    // Resolve main numeral relative to target as temporary major key
    const tempKey: KeySignature = { root: targetPC, quality: 'major' };
    root = scaleDegreeToPC(tempKey, degree, accidental);
  } else {
    root = scaleDegreeToPC(key, degree, accidental);
  }

  return { ok: true, value: { root, quality, inversion } };
}

export function parseRomanSequence(input: string, key: KeySignature): ParseResult<ChordSymbol>[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];
  const tokens = trimmed.split(/\s+/);
  return tokens.map(token => parseRomanChord(token, key));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run src/engine/romanParser.test.ts"`
Expected: All tests PASS.

- [ ] **Step 5: Run all tests**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run"`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/engine/romanParser.ts web/src/engine/romanParser.test.ts
git commit -m "feat: add Roman numeral chord parser with secondary dominant support"
```

---

## Task 5: Bidirectional converter (`romanConverter.ts`)

**Files:**
- Create: `web/src/engine/romanConverter.ts`
- Create: `web/src/engine/romanConverter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `web/src/engine/romanConverter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { chordTextToRoman, romanTextToStandard } from './romanConverter';
import { parseChordSequence } from './parser';
import { parseRomanSequence } from './romanParser';
import type { KeySignature } from '../types';

const Cmaj: KeySignature = { root: 'C', quality: 'major' };
const Dmaj: KeySignature = { root: 'D', quality: 'major' };
const Amaj: KeySignature = { root: 'A', quality: 'major' };
const Amin: KeySignature = { root: 'A', quality: 'minor' };

describe('chordTextToRoman', () => {
  it('C Am G F in C major = I vi V IV', () => {
    expect(chordTextToRoman('C Am G F', Cmaj)).toBe('I vi V IV');
  });
  it('D A Bm G in D major = I V vi IV', () => {
    expect(chordTextToRoman('D A Bm G', Dmaj)).toBe('I V vi IV');
  });
  it('handles Dom7', () => {
    expect(chordTextToRoman('G7', Cmaj)).toBe('V7');
  });
  it('handles Maj7', () => {
    expect(chordTextToRoman('Fmaj7', Cmaj)).toBe('IVmaj7');
  });
  it('handles chromatic chords with accidentals', () => {
    // Bb in C major = bVII
    expect(chordTextToRoman('Bb', Cmaj)).toBe('bVII');
  });
  it('preserves whitespace', () => {
    expect(chordTextToRoman('C  G', Cmaj)).toBe('I  V');
  });
  it('passes invalid tokens through unchanged', () => {
    expect(chordTextToRoman('C XYZ G', Cmaj)).toBe('I XYZ V');
  });
  it('handles empty input', () => {
    expect(chordTextToRoman('', Cmaj)).toBe('');
  });

  // Secondary dominant detection
  it('detects V7/V: D7 → G in C major', () => {
    // D7 resolves to G, and G is V in C
    expect(chordTextToRoman('D7 G', Cmaj)).toBe('V7/V V');
  });
  it('detects V7/ii: A7 → Dm in C major', () => {
    expect(chordTextToRoman('A7 Dm', Cmaj)).toBe('V7/ii ii');
  });
  it('does NOT label diatonic V7 as V7/I', () => {
    expect(chordTextToRoman('G7 C', Cmaj)).toBe('V7 I');
  });
});

describe('romanTextToStandard', () => {
  it('I vi V IV in C major = C Am G F', () => {
    expect(romanTextToStandard('I vi V IV', Cmaj)).toBe('C Am G F');
  });
  it('I V vi IV in D major = D A Bm G', () => {
    expect(romanTextToStandard('I V vi IV', Dmaj)).toBe('D A Bm G');
  });
  it('handles quality suffixes', () => {
    expect(romanTextToStandard('V7', Cmaj)).toBe('G7');
  });
  it('preserves whitespace', () => {
    expect(romanTextToStandard('I  V', Cmaj)).toBe('C  G');
  });
  it('passes invalid tokens through unchanged', () => {
    expect(romanTextToStandard('I XYZ V', Cmaj)).toBe('C XYZ G');
  });
  it('handles empty input', () => {
    expect(romanTextToStandard('', Cmaj)).toBe('');
  });
  it('uses sharp spelling in sharp keys', () => {
    // iii in D major = F# minor
    expect(romanTextToStandard('iii', Dmaj)).toBe('F#m');
  });
  it('uses flat spelling in flat keys', () => {
    const Bbmaj: KeySignature = { root: 'As', quality: 'major' };
    // IV in Bb major = Eb
    expect(romanTextToStandard('IV', Bbmaj)).toBe('Eb');
  });
  it('handles secondary dominants', () => {
    expect(romanTextToStandard('V7/V', Cmaj)).toBe('D7');
  });
});

describe('roundtrip: standard → roman → standard', () => {
  const testCases: [string, KeySignature, string][] = [
    ['C Am G F', Cmaj, 'standard I-vi-V-IV in C'],
    ['D A Bm G', Dmaj, 'standard I-V-vi-IV in D'],
    ['C G7 F Dm', Cmaj, 'with dom7 in C'],
    ['Am E7 F G', Amin, 'minor key progression'],
  ];

  for (const [input, key, label] of testCases) {
    it(`roundtrips: ${label}`, () => {
      const roman = chordTextToRoman(input, key);
      const backToStandard = romanTextToStandard(roman, key);
      // Parse both and compare ChordSymbol arrays
      const original = parseChordSequence(input).filter(r => r.ok).map(r => (r as any).value);
      const roundtripped = parseChordSequence(backToStandard).filter(r => r.ok).map(r => (r as any).value);
      expect(roundtripped).toEqual(original);
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run src/engine/romanConverter.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `romanConverter.ts`**

Create `web/src/engine/romanConverter.ts`:

```typescript
import type { ChordSymbol, ChordType, KeySignature, PitchClass } from '../types';
import { parseChord } from './parser';
import { parseRomanChord } from './romanParser';
import { pitchClassToInt } from './musicTheory';
import {
  pcToScaleDegree,
  degreeToRomanUpper,
  degreeToRomanLower,
  isSharpKey,
  pcToStandardName,
} from './romanNumerals';

/** Quality suffix for standard notation output. */
function standardQualitySuffix(quality: ChordType): string {
  const MAP: Record<ChordType, string> = {
    Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
    Dim: 'dim', Dim7: 'dim7', Aug: 'aug', HalfDim7: 'm7b5',
    Sus4: 'sus4', Sus2: 'sus2', MinMaj7: 'mMaj7', Maj6: '6', Min6: 'm6',
    Dom9: '9',
  };
  return MAP[quality];
}

/** Quality suffix for Roman numeral notation, given whether the numeral is uppercase. */
function romanQualitySuffix(quality: ChordType, isUpper: boolean): string {
  // If case already encodes the quality, no suffix needed
  if (quality === 'Major' && isUpper) return '';
  if (quality === 'Minor' && !isUpper) return '';
  return standardQualitySuffix(quality);
}

/** Is this quality conventionally "major-like" (uses uppercase numeral)? */
function isMajorLike(quality: ChordType): boolean {
  return quality === 'Major' || quality === 'Dom7' || quality === 'Maj7'
    || quality === 'Aug' || quality === 'Maj6' || quality === 'Dom9'
    || quality === 'Sus4' || quality === 'Sus2';
}

/**
 * Detect if a chord is a secondary dominant of the next chord.
 * Returns the target scale degree string (e.g. 'V', 'ii') or null.
 */
function detectSecondaryDominant(
  chord: ChordSymbol,
  nextChord: ChordSymbol | null,
  key: KeySignature,
): string | null {
  if (!nextChord) return null;
  // Only Dom7 or Major chords can be secondary dominants
  if (chord.quality !== 'Dom7' && chord.quality !== 'Major') return null;

  const chordRoot = pitchClassToInt(chord.root);
  const nextRoot = pitchClassToInt(nextChord.root);
  // Check if chord root is a P5 above next root (7 semitones)
  const interval = ((chordRoot - nextRoot) % 12 + 12) % 12;
  if (interval !== 7) return null;

  // Check if this is already the diatonic V
  const { degree: chordDeg, accidental: chordAcc } = pcToScaleDegree(key, chord.root);
  if (chordDeg === 5 && chordAcc === 0) {
    // This is the diatonic V — check if it resolves to I
    const { degree: nextDeg, accidental: nextAcc } = pcToScaleDegree(key, nextChord.root);
    if (nextDeg === 1 && nextAcc === 0) return null; // Plain V7 → I
  }

  // Format the target degree as a Roman numeral
  const { degree: targetDeg, accidental: targetAcc } = pcToScaleDegree(key, nextChord.root);
  const targetUpper = isMajorLike(nextChord.quality);
  const targetNumeral = targetUpper
    ? degreeToRomanUpper(targetDeg)
    : degreeToRomanLower(targetDeg);
  const accStr = targetAcc === 1 ? '#' : targetAcc === -1 ? 'b' : '';
  return accStr + targetNumeral;
}

/** Convert standard chord text to Roman numeral text. */
export function chordTextToRoman(text: string, key: KeySignature): string {
  if (text.trim() === '') return text;

  const parts = text.split(/(\s+)/);
  const chordTokens: { index: number; chord: ChordSymbol }[] = [];

  // First pass: parse all chord tokens
  for (let i = 0; i < parts.length; i++) {
    if (/^\s*$/.test(parts[i]!)) continue;
    const result = parseChord(parts[i]!);
    if (result.ok) {
      chordTokens.push({ index: i, chord: result.value });
    }
  }

  // Second pass: convert each token
  let chordIdx = 0;
  return parts.map((part, i) => {
    if (/^\s*$/.test(part)) return part;

    const result = parseChord(part);
    if (!result.ok) return part; // pass through invalid tokens

    const chord = result.value;
    const tokenIdx = chordTokens.findIndex(ct => ct.index === i);
    const nextChord = tokenIdx >= 0 && tokenIdx < chordTokens.length - 1
      ? chordTokens[tokenIdx + 1]!.chord
      : null;

    // Detect secondary dominant
    const secDom = detectSecondaryDominant(chord, nextChord, key);

    const { degree, accidental } = pcToScaleDegree(key, chord.root);
    const upper = isMajorLike(chord.quality);
    const numeral = upper ? degreeToRomanUpper(degree) : degreeToRomanLower(degree);
    const accStr = accidental === 1 ? '#' : accidental === -1 ? 'b' : '';
    const qualSuffix = romanQualitySuffix(chord.quality, upper);

    const invPrefix = chord.inversion !== null ? String(chord.inversion) : '';

    if (secDom) {
      // For secondary dominants, always show as V7/X or V/X
      const secQual = chord.quality === 'Dom7' ? '7' : '';
      return `${invPrefix}V${secQual}/${secDom}`;
    }

    return `${invPrefix}${accStr}${numeral}${qualSuffix}`;
  }).join('');
}

/** Convert Roman numeral text to standard chord text. */
export function romanTextToStandard(text: string, key: KeySignature): string {
  if (text.trim() === '') return text;

  const useSharps = isSharpKey(key);
  const parts = text.split(/(\s+)/);

  return parts.map(part => {
    if (/^\s*$/.test(part)) return part;

    const result = parseRomanChord(part, key);
    if (!result.ok) return part; // pass through invalid tokens

    const chord = result.value;
    const rootName = pcToStandardName(chord.root, useSharps);
    const qualSuffix = standardQualitySuffix(chord.quality);
    const invPrefix = chord.inversion !== null ? String(chord.inversion) : '';

    return `${invPrefix}${rootName}${qualSuffix}`;
  }).join('');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run src/engine/romanConverter.test.ts"`
Expected: All tests PASS.

- [ ] **Step 5: Run all tests**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run"`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/engine/romanConverter.ts web/src/engine/romanConverter.test.ts
git commit -m "feat: add bidirectional chord text converter with secondary dominant detection"
```

---

## Task 6: Refactor ChordInput to accept pre-parsed results

**Files:**
- Modify: `web/src/components/ChordInput.tsx`
- Modify: `web/src/App.tsx` (just the ChordInput usage)

**Important:** ChordInput has scroll sync (`textareaRef`/`displayRef`/`handleScroll`), focus state (`isFocused`/`showOverlay`), `readOnly={isPlaying}`, and conditional overlay rendering. ALL of these must be preserved. Only the parse source changes.

- [ ] **Step 1: Update ChordInput imports and props**

In `web/src/components/ChordInput.tsx`, make these surgical changes:

Change the import line (line 2):
```typescript
// Before:
import { parseChordSequence } from '../engine/parser';
// After:
import type { ParseResult, ChordSymbol } from '../types';
```

Add `parseResults` to the interface (after `isPlaying: boolean;`):
```typescript
  parseResults: ParseResult<ChordSymbol>[];
```

Add `parseResults` to the destructured props (after `isPlaying,`):
```typescript
  parseResults,
```

- [ ] **Step 2: Replace internal parse call with prop**

In the `segments` useMemo (around line 41), change:
```typescript
// Before:
    const parseResults = parseChordSequence(value);
// After (delete this line — parseResults now comes from props)
```

Update the useMemo dependency array (line 57):
```typescript
// Before:
  }, [value]);
// After:
  }, [value, parseResults]);
```

All other code (refs, scroll sync, focus handling, readOnly, conditional overlay) stays exactly as-is.

- [ ] **Step 3: Update App.tsx to pass parseResults**

In `web/src/App.tsx`, add `parseResults` to the `<ChordInput>` JSX (around line 174-179):

```tsx
      <ChordInput
        value={chordText}
        onChange={setChordText}
        currentChordIndex={currentChordIndex}
        isPlaying={isPlaying}
        parseResults={parseResults}
      />
```

- [ ] **Step 4: Run all tests and type-check**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && npx tsc -b --noEmit && vitest run"`
Expected: No type errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ChordInput.tsx web/src/App.tsx
git commit -m "refactor: ChordInput accepts pre-parsed results via props"
```

---

## Task 7: Add notation mode toggle and key selector to Toolbar

**Files:**
- Modify: `web/src/components/Toolbar.tsx`

**Important:** Toolbar currently has `onExportWav`, `exportDisabled`, `isExporting` props and an Export WAV button. ALL existing props and UI must be preserved.

- [ ] **Step 1: Add new imports and props**

In `web/src/components/Toolbar.tsx`, update the import (line 1) to include new types:

```typescript
import { VoiceLeading, PlayStyle, Tuning, NotationMode, KeySignature, PitchClass, KeyQuality } from '../types';
```

Add new props to the `ToolbarProps` interface (after `onToggleSyntaxHelp: () => void;`, before `onExportWav`):

```typescript
  notationMode: NotationMode;
  selectedKey: KeySignature;
  onNotationModeChange: (mode: NotationMode) => void;
  onKeyChange: (key: KeySignature) => void;
```

- [ ] **Step 2: Add KeySelector component**

Add this component inside the file, before the `Toolbar` export function:

```typescript
const KEY_DISPLAY_NAMES: Record<PitchClass, string> = {
  C: 'C', Cs: 'C♯/D♭', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'F♯/G♭', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};

const KEY_OPTIONS: PitchClass[] = [
  'C', 'G', 'D', 'A', 'E', 'B', 'Fs', 'Cs', 'F', 'As', 'Ds', 'Gs',
];

function KeySelector({ selectedKey, onKeyChange }: {
  selectedKey: KeySignature;
  onKeyChange: (key: KeySignature) => void;
}) {
  const keyValue = `${selectedKey.root}-${selectedKey.quality}`;

  return (
    <div className="toggle-group">
      <span className="group-label">Key</span>
      <select
        className="key-selector"
        value={keyValue}
        onChange={(e) => {
          const [root, quality] = e.target.value.split('-') as [PitchClass, KeyQuality];
          onKeyChange({ root, quality });
        }}
      >
        <optgroup label="Major">
          {KEY_OPTIONS.map(pc => (
            <option key={`${pc}-major`} value={`${pc}-major`}>
              {KEY_DISPLAY_NAMES[pc]} major
            </option>
          ))}
        </optgroup>
        <optgroup label="Minor">
          {KEY_OPTIONS.map(pc => (
            <option key={`${pc}-minor`} value={`${pc}-minor`}>
              {KEY_DISPLAY_NAMES[pc]} minor
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
```

- [ ] **Step 3: Update Toolbar function signature and body**

Add `notationMode`, `selectedKey`, `onNotationModeChange`, `onKeyChange` to the destructured props in the `Toolbar` function.

Insert the Notation toggle and conditional KeySelector into the JSX, as the **first** children inside `<div className="toolbar">`, before the Voice Leading toggle:

```tsx
      <ToggleGroup
        label="Notation"
        options={['standard', 'roman'] as const}
        value={notationMode}
        onChange={onNotationModeChange}
        labels={{ standard: 'Standard', roman: 'Roman' }}
      />

      {notationMode === 'roman' && (
        <KeySelector selectedKey={selectedKey} onKeyChange={onKeyChange} />
      )}
```

The existing Voice Leading, Style, Tuning toggles, Syntax Help button, and Export WAV button all remain exactly as they are.

- [ ] **Step 4: Verify type errors are expected**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && npx tsc -b --noEmit 2>&1 | head -20"`
Expected: Type errors in App.tsx only (missing new props on `<Toolbar>`). These are fixed in Task 8.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Toolbar.tsx
git commit -m "feat: add notation mode toggle and key selector to Toolbar"
```

---

## Task 8: Wire up App.tsx with notation mode state and parser routing

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add imports**

Add these imports at the top of `web/src/App.tsx` (after the existing imports):

```typescript
import { NotationMode, KeySignature } from './types';
import { parseRomanSequence } from './engine/romanParser';
import { chordTextToRoman, romanTextToStandard } from './engine/romanConverter';
```

- [ ] **Step 2: Add state variables**

Add new state after `const [isExporting, setIsExporting] = useState(false);` (line 23):

```typescript
const [notationMode, setNotationMode] = useState<NotationMode>('standard');
const [selectedKey, setSelectedKey] = useState<KeySignature>({ root: 'C', quality: 'major' });
```

- [ ] **Step 3: Update parser routing**

Replace line 28:

```typescript
// Before:
const parseResults = parseChordSequence(chordText);
// After:
const parseResults = notationMode === 'standard'
  ? parseChordSequence(chordText)
  : parseRomanSequence(chordText, selectedKey);
```

- [ ] **Step 4: Add mode and key change handlers**

Add these handlers after the `handleExportWav` function (after line 131):

```typescript
const handleNotationModeChange = useCallback((newMode: NotationMode) => {
  if (newMode === notationMode) return;
  if (newMode === 'roman') {
    setChordText(chordTextToRoman(chordText, selectedKey));
  } else {
    setChordText(romanTextToStandard(chordText, selectedKey));
  }
  setNotationMode(newMode);
}, [notationMode, chordText, selectedKey]);

const handleKeyChange = useCallback((newKey: KeySignature) => {
  if (notationMode === 'roman') {
    const standard = romanTextToStandard(chordText, selectedKey);
    setChordText(chordTextToRoman(standard, newKey));
  }
  setSelectedKey(newKey);
}, [notationMode, chordText, selectedKey]);
```

- [ ] **Step 5: Update Toolbar props in JSX**

Add the four new props to the existing `<Toolbar>` JSX (lines 161-172). Insert after `onTuningChange={setTuning}`, before `onToggleSyntaxHelp`:

```tsx
        notationMode={notationMode}
        selectedKey={selectedKey}
        onNotationModeChange={handleNotationModeChange}
        onKeyChange={handleKeyChange}
```

The existing `onToggleSyntaxHelp`, `onExportWav`, `exportDisabled`, and `isExporting` props remain unchanged.

- [ ] **Step 6: Build and test**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && npx tsc -b --noEmit && vitest run"`
Expected: No type errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: wire up notation mode state, parser routing, and key/mode handlers"
```

---

## Task 9: Add basic CSS for key selector

**Files:**
- Modify: `web/src/styles/index.css`

- [ ] **Step 1: Add key selector styles**

Append to `web/src/styles/index.css`:

```css
.key-selector {
  background: var(--bg-secondary, #2a2a3d);
  color: var(--text-primary, #e0e0e0);
  border: 1px solid var(--border-color, #3a3a5c);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
}

.key-selector:focus {
  outline: 2px solid var(--accent-color, #7a5fca);
  outline-offset: 1px;
}
```

Note: Use whatever CSS custom properties are already defined in the stylesheet. If the file uses raw color values instead of custom properties, match the existing style.

- [ ] **Step 2: Verify visually**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && npx vite build"`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add web/src/styles/index.css
git commit -m "style: add key selector dropdown CSS"
```

---

## Task 10: Final integration test and cleanup

- [ ] **Step 1: Run all tests**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && vitest run"`
Expected: All tests pass (original 72 + all new tests).

- [ ] **Step 2: Run build**

Run: `nix develop /home/sspeaks/chordplay -c bash -c "cd /home/sspeaks/chordplay/web && npx tsc -b && npx vite build"`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Verify existing tests haven't changed**

Confirm the original 5 test files still pass:
- `parser.test.ts` — 24 tests
- `musicTheory.test.ts` — 27 tests
- `voiceLeading.test.ts` — 6 tests
- `audio.test.ts` — 10 tests
- `wav.test.ts` — 5 tests

- [ ] **Step 4: Final commit if any uncommitted changes remain**

```bash
git status
# If clean, done. If not:
git add -A && git commit -m "chore: final cleanup for Roman numeral toggle feature"
```
