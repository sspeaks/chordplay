# Chord Suggestions + Key Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chord suggestion panel that recommends next chords based on music theory, and auto-infer the key signature from the chord sequence.

**Architecture:** Two pure-function engine modules (key inference + chord scoring), two new React components (KeyBadge + ChordSuggestions), integrated into App.tsx. All music theory logic is pure and testable; UI components are thin wrappers.

**Tech Stack:** TypeScript, React 18, Vitest, plain CSS

---

## File Structure

| File | Responsibility |
|------|---------------|
| `web/src/engine/keyInference.ts` | Key detection algorithm — pure function, no React |
| `web/src/engine/keyInference.test.ts` | Unit tests for key inference |
| `web/src/engine/chordSuggestions.ts` | Chord scoring/ranking engine — pure function |
| `web/src/engine/chordSuggestions.test.ts` | Unit tests for chord suggestions |
| `web/src/components/KeyBadge.tsx` | Inline key indicator with dropdown override |
| `web/src/components/ChordSuggestions.tsx` | Suggestion panel with preview/insert chips |
| `web/src/App.tsx` | Wire up new state, components, callbacks |
| `web/src/styles/index.css` | Styles for KeyBadge and ChordSuggestions |

---

### Task 1: Key Inference Engine

**Files:**
- Create: `web/src/engine/keyInference.ts`
- Test: `web/src/engine/keyInference.test.ts`

- [ ] **Step 1: Write failing tests for key inference**

Create `web/src/engine/keyInference.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { inferKey } from './keyInference';
import type { ChordSymbol, KeySignature } from '../types';

function chord(root: string, quality: string = 'Major'): ChordSymbol {
  return { root: root as any, quality: quality as any, inversion: null };
}

describe('inferKey', () => {
  it('returns C major for I-vi-ii-V in C', () => {
    const chords = [chord('C'), chord('A', 'Minor'), chord('D', 'Minor'), chord('G', 'Dom7')];
    const result = inferKey(chords);
    expect(result).toEqual({ root: 'C', quality: 'major' });
  });

  it('returns G major for I-IV-V-I in G', () => {
    const chords = [chord('G'), chord('C'), chord('D', 'Dom7'), chord('G')];
    const result = inferKey(chords);
    expect(result).toEqual({ root: 'G', quality: 'major' });
  });

  it('returns A minor for i-iv-V-i in Am', () => {
    const chords = [chord('A', 'Minor'), chord('D', 'Minor'), chord('E', 'Dom7'), chord('A', 'Minor')];
    const result = inferKey(chords);
    expect(result).toEqual({ root: 'A', quality: 'minor' });
  });

  it('returns C major for the default chord sequence', () => {
    // Cmaj7 Am7 Dm7 G7 Em7 A7 Dm7 G7 Cmaj7 C7 Fmaj7 Fm6 Cmaj7 Am7 Dm7 G7 Cmaj7
    const chords = [
      chord('C', 'Maj7'), chord('A', 'Min7'), chord('D', 'Min7'), chord('G', 'Dom7'),
      chord('E', 'Min7'), chord('A', 'Dom7'), chord('D', 'Min7'), chord('G', 'Dom7'),
      chord('C', 'Maj7'), chord('C', 'Dom7'), chord('F', 'Maj7'), chord('F', 'Min6'),
      chord('C', 'Maj7'), chord('A', 'Min7'), chord('D', 'Min7'), chord('G', 'Dom7'),
      chord('C', 'Maj7'),
    ];
    const result = inferKey(chords);
    expect(result).toEqual({ root: 'C', quality: 'major' });
  });

  it('prefers major over minor when scores tie', () => {
    const chords = [chord('C'), chord('G')];
    const result = inferKey(chords);
    expect(result.quality).toBe('major');
  });

  it('handles single chord by returning that root as major', () => {
    const chords = [chord('E', 'Minor')];
    const result = inferKey(chords);
    // Single chord — use the root as the key
    expect(result.root).toBe('E');
  });

  it('returns F major for F-Bb-C-F', () => {
    const chords = [chord('F'), chord('As'), chord('C'), chord('F')];
    const result = inferKey(chords);
    expect(result).toEqual({ root: 'F', quality: 'major' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npx vitest run src/engine/keyInference.test.ts
```

Expected: FAIL — `keyInference.ts` doesn't exist yet.

- [ ] **Step 3: Implement key inference engine**

Create `web/src/engine/keyInference.ts`:

