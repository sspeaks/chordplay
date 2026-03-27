# Chord Spelling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to enter chords by spelling individual notes in parentheses — e.g., `(F A C Eb)` → F7 — inline in the existing chord input textarea.

**Architecture:** Extend `ChordSymbol` with optional `explicitVoicing` and `warning` fields. Add a new `chordSpelling.ts` module that parses note names and reverse-identifies chords from interval patterns. Integrate into the existing parser's tokenizer so parenthesized groups route to the new module. Handle explicit voicing in `voiceChordSequence` by assigning ascending octaves centered on the gravity center.

**Tech Stack:** TypeScript, React, Vitest, Web Audio API

**Spec:** `docs/superpowers/specs/2026-03-27-chord-spelling-design.md`

---

### File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types.ts` | Add `explicitVoicing?` and `warning?` to `ChordSymbol` |
| Create | `src/engine/chordSpelling.ts` | Note name parsing, reverse chord identification, `parseSpelledChord()` |
| Create | `src/engine/chordSpelling.test.ts` | Tests for all chord spelling logic |
| Modify | `src/engine/parser.ts` | Export `resolveRoot`, add `tokenizeChordInput()`, update `parseChordSequence()` |
| Modify | `src/engine/parser.test.ts` | Integration tests for mixed sequences with `(...)` tokens |
| Modify | `src/engine/voiceLeading.ts` | Add `assignOctaves()`, handle `explicitVoicing` in `voiceChordSequence()` |
| Modify | `src/engine/voiceLeading.test.ts` | Tests for octave assignment and explicit voicing bypass |
| Modify | `src/components/ChordInput.tsx` | Use tokenizer for segments, add warning color + tooltip |
| Modify | `src/components/SyntaxReference.tsx` | Add spelled chord documentation section |
| Modify | `src/engine/urlState.ts` | Change `DEFAULTS.chordText` to `''` |

---

### Task 1: Extend ChordSymbol Type

**Files:**
- Modify: `src/types.ts:22-26`

- [ ] **Step 1: Add optional fields to ChordSymbol**

In `src/types.ts`, change the `ChordSymbol` interface:

```typescript
export interface ChordSymbol {
  readonly root: PitchClass;
  readonly quality: ChordType;
  readonly inversion: number | null;  // null = auto-voice in smooth mode
  readonly explicitVoicing?: PitchClass[];  // bypass voice leading, play these notes in order
  readonly warning?: boolean;               // true if notes didn't match any known chord type
}
```

- [ ] **Step 2: Run existing tests to confirm no breakage**