```typescript
import { PITCH_CLASSES, type PitchClass, type ChordSymbol, type KeySignature } from '../types';
import { pitchClassToInt, pitchClassFromInt } from './musicTheory';

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10] as const;

// Harmonic importance weights by scale degree (1-indexed)
// I=4, ii=1, iii=1, IV=2, V=3, vi=1, vii=1
const DEGREE_WEIGHTS: Record<number, number> = {
  1: 4, // tonic
  2: 1,
  3: 1,
  4: 2, // subdominant
  5: 3, // dominant
  6: 1,
  7: 1,
};

function scaleContains(scaleRoot: number, scale: readonly number[], pc: number): number | null {
  const interval = ((pc - scaleRoot) % 12 + 12) % 12;
  const degree = scale.indexOf(interval);
  return degree !== -1 ? degree + 1 : null;
}

function scoreKey(chords: ChordSymbol[], root: PitchClass, quality: 'major' | 'minor'): number {
  const rootInt = pitchClassToInt(root);
  const scale = quality === 'major' ? MAJOR_SCALE : MINOR_SCALE;

  let score = 0;
  for (const chord of chords) {
    const pcInt = pitchClassToInt(chord.root);
    const degree = scaleContains(rootInt, scale, pcInt);
    if (degree !== null) {
      score += DEGREE_WEIGHTS[degree] ?? 1;
    }
  }
  return score;
}

// Count of accidentals in the key signature (fewer = simpler)
const KEY_COMPLEXITY: Record<string, number> = {
  'C-major': 0, 'G-major': 1, 'F-major': 1, 'D-major': 2, 'As-major': 2,
  'A-major': 3, 'Ds-major': 3, 'E-major': 4, 'Gs-major': 4,
  'B-major': 5, 'Cs-major': 5, 'Fs-major': 6,
  'A-minor': 0, 'E-minor': 1, 'D-minor': 1, 'B-minor': 2, 'G-minor': 2,
  'Fs-minor': 3, 'C-minor': 3, 'Cs-minor': 4, 'F-minor': 4,
  'Gs-minor': 5, 'As-minor': 5, 'Ds-minor': 6,
};

export function inferKey(chords: ChordSymbol[]): KeySignature {
  if (chords.length === 0) {
    return { root: 'C', quality: 'major' };
  }

  let bestKey: KeySignature = { root: 'C', quality: 'major' };
  let bestScore = -1;
  let bestComplexity = Infinity;

  const qualities: ('major' | 'minor')[] = ['major', 'minor'];

  for (const root of PITCH_CLASSES) {
    for (const quality of qualities) {
      const score = scoreKey(chords, root, quality);
      const complexity = KEY_COMPLEXITY[`${root}-${quality}`] ?? 6;

      if (
        score > bestScore ||
        (score === bestScore && quality === 'major' && bestKey.quality === 'minor') ||
        (score === bestScore && quality === bestKey.quality && complexity < bestComplexity)
      ) {
        bestScore = score;
        bestKey = { root, quality };
        bestComplexity = complexity;
      }
    }
  }

  return bestKey;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && npx vitest run src/engine/keyInference.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/keyInference.ts web/src/engine/keyInference.test.ts
git commit -m "feat: add key inference engine

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Chord Suggestion Engine

**Files:**
- Create: `web/src/engine/chordSuggestions.ts`
- Test: `web/src/engine/chordSuggestions.test.ts`

- [ ] **Step 1: Write failing tests for chord suggestion scoring**

Create `web/src/engine/chordSuggestions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateSuggestions, scoreChord, chordSymbolToText } from './chordSuggestions';
import type { ChordSymbol, KeySignature } from '../types';

function chord(root: string, quality: string = 'Major'): ChordSymbol {
  return { root: root as any, quality: quality as any, inversion: null };
}

const C_MAJOR: KeySignature = { root: 'C', quality: 'major' };

describe('scoreChord', () => {
  it('scores circle-of-fifths resolution highest', () => {
    // G7 → C should score very high (G is a 5th above C)
    const current = chord('G', 'Dom7');
    const candidate = chord('C');
    const score = scoreChord(current, candidate, C_MAJOR);
    expect(score).toBeGreaterThanOrEqual(35);
  });

  it('scores seventh resolution for chords containing the resolved note', () => {
    // G7 has F as its 7th. C major contains E (F resolves down to E).
    const current = chord('G', 'Dom7');
    const cMaj = chord('C');
    const dMin = chord('D', 'Minor'); // D minor contains F, not E
    const cScore = scoreChord(current, cMaj, C_MAJOR);
    const dScore = scoreChord(current, dMin, C_MAJOR);
    expect(cScore).toBeGreaterThan(dScore);
  });

  it('scores diatonic chords higher than non-diatonic', () => {
    const current = chord('C');
    const diatonic = chord('G'); // V in C major
    const nonDiatonic = chord('Gs'); // not in C major
    const diaScore = scoreChord(current, diatonic, C_MAJOR);
    const nonDiaScore = scoreChord(current, nonDiatonic, C_MAJOR);
    expect(diaScore).toBeGreaterThan(nonDiaScore);
  });

  it('scores secondary dominants', () => {
    const current = chord('C');
    const secDom = chord('A', 'Dom7'); // V/ii in C major
    const plain = chord('A'); // A major — not diatonic, no sec dom
    const secScore = scoreChord(current, secDom, C_MAJOR);
    const plainScore = scoreChord(current, plain, C_MAJOR);
    expect(secScore).toBeGreaterThan(plainScore);
  });

  it('scores same-root quality change', () => {
    const current = chord('C');
    const sameRoot = chord('C', 'Dom7'); // C → C7
    const diffRoot = chord('Fs', 'Dom7'); // F# → unrelated
    const sameScore = scoreChord(current, sameRoot, C_MAJOR);
    const diffScore = scoreChord(current, diffRoot, C_MAJOR);
    expect(sameScore).toBeGreaterThan(diffScore);
  });
});

describe('generateSuggestions', () => {
  it('returns 5-10 suggestions', () => {
    const current = chord('G', 'Dom7');
    const suggestions = generateSuggestions(current, C_MAJOR);
    expect(suggestions.length).toBeGreaterThanOrEqual(5);
    expect(suggestions.length).toBeLessThanOrEqual(10);
  });

  it('does not include the current chord', () => {
    const current = chord('G', 'Dom7');
    const suggestions = generateSuggestions(current, C_MAJOR);
    const hasCurrentChord = suggestions.some(
      s => s.chord.root === 'G' && s.chord.quality === 'Dom7'
    );
    expect(hasCurrentChord).toBe(false);
  });

  it('ranks C or Cmaj7 first after G7 in C major', () => {
    const current = chord('G', 'Dom7');
    const suggestions = generateSuggestions(current, C_MAJOR);
    const topRoot = suggestions[0]!.chord.root;
    expect(topRoot).toBe('C');
  });

  it('returns suggestions sorted by score descending', () => {
    const current = chord('C');
    const suggestions = generateSuggestions(current, C_MAJOR);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i]!.score).toBeLessThanOrEqual(suggestions[i - 1]!.score);
    }
  });
});

describe('chordSymbolToText', () => {
  it('converts Major chord', () => {
    expect(chordSymbolToText(chord('C'))).toBe('C');
  });

  it('converts Dom7 chord', () => {
    expect(chordSymbolToText(chord('G', 'Dom7'))).toBe('G7');
  });

  it('converts Min7 chord with sharp root', () => {
    expect(chordSymbolToText(chord('Fs', 'Min7'))).toBe('F#m7');
  });

  it('converts Maj7 chord', () => {
    expect(chordSymbolToText(chord('C', 'Maj7'))).toBe('Cmaj7');
  });

  it('converts Minor chord with flat root', () => {
    expect(chordSymbolToText(chord('As', 'Minor'))).toBe('Bbm');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npx vitest run src/engine/chordSuggestions.test.ts
```

Expected: FAIL — `chordSuggestions.ts` doesn't exist yet.

- [ ] **Step 3: Implement chord suggestion engine**

Create `web/src/engine/chordSuggestions.ts`:

```typescript
import {
  PITCH_CLASSES,
  type PitchClass,
  type ChordType,
  type ChordSymbol,
  type KeySignature,
} from '../types';
import { pitchClassToInt, pitchClassFromInt, chordIntervals } from './musicTheory';

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10] as const;

const SUGGESTION_QUALITIES: ChordType[] = ['Major', 'Minor', 'Dom7', 'Maj7', 'Min7'];

// Display names for roots (uses sharps for sharp-preferring roots, flats otherwise)
const ROOT_DISPLAY: Record<PitchClass, string> = {
  C: 'C', Cs: 'C#', D: 'D', Ds: 'Eb', E: 'E', F: 'F',
  Fs: 'F#', G: 'G', Gs: 'Ab', A: 'A', As: 'Bb', B: 'B',
};

const QUALITY_SUFFIX: Record<ChordType, string> = {
  Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
  Dim: 'dim', Dim7: 'dim7', Aug: 'aug', HalfDim7: 'm7b5',
  Sus4: 'sus4', Sus2: 'sus2', MinMaj7: 'mMaj7', Maj6: '6', Min6: 'm6',
  Dom9no1: '9-1', Dom9no3: '9-3', Dom9no5: '9-5', Dom9no7: '9-7',
  Maj9no1: 'maj9-1', Maj9no3: 'maj9-3', Maj9no5: 'maj9-5', Maj9no7: 'maj9-7',
  Min9no1: 'm9-1', Min9no3: 'm9-3', Min9no5: 'm9-5', Min9no7: 'm9-7',
};

export interface ScoredSuggestion {
  chord: ChordSymbol;
  text: string;
  score: number;
}

function getScaleIntervals(quality: 'major' | 'minor'): readonly number[] {
  return quality === 'major' ? MAJOR_SCALE : MINOR_SCALE;
}

function isDiatonic(pc: PitchClass, key: KeySignature): boolean {
  const rootInt = pitchClassToInt(key.root);
  const pcInt = pitchClassToInt(pc);
  const interval = ((pcInt - rootInt) % 12 + 12) % 12;
  return getScaleIntervals(key.quality).includes(interval);
}

/** Convert a ChordSymbol to display text (e.g. {root:'G', quality:'Dom7'} → "G7") */
export function chordSymbolToText(chord: ChordSymbol): string {
  return ROOT_DISPLAY[chord.root] + QUALITY_SUFFIX[chord.quality];
}

/**
 * Score a candidate chord given the current chord and key.
 * Returns a number from 0–100+ (higher = more relevant suggestion).
 */
export function scoreChord(
  current: ChordSymbol,
  candidate: ChordSymbol,
  key: KeySignature,
): number {
  let score = 0;
  const curRoot = pitchClassToInt(current.root);
  const candRoot = pitchClassToInt(candidate.root);

  // 1. Circle-of-fifths resolution (0–35 pts)
  // Current root is a perfect 5th above candidate root
  const fifthDown = ((curRoot - candRoot) % 12 + 12) % 12;
  if (fifthDown === 7) {
    score += 35;
  }
  // Tritone substitution: candidate root is a tritone from the fifth-resolution target
  const fifthTarget = ((curRoot - 7) % 12 + 12) % 12;
  const tritoneFromTarget = ((candRoot - fifthTarget) % 12 + 12) % 12;
  if (tritoneFromTarget === 6 && fifthDown !== 7) {
    score += 15;
  }

  // 2. Seventh resolution (0–30 pts)
  // If current chord has a 7th interval, reward candidates that contain
  // the note the 7th resolves down to (semitone below the 7th)
  const curIntervals = chordIntervals(current.quality);
  const has7th = curIntervals.some(i => {
    const normalized = ((i % 12) + 12) % 12;
    return normalized === 10 || normalized === 11; // minor 7th or major 7th
  });
  if (has7th) {
    // Find the 7th pitch class
    const seventh = curIntervals.find(i => {
      const n = ((i % 12) + 12) % 12;
      return n === 10 || n === 11;
    })!;
    const seventhPC = (curRoot + seventh) % 12;
    // Resolution target: one semitone below the 7th
    const resolvedPC = ((seventhPC - 1) % 12 + 12) % 12;

    // Check if candidate chord contains the resolution target
    const candIntervals = chordIntervals(candidate.quality);
    const candPCs = candIntervals.map(i => ((candRoot + i) % 12 + 12) % 12);
    if (candPCs.includes(resolvedPC)) {
      score += 30;
    }
  }

  // 3. Diatonic membership (0–20 pts)
  if (isDiatonic(candidate.root, key)) {
    score += 20;
  }

  // 4. Secondary dominant potential (0–15 pts)
  // Candidate is Dom7 and its root is a perfect 5th above some diatonic root
  if (candidate.quality === 'Dom7') {
    const targetRoot = pitchClassFromInt((candRoot - 7 + 12) % 12);
    if (isDiatonic(targetRoot, key)) {
      score += 15;
    }
  }

  // 5. Same-root quality change (0–15 pts)
  if (current.root === candidate.root && current.quality !== candidate.quality) {
    score += 15;
  }

  return score;
}

/**
 * Generate ranked chord suggestions given the current chord and key.
 * Returns 5–10 suggestions sorted by score descending.
 */
export function generateSuggestions(
  current: ChordSymbol,
  key: KeySignature,
): ScoredSuggestion[] {
  const candidates: ScoredSuggestion[] = [];

  for (const root of PITCH_CLASSES) {
    for (const quality of SUGGESTION_QUALITIES) {
      // Skip the current chord
      if (root === current.root && quality === current.quality) continue;

      const candidate: ChordSymbol = { root, quality, inversion: null };
      const score = scoreChord(current, candidate, key);
      candidates.push({
        chord: candidate,
        text: chordSymbolToText(candidate),
        score,
      });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Take top suggestions: at least 5, up to 10
  // Include all candidates that share the score of the 5th item, up to 10
  const minCount = 5;
  const maxCount = 10;
  if (candidates.length <= minCount) return candidates;

  const cutoffScore = candidates[minCount - 1]!.score;
  let count = minCount;
  while (count < maxCount && count < candidates.length && candidates[count]!.score === cutoffScore) {
    count++;
  }

  return candidates.slice(0, count);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && npx vitest run src/engine/chordSuggestions.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/chordSuggestions.ts web/src/engine/chordSuggestions.test.ts
git commit -m "feat: add chord suggestion scoring engine

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Text Insertion Utility

This task adds the `insertChordAfterIndex` function that safely inserts chord text after a given valid-chord index in the raw text, handling duplicates and whitespace correctly.

**Files:**
- Modify: `web/src/engine/chordSuggestions.ts` (add function)
- Modify: `web/src/engine/chordSuggestions.test.ts` (add tests)

- [ ] **Step 1: Write failing tests for text insertion**

Append to `web/src/engine/chordSuggestions.test.ts`:

```typescript
import { insertChordAfterIndex } from './chordSuggestions';
import { parseChordSequence } from './parser';

describe('insertChordAfterIndex', () => {
  it('inserts after the first chord', () => {
    const pr = parseChordSequence('C G');
    expect(insertChordAfterIndex('C G', 0, 'Am', pr)).toBe('C Am G');
  });

  it('inserts after the last chord', () => {
    const pr = parseChordSequence('C G');
    expect(insertChordAfterIndex('C G', 1, 'Am', pr)).toBe('C G Am');
  });

  it('handles duplicate chord names by using index', () => {
    const pr = parseChordSequence('C G C');
    expect(insertChordAfterIndex('C G C', 0, 'Dm', pr)).toBe('C Dm G C');
  });

  it('handles duplicate chord names — insert after second instance', () => {
    const pr = parseChordSequence('C G C');
    expect(insertChordAfterIndex('C G C', 2, 'Dm', pr)).toBe('C G C Dm');
  });

  it('preserves multiple spaces', () => {
    const pr = parseChordSequence('C  G');
    expect(insertChordAfterIndex('C  G', 0, 'Am', pr)).toBe('C Am  G');
  });

  it('appends at end when index exceeds valid count', () => {
    const pr = parseChordSequence('C G');
    expect(insertChordAfterIndex('C G', 5, 'Am', pr)).toBe('C G Am');
  });

  it('works with single chord', () => {
    const pr = parseChordSequence('C');
    expect(insertChordAfterIndex('C', 0, 'G7', pr)).toBe('C G7');
  });

  it('skips invalid tokens when counting valid chord indices', () => {
    // "C xyz G" — xyz is invalid, so validIndex 0=C, 1=G
    const pr = parseChordSequence('C xyz G');
    expect(insertChordAfterIndex('C xyz G', 1, 'Am', pr)).toBe('C xyz G Am');
  });

  it('inserts after valid chord even with leading invalid token', () => {
    const pr = parseChordSequence('bad C G');
    // validIndex 0=C, 1=G
    expect(insertChordAfterIndex('bad C G', 0, 'Dm', pr)).toBe('bad C Dm G');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npx vitest run src/engine/chordSuggestions.test.ts
```

Expected: FAIL — `insertChordAfterIndex` not yet exported.

- [ ] **Step 3: Implement insertChordAfterIndex**

Add to `web/src/engine/chordSuggestions.ts`:

```typescript
import type { ParseResult } from '../types';

/**
 * Insert a chord symbol text after the valid-chord at `afterValidIndex`
 * in the raw chord text. Uses character-position mapping to handle
 * duplicate chord names safely. Requires parseResults to distinguish
 * valid from invalid tokens (currentChordIndex counts only valid chords).
 */
export function insertChordAfterIndex(
  chordText: string,
  afterValidIndex: number,
  newChordText: string,
  parseResults: ParseResult<any>[],
): string {
  const parts = chordText.split(/(\s+)/);
  let tokenIdx = 0; // index into parseResults (all non-whitespace tokens)
  let validIdx = 0; // index counting only valid chords
  let charPos = 0;

  for (const part of parts) {
    if (/^\s*$/.test(part)) {
      charPos += part.length;
      continue;
    }
    // This is a non-whitespace token
    const isValid = parseResults[tokenIdx]?.ok ?? false;
    if (isValid) {
      if (validIdx === afterValidIndex) {
        const insertPos = charPos + part.length;
        return chordText.slice(0, insertPos) + ' ' + newChordText + chordText.slice(insertPos);
      }
      validIdx++;
    }
    tokenIdx++;
    charPos += part.length;
  }

  // Fallback: append at end
  return chordText + ' ' + newChordText;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && npx vitest run src/engine/chordSuggestions.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/chordSuggestions.ts web/src/engine/chordSuggestions.test.ts
git commit -m "feat: add text insertion utility for chord suggestions

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: KeyBadge Component

**Files:**
- Create: `web/src/components/KeyBadge.tsx`
- Modify: `web/src/styles/index.css`

- [ ] **Step 1: Create KeyBadge component**

Create `web/src/components/KeyBadge.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';
import type { KeySignature, PitchClass, KeyQuality } from '../types';

const KEY_DISPLAY_NAMES: Record<PitchClass, string> = {
  C: 'C', Cs: 'C♯/D♭', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'F♯/G♭', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};

const KEY_OPTIONS: PitchClass[] = [
  'C', 'G', 'D', 'A', 'E', 'B', 'Fs', 'Cs', 'F', 'As', 'Ds', 'Gs',
];

interface KeyBadgeProps {
  selectedKey: KeySignature;
  isAutoInferred: boolean;
  onKeyChange: (key: KeySignature) => void;
  onResetToAuto: () => void;
}

export default function KeyBadge({
  selectedKey,
  isAutoInferred,
  onKeyChange,
  onResetToAuto,
}: KeyBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const displayName = `${KEY_DISPLAY_NAMES[selectedKey.root]} ${selectedKey.quality}`;

  return (
    <div className="key-badge-container" ref={dropdownRef}>
      <button
        className={`key-badge ${isAutoInferred ? 'auto' : 'manual'}`}
        onClick={() => setIsOpen(!isOpen)}
        title={isAutoInferred ? 'Auto-detected key (click to override)' : 'Manually set key (click to change)'}
      >
        <span className="key-badge-label">Key:</span>
        <span className="key-badge-value">{displayName}</span>
        {isAutoInferred && <span className="key-badge-auto">auto</span>}
      </button>

      {isOpen && (
        <div className="key-badge-dropdown">
          {!isAutoInferred && (
            <button
              className="key-badge-reset"
              onClick={() => { onResetToAuto(); setIsOpen(false); }}
            >
              ↻ Auto-detect
            </button>
          )}
          <div className="key-badge-section">
            <div className="key-badge-section-label">Major</div>
            {KEY_OPTIONS.map(pc => (
              <button
                key={`${pc}-major`}
                className={`key-badge-option ${selectedKey.root === pc && selectedKey.quality === 'major' ? 'active' : ''}`}
                onClick={() => { onKeyChange({ root: pc, quality: 'major' }); setIsOpen(false); }}
              >
                {KEY_DISPLAY_NAMES[pc]}
              </button>
            ))}
          </div>
          <div className="key-badge-section">
            <div className="key-badge-section-label">Minor</div>
            {KEY_OPTIONS.map(pc => (
              <button
                key={`${pc}-minor`}
                className={`key-badge-option ${selectedKey.root === pc && selectedKey.quality === 'minor' ? 'active' : ''}`}
                onClick={() => { onKeyChange({ root: pc, quality: 'minor' }); setIsOpen(false); }}
              >
                {KEY_DISPLAY_NAMES[pc]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add KeyBadge styles**

Append to `web/src/styles/index.css` (before the responsive media query at the bottom):

```css
/* Key Badge */
.key-badge-container {
  position: relative;
  display: inline-block;
  align-self: flex-end;
}

.key-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #1e1e30;
  border: 1px solid #333;
  border-radius: 6px;
  color: #e0e0e0;
  font-family: inherit;
  font-size: 0.78rem;
  cursor: pointer;
  transition: border-color 0.15s;
}

.key-badge:hover {
  border-color: #4a6fa5;
}

.key-badge-label {
  color: #888;
}

.key-badge-value {
  font-weight: 600;
}

.key-badge-auto {
  font-size: 0.6rem;
  color: #2a9d8f;
  font-style: italic;
  opacity: 0.8;
}

.key-badge.manual .key-badge-value {
  color: #4a6fa5;
}

.key-badge-dropdown {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  background: #1e1e30;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 8px;
  z-index: 50;
  min-width: 260px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.key-badge-reset {
  width: 100%;
  padding: 6px 8px;
  margin-bottom: 6px;
  background: rgba(42, 157, 143, 0.1);
  border: 1px solid rgba(42, 157, 143, 0.3);
  border-radius: 4px;
  color: #2a9d8f;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
}

.key-badge-reset:hover {
  background: rgba(42, 157, 143, 0.2);
}

.key-badge-section {
  margin-bottom: 6px;
}

.key-badge-section:last-child {
  margin-bottom: 0;
}

.key-badge-section-label {
  font-size: 0.65rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
  padding-left: 4px;
}

.key-badge-option {
  display: inline-block;
  padding: 3px 8px;
  margin: 2px;
  background: #262638;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #e0e0e0;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
}

.key-badge-option:hover {
  border-color: #4a6fa5;
}

.key-badge-option.active {
  background: rgba(74, 111, 165, 0.25);
  border-color: #4a6fa5;
  color: #fff;
}
```

- [ ] **Step 3: Verify build compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/KeyBadge.tsx web/src/styles/index.css
git commit -m "feat: add KeyBadge component with dropdown override

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: ChordSuggestions Component

**Files:**
- Create: `web/src/components/ChordSuggestions.tsx`
- Modify: `web/src/styles/index.css`

- [ ] **Step 1: Create ChordSuggestions component**

Create `web/src/components/ChordSuggestions.tsx`:

```tsx
import { useMemo } from 'react';
import type { ChordSymbol, KeySignature } from '../types';
import { generateSuggestions, type ScoredSuggestion } from '../engine/chordSuggestions';

interface ChordSuggestionsProps {
  currentChord: ChordSymbol | null;
  selectedKey: KeySignature;
  isPlaying: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onPreview: (chord: ChordSymbol) => void;
  onInsert: (text: string) => void;
}

export default function ChordSuggestions({
  currentChord,
  selectedKey,
  isPlaying,
  isOpen,
  onToggle,
  onPreview,
  onInsert,
}: ChordSuggestionsProps) {
  const suggestions = useMemo(() => {
    if (!currentChord) return [];
    return generateSuggestions(currentChord, selectedKey);
  }, [currentChord, selectedKey]);

  if (!currentChord) return null;

  const rootDisplay: Record<string, string> = {
    C: 'C', Cs: 'C♯', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
    Fs: 'F♯', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
  };
  const qualDisplay: Record<string, string> = {
    Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
  };
  const currentLabel = (rootDisplay[currentChord.root] ?? currentChord.root)
    + (qualDisplay[currentChord.quality] ?? currentChord.quality);

  return (
    <div className={`suggestions-panel ${isOpen ? 'open' : 'collapsed'} ${isPlaying ? 'disabled' : ''}`}>
      <button className="suggestions-header" onClick={onToggle}>
        <span className="suggestions-title">
          Suggestions after
          <span className="suggestions-current">{currentLabel}</span>
        </span>
        <span className="suggestions-toggle">{isOpen ? '▼' : '▶'}</span>
      </button>

      {isOpen && (
        <div className="suggestions-chips">
          {suggestions.map((s, i) => (
            <div key={`${s.chord.root}-${s.chord.quality}`} className="suggestion-chip">
              <button
                className="chip-play"
                onClick={() => !isPlaying && onPreview(s.chord)}
                disabled={isPlaying}
                title={`Preview ${s.text}`}
              >
                <span className="chip-play-icon">▶</span>
                {s.text}
              </button>
              <button
                className="chip-add"
                onClick={() => !isPlaying && onInsert(s.text)}
                disabled={isPlaying}
                title={`Insert ${s.text} after current chord`}
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add ChordSuggestions styles**

Append to `web/src/styles/index.css` (before the responsive media query):

```css
/* Chord Suggestions Panel */
.suggestions-panel {
  background: #1a1a2e;
  border: 1px solid #262638;
  border-radius: 10px;
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.suggestions-panel.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.suggestions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  color: #888;
  font-family: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  transition: color 0.15s;
}

.suggestions-header:hover {
  color: #e0e0e0;
}

.suggestions-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.suggestions-current {
  background: rgba(74, 111, 165, 0.2);
  color: #4a6fa5;
  padding: 1px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.85rem;
}

.suggestions-toggle {
  font-size: 0.7rem;
  color: #666;
}

.suggestions-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 16px 12px;
}

.suggestion-chip {
  display: inline-flex;
  align-items: stretch;
  background: #262638;
  border: 1px solid #333;
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.15s;
}

.suggestion-chip:hover {
  border-color: #4a6fa5;
}

.chip-play {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  background: none;
  border: none;
  color: #e0e0e0;
  font-family: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s;
}

.chip-play:hover:not(:disabled) {
  background: rgba(74, 111, 165, 0.15);
}

.chip-play-icon {
  font-size: 0.55rem;
  color: #4a6fa5;
}

.chip-add {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  background: none;
  border: none;
  border-left: 1px solid #333;
  color: #666;
  font-family: inherit;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
}

.chip-add:hover:not(:disabled) {
  color: #2a9d8f;
  background: rgba(42, 157, 143, 0.1);
}
```

- [ ] **Step 3: Verify build compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ChordSuggestions.tsx web/src/styles/index.css
git commit -m "feat: add ChordSuggestions panel component

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Wire Everything into App.tsx

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/Toolbar.tsx`

- [ ] **Step 1: Add imports and new state to App.tsx**

Add these imports at the top of `web/src/App.tsx` (after the existing imports):

```typescript
import { inferKey } from './engine/keyInference';
import { insertChordAfterIndex } from './engine/chordSuggestions';
import KeyBadge from './components/KeyBadge';
import ChordSuggestions from './components/ChordSuggestions';
```

Add `useMemo` to the existing React import on line 1:

```typescript
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
```

Add new state variables after `const [targetSpread, ...]` (line 32):

```typescript
const [keyManuallySet, setKeyManuallySet] = useState(false);
const [suggestionsOpen, setSuggestionsOpen] = useState(true);
```

- [ ] **Step 2: Add key inference logic**

After the `validChords` computation (line 51), add:

```typescript
// Auto-infer key when 2+ valid chords exist and key hasn't been manually set
const inferredKey = useMemo(() => {
  if (validChords.length >= 2) {
    return inferKey(validChords);
  }
  return null;
}, [validChords]);

useEffect(() => {
  if (!keyManuallySet && inferredKey) {
    setSelectedKey(inferredKey);
  }
}, [inferredKey, keyManuallySet]);
```

Add `useMemo` to the React import at line 1 if not already present.

- [ ] **Step 3: Add handleKeyChange modification and new callbacks**

Modify `handleKeyChange` to set `keyManuallySet`:

```typescript
const handleKeyChange = useCallback((newKey: KeySignature) => {
  if (notationMode === 'roman') {
    const standard = romanTextToStandard(chordText, selectedKey);
    setChordText(chordTextToRoman(standard, newKey));
  }
  setSelectedKey(newKey);
  setKeyManuallySet(true);
}, [notationMode, chordText, selectedKey]);
```

Add new callbacks for suggestions:

```typescript
const handlePreviewChord = useCallback((chord: ChordSymbol) => {
  if (!playerRef.current) playerRef.current = new ChordPlayer();
  playerRef.current.warmUp();
  // Voice this chord smoothly from the current voicing
  const pitches = currentVoicing
    ? smoothVoice(
        smoothMode ?? 'equal',
        currentVoicing,
        chordPitchClasses(chord.root, chord.quality),
        voiceLeadingOptions,
      )
    : voiceChord(chord.root, chord.quality, 0);
  playerRef.current.playChord(chord.root, pitches, tempo, tuning, playStyle);
}, [currentVoicing, smoothMode, voiceLeadingOptions, tempo, tuning, playStyle]);

const handleInsertChord = useCallback((chordText_: string) => {
  // In Roman mode, convert standard notation to Roman before inserting
  const textToInsert = notationMode === 'roman'
    ? chordTextToRoman(chordText_, selectedKey)
    : chordText_;
  const newText = insertChordAfterIndex(chordText, currentChordIndex, textToInsert, parseResults);
  setChordText(newText);
  setCurrentChordIndex(currentChordIndex + 1);
}, [chordText, currentChordIndex, parseResults, notationMode, selectedKey]);
```

And add `smoothVoice` to the existing `voiceLeading` import (line 6):

```typescript
import { voiceChordSequence, smoothVoice } from './engine/voiceLeading';
```

Add new imports from musicTheory (these are not currently imported in App.tsx):

```typescript
import { voiceChord, chordPitchClasses } from './engine/musicTheory';
```

- [ ] **Step 4: Add KeyBadge and ChordSuggestions to JSX**

Place `KeyBadge` inside a wrapper div with `ChordInput`:

Replace the `<ChordInput ... />` block (lines 263-269) with:

```tsx
<div className="chord-input-wrapper">
  <ChordInput
    value={chordText}
    onChange={setChordText}
    currentChordIndex={currentChordIndex}
    isPlaying={isPlaying}
    parseResults={parseResults}
  />
  <KeyBadge
    selectedKey={selectedKey}
    isAutoInferred={!keyManuallySet}
    onKeyChange={handleKeyChange}
    onResetToAuto={() => setKeyManuallySet(false)}
  />
</div>

<ChordSuggestions
  currentChord={currentChord}
  selectedKey={selectedKey}
  isPlaying={isPlaying}
  isOpen={suggestionsOpen}
  onToggle={() => setSuggestionsOpen(!suggestionsOpen)}
  onPreview={handlePreviewChord}
  onInsert={handleInsertChord}
/>
```

- [ ] **Step 5: Add chord-input-wrapper style**

Add to `web/src/styles/index.css` (near the chord input styles):

```css
.chord-input-wrapper {
  position: relative;
  margin-bottom: 1rem;
}

.chord-input-wrapper .key-badge-container {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 5;
}
```

- [ ] **Step 6: Make key selector always visible in Toolbar**

In `web/src/components/Toolbar.tsx`, remove the `notationMode === 'roman'` condition around `<KeySelector>` (line 133):

Change:
```tsx
{notationMode === 'roman' && (
  <KeySelector selectedKey={selectedKey} onKeyChange={onKeyChange} />
)}
```

To:
```tsx
<KeySelector selectedKey={selectedKey} onKeyChange={onKeyChange} />
```

- [ ] **Step 7: Verify build compiles and tests pass**

```bash
cd web && npx tsc --noEmit && npx vitest run
```

Expected: Build succeeds, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: wire key inference and chord suggestions into App

- Auto-infer key from chord sequence (2+ chords)
- KeyBadge shows inferred key with manual override
- ChordSuggestions panel below chord input
- Preview plays with voice-leading from current chord
- Insert adds chord text after current highlighted chord

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Polish and Responsive Styles

**Files:**
- Modify: `web/src/styles/index.css`

- [ ] **Step 1: Add responsive styles for new components**

Add inside the existing `@media (max-width: 768px)` block:

```css
.suggestions-chips {
  gap: 4px;
}

.chip-play {
  padding: 5px 8px;
  font-size: 0.75rem;
}

.chip-add {
  padding: 5px 6px;
  font-size: 0.7rem;
}

.key-badge-dropdown {
  min-width: 220px;
}
```

- [ ] **Step 2: Verify build and run dev server to visually check**

```bash
cd web && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/styles/index.css
git commit -m "style: add responsive styles for suggestions and key badge

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: Full Integration Test

**Files:**
- All files (verify end-to-end)

- [ ] **Step 1: Run all tests**

```bash
cd web && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Run build**

```bash
cd web && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Manual smoke test checklist**

Start the dev server and verify in browser:

```bash
cd web && npm run dev
```

Check:
1. Key badge visible below chord input showing "Key: C major (auto)"
2. Suggestion panel visible below chord input with 5-10 chips
3. Clicking chip name plays a preview chord
4. Clicking + inserts chord after the highlighted chord
5. Navigating to a different chord updates suggestions
6. Changing key in KeyBadge updates suggestions and shows "manual" state
7. Clicking "Auto-detect" resets to inferred key
8. During playback, suggestions panel is grayed out
9. Collapsing/expanding suggestions panel works
10. Roman numeral mode still works with key selector in toolbar