Run: `npm test`
Expected: All existing tests pass (fields are optional/additive).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add explicitVoicing and warning fields to ChordSymbol"
```

---

### Task 2: Note Name Parser

**Files:**
- Modify: `src/engine/parser.ts:60-72` (export `resolveRoot`)
- Create: `src/engine/chordSpelling.ts`
- Create: `src/engine/chordSpelling.test.ts`

- [ ] **Step 1: Export resolveRoot from parser.ts**

In `src/engine/parser.ts`, change:

```typescript
function resolveRoot(letter: string, accidental: string | null): PitchClass | null {
```

to:

```typescript
export function resolveRoot(letter: string, accidental: string | null): PitchClass | null {
```

- [ ] **Step 2: Write failing tests for parseNoteName**

Create `src/engine/chordSpelling.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseNoteName } from './chordSpelling';

describe('parseNoteName', () => {
  it('parses natural notes', () => {
    expect(parseNoteName('C')).toBe('C');
    expect(parseNoteName('D')).toBe('D');
    expect(parseNoteName('E')).toBe('E');
    expect(parseNoteName('F')).toBe('F');
    expect(parseNoteName('G')).toBe('G');
    expect(parseNoteName('A')).toBe('A');
    expect(parseNoteName('B')).toBe('B');
  });

  it('parses sharp notes', () => {
    expect(parseNoteName('C#')).toBe('Cs');
    expect(parseNoteName('F#')).toBe('Fs');
    expect(parseNoteName('G#')).toBe('Gs');
  });

  it('parses flat notes', () => {
    expect(parseNoteName('Eb')).toBe('Ds');
    expect(parseNoteName('Bb')).toBe('As');
    expect(parseNoteName('Ab')).toBe('Gs');
    expect(parseNoteName('Db')).toBe('Cs');
    expect(parseNoteName('Gb')).toBe('Fs');
  });

  it('returns null for invalid input', () => {
    expect(parseNoteName('')).toBeNull();
    expect(parseNoteName('H')).toBeNull();
    expect(parseNoteName('Cx')).toBeNull();
    expect(parseNoteName('123')).toBeNull();
  });

  it('is case-sensitive (lowercase fails)', () => {
    expect(parseNoteName('c')).toBeNull();
    expect(parseNoteName('eb')).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/engine/chordSpelling.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement parseNoteName**

Create `src/engine/chordSpelling.ts`:

```typescript
import type { PitchClass, ChordType, ChordSymbol, ParseResult } from '../types';
import { resolveRoot } from './parser';
import { pitchClassToInt, chordIntervals } from './musicTheory';

export function parseNoteName(input: string): PitchClass | null {
  if (input.length === 0 || input.length > 2) return null;
  const letter = input[0]!;
  if (!/[A-G]/.test(letter)) return null;
  const accidental = input.length === 2 ? input[1]! : null;
  if (accidental !== null && accidental !== '#' && accidental !== 'b') return null;
  return resolveRoot(letter, accidental);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/engine/chordSpelling.test.ts`
Expected: All `parseNoteName` tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/engine/parser.ts src/engine/chordSpelling.ts src/engine/chordSpelling.test.ts
git commit -m "feat: add parseNoteName for chord spelling"
```

---

### Task 3: Reverse Chord Identification

**Files:**
- Modify: `src/engine/chordSpelling.ts`
- Modify: `src/engine/chordSpelling.test.ts`

- [ ] **Step 1: Write failing tests for identifyChord**

Append to `src/engine/chordSpelling.test.ts`:

```typescript
import { parseNoteName, identifyChord } from './chordSpelling';
import type { PitchClass } from '../types';

describe('identifyChord', () => {
  function id(notes: string[]) {
    const pcs = notes.map(n => parseNoteName(n)!);
    return identifyChord(pcs);
  }

  it('identifies root position 7th chords', () => {
    expect(id(['C', 'E', 'G', 'B'])).toEqual({ root: 'C', quality: 'Maj7', inversion: 0 });
    expect(id(['F', 'A', 'C', 'Eb'])).toEqual({ root: 'F', quality: 'Dom7', inversion: 0 });
    expect(id(['D', 'F', 'A', 'C'])).toEqual({ root: 'D', quality: 'Min7', inversion: 0 });
    expect(id(['C', 'Eb', 'Gb', 'A'])).toEqual({ root: 'C', quality: 'Dim7', inversion: 0 });
    expect(id(['B', 'D', 'F', 'A'])).toEqual({ root: 'B', quality: 'HalfDim7', inversion: 0 });
    expect(id(['C', 'Eb', 'G', 'B'])).toEqual({ root: 'C', quality: 'MinMaj7', inversion: 0 });
  });

  it('identifies root position 6th chords', () => {
    expect(id(['C', 'E', 'G', 'A'])).toEqual({ root: 'C', quality: 'Maj6', inversion: 0 });
    expect(id(['C', 'Eb', 'G', 'A'])).toEqual({ root: 'C', quality: 'Min6', inversion: 0 });
  });

  it('identifies triads with doubled note', () => {
    expect(id(['C', 'E', 'G', 'C'])).toEqual({ root: 'C', quality: 'Major', inversion: 0 });
    expect(id(['A', 'C', 'E', 'A'])).toEqual({ root: 'A', quality: 'Minor', inversion: 0 });
    expect(id(['C', 'E', 'G', 'E'])).toEqual({ root: 'C', quality: 'Major', inversion: 0 });
  });

  it('detects inversions', () => {
    expect(id(['E', 'G', 'C', 'E'])).toEqual({ root: 'C', quality: 'Major', inversion: 1 });
    expect(id(['G', 'C', 'E', 'G'])).toEqual({ root: 'C', quality: 'Major', inversion: 2 });
    expect(id(['E', 'G', 'Bb', 'C'])).toEqual({ root: 'C', quality: 'Dom7', inversion: 1 });
    expect(id(['Bb', 'C', 'E', 'G'])).toEqual({ root: 'C', quality: 'Dom7', inversion: 3 });
  });

  it('returns null for unrecognized spellings', () => {
    expect(id(['C', 'D', 'E', 'F'])).toBeNull();
  });

  it('returns null for fewer than 3 distinct pitch classes', () => {
    expect(id(['C', 'C', 'C', 'E'])).toBeNull();
  });

  it('prefers root position over inversions', () => {
    // (C E G A) could be Am7 inv1 or C6 root — prefer C6 root
    expect(id(['C', 'E', 'G', 'A'])).toEqual({ root: 'C', quality: 'Maj6', inversion: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/chordSpelling.test.ts`
Expected: FAIL — `identifyChord` not exported.

- [ ] **Step 3: Implement identifyChord**

Add to `src/engine/chordSpelling.ts`:

```typescript
import { CHORD_TYPES } from '../types';

// Chord types eligible for reverse lookup (exclude 9th voicings that omit notes)
const LOOKUP_TYPES = CHORD_TYPES.filter(
  ct => !ct.startsWith('Dom9') && !ct.startsWith('Maj9') && !ct.startsWith('Min9')
);

// Priority order: prefer more specific chord types (7ths/6ths) over triads
const PRIORITY: ChordType[] = [
  'Maj7', 'Dom7', 'Min7', 'Maj6', 'Min6',
  'Dim7', 'HalfDim7', 'MinMaj7',
  'Major', 'Minor', 'Dim', 'Aug', 'Sus4', 'Sus2',
];

function normalizeIntervals(ct: ChordType): number[] {
  const raw = chordIntervals(ct);
  const mods = new Set(raw.map(i => ((i % 12) + 12) % 12));
  return [...mods].sort((a, b) => a - b);
}

interface ChordMatch {
  root: PitchClass;
  quality: ChordType;
  inversion: number;
}

export function identifyChord(pcs: PitchClass[]): ChordMatch | null {
  if (pcs.length !== 4) return null;

  const uniquePCs = [...new Set(pcs)];
  if (uniquePCs.length < 3) return null;

  const matches: ChordMatch[] = [];

  for (const candidateRoot of uniquePCs) {
    const rootInt = pitchClassToInt(candidateRoot);
    const intervals = uniquePCs
      .map(pc => ((pitchClassToInt(pc) - rootInt) % 12 + 12) % 12)
      .sort((a, b) => a - b);

    for (const ct of LOOKUP_TYPES) {
      const pattern = normalizeIntervals(ct);
      if (intervals.length !== pattern.length) continue;
      if (intervals.every((v, i) => v === pattern[i])) {
        // Determine inversion: position of first input note in the chord
        const firstPC = pcs[0]!;
        let inversion = 0;
        if (firstPC !== candidateRoot) {
          const chordPCOrder = pattern.map(
            interval => pitchClassFromInt(rootInt + interval)
          );
          const bassIdx = chordPCOrder.indexOf(firstPC);
          inversion = bassIdx >= 0 ? bassIdx : 0;
        }
        matches.push({ root: candidateRoot, quality: ct, inversion });
      }
    }
  }

  if (matches.length === 0) return null;

  // Prefer root position, then by priority order
  matches.sort((a, b) => {
    if (a.inversion === 0 && b.inversion !== 0) return -1;
    if (a.inversion !== 0 && b.inversion === 0) return 1;
    return PRIORITY.indexOf(a.quality) - PRIORITY.indexOf(b.quality);
  });

  return matches[0]!;
}
```

Also add the missing import at the top of `chordSpelling.ts`:

```typescript
import { pitchClassToInt, pitchClassFromInt, chordIntervals } from './musicTheory';
```

(Replace the earlier import line that only had `pitchClassToInt` and `chordIntervals`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/chordSpelling.test.ts`
Expected: All `identifyChord` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/chordSpelling.ts src/engine/chordSpelling.test.ts
git commit -m "feat: add reverse chord identification from pitch classes"
```

---

### Task 4: parseSpelledChord

**Files:**
- Modify: `src/engine/chordSpelling.ts`
- Modify: `src/engine/chordSpelling.test.ts`

- [ ] **Step 1: Write failing tests for parseSpelledChord**

Append to `src/engine/chordSpelling.test.ts`:

```typescript
import { parseNoteName, identifyChord, parseSpelledChord } from './chordSpelling';

describe('parseSpelledChord', () => {
  it('parses a recognized 7th chord', () => {
    const result = parseSpelledChord('(C E G B)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.root).toBe('C');
    expect(result.value.quality).toBe('Maj7');
    expect(result.value.inversion).toBe(0);
    expect(result.value.explicitVoicing).toEqual(['C', 'E', 'G', 'B']);
    expect(result.value.warning).toBeFalsy();
  });

  it('parses a chord with flats', () => {
    const result = parseSpelledChord('(F A C Eb)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.root).toBe('F');
    expect(result.value.quality).toBe('Dom7');
    expect(result.value.explicitVoicing).toEqual(['F', 'A', 'C', 'Ds']);
  });

  it('detects inversion from note order', () => {
    const result = parseSpelledChord('(E G C E)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.root).toBe('C');
    expect(result.value.quality).toBe('Major');
    expect(result.value.inversion).toBe(1);
  });

  it('sets warning for unrecognized spellings', () => {
    const result = parseSpelledChord('(C D E F)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warning).toBe(true);
    expect(result.value.root).toBe('C');
    expect(result.value.explicitVoicing).toEqual(['C', 'D', 'E', 'F']);
  });

  it('sets warning for too few distinct pitch classes', () => {
    const result = parseSpelledChord('(C C C E)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warning).toBe(true);
  });

  it('fails for wrong number of notes', () => {
    expect(parseSpelledChord('(C E G)').ok).toBe(false);
    expect(parseSpelledChord('(C D E F G)').ok).toBe(false);
  });

  it('fails for empty parens', () => {
    expect(parseSpelledChord('()').ok).toBe(false);
  });

  it('fails for invalid note names', () => {
    expect(parseSpelledChord('(C E G H)').ok).toBe(false);
  });

  it('handles sharps and flats producing same pitch class', () => {
    const sharp = parseSpelledChord('(C E G# B)');
    const flat = parseSpelledChord('(C E Ab B)');
    expect(sharp.ok).toBe(true);
    expect(flat.ok).toBe(true);
    if (!sharp.ok || !flat.ok) return;
    expect(sharp.value.quality).toBe(flat.value.quality);
    expect(sharp.value.root).toBe(flat.value.root);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/chordSpelling.test.ts`
Expected: FAIL — `parseSpelledChord` not exported.

- [ ] **Step 3: Implement parseSpelledChord**

Add to `src/engine/chordSpelling.ts`:

```typescript
export function parseSpelledChord(input: string): ParseResult<ChordSymbol> {
  // Strip parentheses
  let inner = input.trim();
  if (inner.startsWith('(')) inner = inner.slice(1);
  if (inner.endsWith(')')) inner = inner.slice(0, -1);
  inner = inner.trim();

  if (inner.length === 0) {
    return { ok: false, error: 'Empty spelled chord' };
  }

  const noteTokens = inner.split(/\s+/);
  if (noteTokens.length !== 4) {
    return { ok: false, error: `Expected 4 notes, got ${noteTokens.length}` };
  }

  const pcs: PitchClass[] = [];
  for (const token of noteTokens) {
    const pc = parseNoteName(token);
    if (pc === null) {
      return { ok: false, error: `Invalid note: '${token}'` };
    }
    pcs.push(pc);
  }

  const match = identifyChord(pcs);

  if (match === null) {
    // Unrecognized — return with warning
    return {
      ok: true,
      value: {
        root: pcs[0]!,
        quality: 'Major',
        inversion: 0,
        explicitVoicing: pcs,
        warning: true,
      },
    };
  }

  return {
    ok: true,
    value: {
      root: match.root,
      quality: match.quality,
      inversion: match.inversion,
      explicitVoicing: pcs,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/chordSpelling.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/engine/chordSpelling.ts src/engine/chordSpelling.test.ts
git commit -m "feat: add parseSpelledChord for parenthesized note input"
```

---

### Task 5: Tokenizer and Parser Integration

**Files:**
- Modify: `src/engine/parser.ts:53-58`
- Modify: `src/engine/parser.test.ts`

- [ ] **Step 1: Write failing integration tests**

Append to `src/engine/parser.test.ts`:

```typescript
import { tokenizeChordInput } from './parser';

describe('tokenizeChordInput', () => {
  it('tokenizes plain chord sequence', () => {
    expect(tokenizeChordInput('Cmaj7 Am7')).toEqual(['Cmaj7', ' ', 'Am7']);
  });

  it('groups parenthesized notes as single tokens', () => {
    expect(tokenizeChordInput('Cmaj7 (F A C Eb) Dm7')).toEqual([
      'Cmaj7', ' ', '(F A C Eb)', ' ', 'Dm7'
    ]);
  });

  it('handles adjacent spelled chords', () => {
    expect(tokenizeChordInput('(C E G B) (F A C Eb)')).toEqual([
      '(C E G B)', ' ', '(F A C Eb)'
    ]);
  });

  it('handles unclosed paren as single failed token', () => {
    const tokens = tokenizeChordInput('(C E G');
    expect(tokens).toEqual(['(C E G']);
  });

  it('handles empty parens', () => {
    expect(tokenizeChordInput('()')).toEqual(['()']);
  });

  it('preserves multiple spaces', () => {
    expect(tokenizeChordInput('C   Am')).toEqual(['C', '   ', 'Am']);
  });
});

describe('parseChordSequence with spelled chords', () => {
  it('parses mixed sequence', () => {
    const results = parseChordSequence('Cmaj7 (F A C Eb) Dm7');
    expect(results.length).toBe(3);
    expect(results[0]!.ok).toBe(true);
    if (results[0]!.ok) {
      expect(results[0]!.value.quality).toBe('Maj7');
      expect(results[0]!.value.explicitVoicing).toBeUndefined();
    }
    expect(results[1]!.ok).toBe(true);
    if (results[1]!.ok) {
      expect(results[1]!.value.root).toBe('F');
      expect(results[1]!.value.quality).toBe('Dom7');
      expect(results[1]!.value.explicitVoicing).toBeDefined();
    }
    expect(results[2]!.ok).toBe(true);
    if (results[2]!.ok) {
      expect(results[2]!.value.quality).toBe('Min7');
    }
  });

  it('parses all-spelled sequence', () => {
    const results = parseChordSequence('(C E G B) (F A C Eb)');
    expect(results.length).toBe(2);
    expect(results.every(r => r.ok)).toBe(true);
  });

  it('handles empty input', () => {
    expect(parseChordSequence('')).toEqual([]);
  });

  it('handles unclosed paren as parse error', () => {
    const results = parseChordSequence('(C E G');
    expect(results.length).toBe(1);
    expect(results[0]!.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/parser.test.ts`
Expected: FAIL — `tokenizeChordInput` not exported, and `parseChordSequence` doesn't handle parens yet.

- [ ] **Step 3: Implement tokenizeChordInput and update parseChordSequence**

In `src/engine/parser.ts`, add at the top the new import:

```typescript
import { parseSpelledChord } from './chordSpelling';
```

Add the tokenizer function:

```typescript
export function tokenizeChordInput(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] === '(') {
      const end = input.indexOf(')', i);
      if (end === -1) {
        // Unclosed paren — take rest as single token
        tokens.push(input.slice(i));
        break;
      }
      tokens.push(input.slice(i, end + 1));
      i = end + 1;
    } else if (/\s/.test(input[i]!)) {
      let j = i;
      while (j < input.length && /\s/.test(input[j]!)) j++;
      tokens.push(input.slice(i, j));
      i = j;
    } else {
      let j = i;
      while (j < input.length && !/[\s(]/.test(input[j]!)) j++;
      tokens.push(input.slice(i, j));
      i = j;
    }
  }
  return tokens;
}
```

Replace the existing `parseChordSequence`:

```typescript
export function parseChordSequence(input: string): ParseResult<ChordSymbol>[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];
  const tokens = tokenizeChordInput(trimmed).filter(t => !/^\s+$/.test(t));
  return tokens.map(token =>
    token.startsWith('(') ? parseSpelledChord(token) : parseChord(token)
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/parser.test.ts`
Expected: All tests pass (new + existing).

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/engine/parser.ts src/engine/parser.test.ts
git commit -m "feat: integrate spelled chord parsing into chord sequence parser"
```

---

### Task 6: Octave Assignment and Voice Leading Integration

**Files:**
- Modify: `src/engine/voiceLeading.ts:117-157`
- Modify: `src/engine/voiceLeading.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/engine/voiceLeading.test.ts`:

```typescript
import { assignOctaves } from './voiceLeading';
import { pitchToMidi } from './musicTheory';

describe('assignOctaves', () => {
  it('assigns ascending octaves centered on gravity', () => {
    // (C E G B) centered on A3 (MIDI 57)
    const pitches = assignOctaves(['C', 'E', 'G', 'B'], 57);
    const midis = pitches.map(pitchToMidi);
    // Each note must be higher than the previous
    for (let i = 1; i < midis.length; i++) {
      expect(midis[i]!).toBeGreaterThan(midis[i - 1]!);
    }
    // Mean should be close to gravity center
    const mean = midis.reduce((a, b) => a + b, 0) / midis.length;
    expect(Math.abs(mean - 57)).toBeLessThan(12);
  });

  it('handles descending pitch class order by wrapping octaves', () => {
    // (G E C B) — G lower, then E, C, B ascending
    const pitches = assignOctaves(['G', 'E', 'C', 'B'], 57);
    const midis = pitches.map(pitchToMidi);
    for (let i = 1; i < midis.length; i++) {
      expect(midis[i]!).toBeGreaterThan(midis[i - 1]!);
    }
  });

  it('returns exactly 4 pitches', () => {
    const pitches = assignOctaves(['F', 'A', 'C', 'Ds'], 57);
    expect(pitches.length).toBe(4);
  });
});

describe('voiceChordSequence with explicitVoicing', () => {
  it('uses explicit voicing and skips voice leading', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Maj7', inversion: null },
      { root: 'F', quality: 'Dom7', inversion: 0, explicitVoicing: ['F', 'A', 'C', 'Ds'] },
      { root: 'D', quality: 'Min7', inversion: null },
    ];
    const voicings = voiceChordSequence('equal', chords);
    expect(voicings.length).toBe(3);

    // Second voicing should use explicit notes
    const explicitMidis = voicings[1]!.map(pitchToMidi);
    // All pitches should be F, A, C, Ds in some octaves
    expect(voicings[1]!.map(p => p.pitchClass)).toEqual(['F', 'A', 'C', 'Ds']);
    // And ascending
    for (let i = 1; i < explicitMidis.length; i++) {
      expect(explicitMidis[i]!).toBeGreaterThan(explicitMidis[i - 1]!);
    }
  });
});
```

Add the needed import at the top of `voiceLeading.test.ts`:

```typescript
import type { ChordSymbol } from '../types';
import { voiceChordSequence, assignOctaves } from './voiceLeading';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/voiceLeading.test.ts`
Expected: FAIL — `assignOctaves` not exported.

- [ ] **Step 3: Implement assignOctaves**

Add to `src/engine/voiceLeading.ts`:

```typescript
export function assignOctaves(pcs: PitchClass[], gravityCenter: number): Pitch[] {
  let bestPitches: Pitch[] = [];
  let bestDiff = Infinity;

  for (let startOct = 2; startOct <= 5; startOct++) {
    const pitches: Pitch[] = [];
    let prevMidi = -Infinity;

    for (const pc of pcs) {
      const pcInt = pitchClassToInt(pc);
      let midi = (startOct + 1) * 12 + pcInt;
      while (midi <= prevMidi) midi += 12;
      pitches.push(midiToPitch(midi));
      prevMidi = midi;
    }

    const mean = pitches.reduce((sum, p) => sum + pitchToMidi(p), 0) / pitches.length;
    const diff = Math.abs(mean - gravityCenter);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestPitches = pitches;
    }
  }

  return bestPitches;
}
```

Note: `midiToPitch` needs to be imported. Check the existing import line in `voiceLeading.ts` and add it if not present:

```typescript
import { pitchToMidi, midiToPitch, nearestPitch, voiceChord, chordPitchClasses, pitchClassToInt } from './musicTheory';
```

- [ ] **Step 4: Update voiceChordSequence to handle explicitVoicing**

In `src/engine/voiceLeading.ts`, modify `voiceChordSequence`. The function currently processes chords in a loop at lines 144-154. Update it to handle `explicitVoicing`:

Replace the body of `voiceChordSequence` with:

```typescript
export function voiceChordSequence(
  mode: SmoothMode | null,
  chords: ChordSymbol[],
  options?: VoiceLeadingOptions,
): Pitch[][] {
  if (chords.length === 0) return [];
  const { gravityCenter = DEFAULT_GRAVITY_CENTER } = options ?? {};

  function voiceExplicit(chord: ChordSymbol): Pitch[] {
    return assignOctaves(chord.explicitVoicing!, gravityCenter);
  }

  if (mode === null) {
    return chords.map(c =>
      c.explicitVoicing ? voiceExplicit(c) : voiceChord(c.root, c.quality, c.inversion ?? 0)
    );
  }

  const first = chords[0]!;
  let firstVoicing: Pitch[];
  if (first.explicitVoicing) {
    firstVoicing = voiceExplicit(first);
  } else {
    const baseVoicing = voiceChord(first.root, first.quality, first.inversion ?? 0);
    const baseMidis = baseVoicing.map(pitchToMidi);
    const baseCentroid = baseMidis.reduce((a, b) => a + b, 0) / baseMidis.length;
    const shiftSemitones = Math.round((gravityCenter - baseCentroid) / 12) * 12;
    firstVoicing = shiftSemitones === 0
      ? baseVoicing
      : baseVoicing.map(p => midiToPitch(pitchToMidi(p) + shiftSemitones));
  }

  const result: Pitch[][] = [firstVoicing];

  let prev = firstVoicing;
  for (let i = 1; i < chords.length; i++) {
    const chord = chords[i]!;
    let voicing: Pitch[];
    if (chord.explicitVoicing) {
      voicing = voiceExplicit(chord);
    } else if (chord.inversion !== null) {
      voicing = voiceChord(chord.root, chord.quality, chord.inversion);
    } else {
      voicing = smoothVoice(mode, prev, chordPitchClasses(chord.root, chord.quality), options);
    }
    result.push(voicing);
    prev = voicing;
  }

  return result;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/engine/voiceLeading.test.ts`
Expected: All tests pass.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/engine/voiceLeading.ts src/engine/voiceLeading.test.ts
git commit -m "feat: add octave assignment and explicit voicing support in voice leading"
```

---

### Task 7: ChordInput Display Updates

**Files:**
- Modify: `src/components/ChordInput.tsx`

The `ChordInput` component needs three changes:
1. Use `tokenizeChordInput` for segment creation (so `(F A C E)` is one segment)
2. Add a `warning` state (amber color) alongside valid/invalid
3. Add a tooltip on spelled chords showing the identified chord name

- [ ] **Step 1: Update ChordInput to use tokenizer**

In `src/components/ChordInput.tsx`, add imports:

```typescript
import { tokenizeChordInput } from '../engine/parser';
import { chordDisplayName } from '../engine/chordSpelling';
```

Replace the `segments` useMemo (lines 40-57) with:

```typescript
  const segments = useMemo(() => {
    const tokens = tokenizeChordInput(value);
    let chordIdx = 0;

    return tokens.map(token => {
      if (/^\s+$/.test(token)) {
        return { text: token, isChord: false, isValid: true, isWarning: false, validIndex: -1, tooltip: undefined as string | undefined };
      }
      const result = parseResults[chordIdx];
      const isValid = result?.ok ?? false;
      const isWarning = isValid && !!(result as { ok: true; value: ChordSymbol }).value?.warning;
      const hasExplicit = isValid && !!(result as { ok: true; value: ChordSymbol }).value?.explicitVoicing;
      const tooltip = isValid && hasExplicit
        ? chordDisplayName((result as { ok: true; value: ChordSymbol }).value)
        : undefined;
      const validIndex = isValid
        ? parseResults.slice(0, chordIdx + 1).filter(r => r.ok).length - 1
        : -1;
      chordIdx++;
      return { text: token, isChord: true, isValid, isWarning, validIndex, tooltip };
    });
  }, [value, parseResults]);
```

- [ ] **Step 2: Update the overlay rendering**

Replace the overlay rendering (lines 75-84) with:

```tsx
          {segments.map((seg, i) => {
            if (!seg.isChord) return <span key={i}>{seg.text}</span>;
            const isActive = seg.validIndex === currentChordIndex;
            const cls = [
              'chord-token',
              isActive ? 'chord-active' : '',
              seg.isWarning ? 'chord-warning' : '',
              !seg.isValid ? 'chord-invalid' : '',
            ].filter(Boolean).join(' ');
            return <span key={i} className={cls} title={seg.tooltip}>{seg.text}</span>;
          })}
```

- [ ] **Step 3: Add chordDisplayName helper**

Add to `src/engine/chordSpelling.ts`:

```typescript
const QUALITY_DISPLAY: Record<ChordType, string> = {
  Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
  Dim: 'dim', Dim7: 'dim7', Aug: 'aug', HalfDim7: 'm7b5',
  Sus4: 'sus4', Sus2: 'sus2', MinMaj7: 'mMaj7', Maj6: '6', Min6: 'm6',
  Dom9no1: '9-1', Dom9no3: '9-3', Dom9no5: '9-5', Dom9no7: '9-7',
  Maj9no1: 'maj9-1', Maj9no3: 'maj9-3', Maj9no5: 'maj9-5', Maj9no7: 'maj9-7',
  Min9no1: 'm9-1', Min9no3: 'm9-3', Min9no5: 'm9-5', Min9no7: 'm9-7',
};

const PC_DISPLAY: Record<PitchClass, string> = {
  C: 'C', Cs: 'C♯', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'F♯', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};

export function chordDisplayName(chord: ChordSymbol): string {
  if (chord.warning) return '?';
  const root = PC_DISPLAY[chord.root] ?? chord.root;
  const quality = QUALITY_DISPLAY[chord.quality] ?? '';
  return `${root}${quality}`;
}
```

- [ ] **Step 4: Add CSS for warning state**

Find the CSS file used by the app (likely `src/App.css` or `src/index.css`). Search for `.chord-invalid` to find where chord colors are defined. Add alongside it:

```css
.chord-warning {
  color: #f0a030;
}
```

Run: `grep -rn 'chord-invalid' src/` to find the CSS file.

- [ ] **Step 5: Run the build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/ChordInput.tsx src/engine/chordSpelling.ts
git add -u  # catch CSS changes
git commit -m "feat: display spelled chords with warning state and tooltip"
```

---

### Task 8: Syntax Reference Update

**Files:**
- Modify: `src/components/SyntaxReference.tsx`

- [ ] **Step 1: Add spelled chord section**

In `src/components/SyntaxReference.tsx`, add a new section after the inversions section (before the closing `</div>` of `syntax-content`, around line 124):

```tsx
        <section className="spelled-section">
          <h3>Spelled Chords</h3>
          <p className="format-desc">
            Enter 4 notes in parentheses to spell a chord directly.
            The chord type is identified automatically.
          </p>
          <div className="format-example">
            <span className="fmt-root">(Note Note Note Note)</span>
          </div>
          <div className="quality-grid">
            <div className="quality-item">
              <span className="quality-display">F dom7</span>
              <code className="quality-code">(F A C Eb)</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">C maj7</span>
              <code className="quality-code">(C E G B)</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">D min7</span>
              <code className="quality-code">(D F A C)</code>
            </div>
          </div>
          <p className="format-desc">
            Notes are played in the order given (first = lowest pitch).
            Accidentals: <code>#</code> for sharp, <code>b</code> for flat.
          </p>
        </section>
```

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/SyntaxReference.tsx
git commit -m "docs: add spelled chord syntax to reference panel"
```

---

### Task 9: Clear Default Text and Final Verification

**Files:**
- Modify: `src/engine/urlState.ts:17`

- [ ] **Step 1: Clear default chord text**

In `src/engine/urlState.ts`, change line 17:

```typescript
  chordText: '',
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass. (The `urlState.test.ts` tests may need updating if they rely on the default text — check and fix if needed.)

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/engine/urlState.ts
git add -u  # catch any test fixes
git commit -m "ux: start with empty chord textarea instead of default progression"
```

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`

Verify:
1. Textarea starts empty
2. Type `Cmaj7 (F A C Eb) Dm7` — all three chords parse green
3. Hover over `(F A C Eb)` in overlay — tooltip shows "F7"
4. Type `(C D E F)` — appears amber (warning)
5. Play a sequence with spelled chords — they play at correct pitch
6. Voice leading still works for non-spelled chords around spelled ones
