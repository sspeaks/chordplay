# 9th Chord Omission Syntax — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single rootless Dom9 chord type with 12 explicit 9th-chord-with-omission variants (dom/maj/min × -1/-3/-5/-7), plus `add9` and `madd9` aliases.

**Architecture:** Flat enum expansion — each variant gets its own `ChordType` value and `INTERVALS` entry. The parser maps 14 new syntax strings (12 types + 2 aliases) to these types. Bare 9th chords (`9`, `maj9`, `m9`) become parse errors. Roman numeral parsing works automatically since it delegates to `parseQuality`.

**Tech Stack:** TypeScript, Vitest, Vite (web frontend in `web/`)

**Spec:** `docs/superpowers/specs/2026-03-24-9th-chord-omission-syntax-design.md`

---

### Task 1: Update ChordType enum

**Files:**
- Modify: `web/src/types.ts:5-10`

- [ ] **Step 1: Replace Dom9 with 12 new ChordType values**

In `web/src/types.ts`, replace the `CHORD_TYPES` array:

```typescript
export const CHORD_TYPES = [
  'Major','Minor','Dom7','Maj7','Min7',
  'Dim','Dim7','Aug','HalfDim7',
  'Sus4','Sus2','MinMaj7','Maj6','Min6',
  'Dom9no1','Dom9no3','Dom9no5','Dom9no7',
  'Maj9no1','Maj9no3','Maj9no5','Maj9no7',
  'Min9no1','Min9no3','Min9no5','Min9no7',
] as const;
```

- [ ] **Step 2: Verify the project still compiles**

Run: `cd web && npx tsc --noEmit 2>&1 | head -30`

Expected: Compile errors in `musicTheory.ts` (missing interval entries) — this confirms the type change propagated. Do NOT fix these yet.

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts
git commit -m "refactor: replace Dom9 with 12 9th-chord-omission ChordType variants"
```

---

### Task 2: Update intervals (TDD)

**Files:**
- Test: `web/src/engine/musicTheory.test.ts:76-78`
- Modify: `web/src/engine/musicTheory.ts:27-43`

- [ ] **Step 1: Replace old Dom9 interval test with new tests**

In `web/src/engine/musicTheory.test.ts`, replace:

```typescript
  it('Dom9 = [-5,2,4,10] (rootless)', () => {
    expect(chordIntervals('Dom9')).toEqual([-5, 2, 4, 10]);
  });
```

with:

```typescript
  // Dominant 9th variants (full = [0,4,7,10,14])
  it('Dom9no1 = [4,7,10,14]', () => {
    expect(chordIntervals('Dom9no1')).toEqual([4, 7, 10, 14]);
  });
  it('Dom9no3 = [0,7,10,14]', () => {
    expect(chordIntervals('Dom9no3')).toEqual([0, 7, 10, 14]);
  });
  it('Dom9no5 = [0,4,10,14]', () => {
    expect(chordIntervals('Dom9no5')).toEqual([0, 4, 10, 14]);
  });
  it('Dom9no7 = [0,4,7,14]', () => {
    expect(chordIntervals('Dom9no7')).toEqual([0, 4, 7, 14]);
  });

  // Major 9th variants (full = [0,4,7,11,14])
  it('Maj9no1 = [4,7,11,14]', () => {
    expect(chordIntervals('Maj9no1')).toEqual([4, 7, 11, 14]);
  });
  it('Maj9no3 = [0,7,11,14]', () => {
    expect(chordIntervals('Maj9no3')).toEqual([0, 7, 11, 14]);
  });
  it('Maj9no5 = [0,4,11,14]', () => {
    expect(chordIntervals('Maj9no5')).toEqual([0, 4, 11, 14]);
  });
  it('Maj9no7 = [0,4,7,14]', () => {
    expect(chordIntervals('Maj9no7')).toEqual([0, 4, 7, 14]);
  });

  // Minor 9th variants (full = [0,3,7,10,14])
  it('Min9no1 = [3,7,10,14]', () => {
    expect(chordIntervals('Min9no1')).toEqual([3, 7, 10, 14]);
  });
  it('Min9no3 = [0,7,10,14]', () => {
    expect(chordIntervals('Min9no3')).toEqual([0, 7, 10, 14]);
  });
  it('Min9no5 = [0,3,10,14]', () => {
    expect(chordIntervals('Min9no5')).toEqual([0, 3, 10, 14]);
  });
  it('Min9no7 = [0,3,7,14]', () => {
    expect(chordIntervals('Min9no7')).toEqual([0, 3, 7, 14]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/musicTheory.test.ts 2>&1 | tail -20`

Expected: FAIL — TypeScript compile errors because `INTERVALS` map is missing the new keys.

- [ ] **Step 3: Update INTERVALS map in musicTheory.ts**

In `web/src/engine/musicTheory.ts`, replace:

```typescript
  Dom9:     [-5, 2, 4, 10],  // rootless: 5, 9, 3, b7
```

with:

```typescript
  // Dominant 9th (full: 1,3,5,b7,9 = [0,4,7,10,14])
  Dom9no1:  [4, 7, 10, 14],
  Dom9no3:  [0, 7, 10, 14],
  Dom9no5:  [0, 4, 10, 14],
  Dom9no7:  [0, 4, 7, 14],
  // Major 9th (full: 1,3,5,7,9 = [0,4,7,11,14])
  Maj9no1:  [4, 7, 11, 14],
  Maj9no3:  [0, 7, 11, 14],
  Maj9no5:  [0, 4, 11, 14],
  Maj9no7:  [0, 4, 7, 14],
  // Minor 9th (full: 1,b3,5,b7,9 = [0,3,7,10,14])
  Min9no1:  [3, 7, 10, 14],
  Min9no3:  [0, 7, 10, 14],
  Min9no5:  [0, 3, 10, 14],
  Min9no7:  [0, 3, 7, 14],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/musicTheory.test.ts 2>&1 | tail -20`

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/musicTheory.ts web/src/engine/musicTheory.test.ts
git commit -m "feat: add intervals for 12 9th-chord-omission variants (TDD)"
```

---

### Task 3: Update parser (TDD)

**Files:**
- Test: `web/src/engine/parser.test.ts:58-60`
- Modify: `web/src/engine/parser.ts:76-101`

- [ ] **Step 1: Replace old Dom9 parser test and add new tests**

In `web/src/engine/parser.test.ts`, replace:

```typescript
  it('A9 → A Dom9 (rootless)', () => {
    expectChord('A9', { root: 'A', quality: 'Dom9', inversion: null });
  });
```

with:

```typescript
  // 9th chords: bare 9 is invalid (5 notes), must specify omission
  it('A9 (bare) fails — must specify omission', () => {
    expectFail('A9');
  });
  it('Cmaj9 (bare) fails', () => {
    expectFail('Cmaj9');
  });
  it('Cm9 (bare) fails', () => {
    expectFail('Cm9');
  });

  // Dominant 9th omissions
  it('C9-1 → C Dom9no1', () => {
    expectChord('C9-1', { root: 'C', quality: 'Dom9no1', inversion: null });
  });
  it('C9-3 → C Dom9no3', () => {
    expectChord('C9-3', { root: 'C', quality: 'Dom9no3', inversion: null });
  });
  it('C9-5 → C Dom9no5', () => {
    expectChord('C9-5', { root: 'C', quality: 'Dom9no5', inversion: null });
  });
  it('C9-7 → C Dom9no7', () => {
    expectChord('C9-7', { root: 'C', quality: 'Dom9no7', inversion: null });
  });

  // Major 9th omissions
  it('Cmaj9-1 → C Maj9no1', () => {
    expectChord('Cmaj9-1', { root: 'C', quality: 'Maj9no1', inversion: null });
  });
  it('Cmaj9-3 → C Maj9no3', () => {
    expectChord('Cmaj9-3', { root: 'C', quality: 'Maj9no3', inversion: null });
  });
  it('Cmaj9-5 → C Maj9no5', () => {
    expectChord('Cmaj9-5', { root: 'C', quality: 'Maj9no5', inversion: null });
  });
  it('Cmaj9-7 → C Maj9no7', () => {
    expectChord('Cmaj9-7', { root: 'C', quality: 'Maj9no7', inversion: null });
  });

  // Minor 9th omissions
  it('Cm9-1 → C Min9no1', () => {
    expectChord('Cm9-1', { root: 'C', quality: 'Min9no1', inversion: null });
  });
  it('Cm9-3 → C Min9no3', () => {
    expectChord('Cm9-3', { root: 'C', quality: 'Min9no3', inversion: null });
  });
  it('Cm9-5 → C Min9no5', () => {
    expectChord('Cm9-5', { root: 'C', quality: 'Min9no5', inversion: null });
  });
  it('Cm9-7 → C Min9no7', () => {
    expectChord('Cm9-7', { root: 'C', quality: 'Min9no7', inversion: null });
  });

  // Aliases
  it('Cadd9 → C Dom9no7', () => {
    expectChord('Cadd9', { root: 'C', quality: 'Dom9no7', inversion: null });
  });
  it('Cmadd9 → C Min9no7', () => {
    expectChord('Cmadd9', { root: 'C', quality: 'Min9no7', inversion: null });
  });

  // 9th with accidentals and inversions
  it('Bb9-5 → Bb Dom9no5', () => {
    expectChord('Bb9-5', { root: 'As', quality: 'Dom9no5', inversion: null });
  });
  it('1C9-1 → C Dom9no1, inversion 1', () => {
    expectChord('1C9-1', { root: 'C', quality: 'Dom9no1', inversion: 1 });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/parser.test.ts 2>&1 | tail -30`

Expected: FAIL — `parseQuality` doesn't know the new suffixes yet.

- [ ] **Step 3: Update parseQuality in parser.ts**

In `web/src/engine/parser.ts`, replace the `QUALITIES` array inside `parseQuality`:

```typescript
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
```

with:

```typescript
  const QUALITIES: [string, ChordType][] = [
    ['mMaj7', 'MinMaj7'],
    // 9th chords — longest first to avoid prefix collisions
    ['maj9-1', 'Maj9no1'],
    ['maj9-3', 'Maj9no3'],
    ['maj9-5', 'Maj9no5'],
    ['maj9-7', 'Maj9no7'],
    ['maj7', 'Maj7'],
    ['maj', 'Major'],
    ['madd9', 'Min9no7'],
    ['dim7b5', 'HalfDim7'],
    ['dim7', 'Dim7'],
    ['dim', 'Dim'],
    ['m9-1', 'Min9no1'],
    ['m9-3', 'Min9no3'],
    ['m9-5', 'Min9no5'],
    ['m9-7', 'Min9no7'],
    ['m7b5', 'HalfDim7'],
    ['m7', 'Min7'],
    ['m6', 'Min6'],
    ['min', 'Minor'],
    ['m', 'Minor'],
    ['aug', 'Aug'],
    ['+', 'Aug'],
    ['sus4', 'Sus4'],
    ['sus2', 'Sus2'],
    ['add9', 'Dom9no7'],
    ['9-1', 'Dom9no1'],
    ['9-3', 'Dom9no3'],
    ['9-5', 'Dom9no5'],
    ['9-7', 'Dom9no7'],
    ['7', 'Dom7'],
    ['6', 'Maj6'],
  ];
```

Note the ordering: `maj9-*` before `maj7`/`maj`, `madd9` before `m9-*` before `m7`/`m`, `add9` before `9-*` before `7`. This prevents prefix collisions. Bare `9`, `maj9`, `m9` have no entry, so they return `null` (parse error).

- [ ] **Step 4: Run parser tests to verify they pass**

Run: `cd web && npx vitest run src/engine/parser.test.ts 2>&1 | tail -30`

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/parser.ts web/src/engine/parser.test.ts
git commit -m "feat: add parser support for 9th chord omission syntax (TDD)"
```

---

### Task 4: Update romanConverter.ts

**Files:**
- Modify: `web/src/engine/romanConverter.ts:13-21` (`standardQualitySuffix`)
- Modify: `web/src/engine/romanConverter.ts:29-33` (`isMajorLike`)

- [ ] **Step 1: Update standardQualitySuffix MAP**

In `web/src/engine/romanConverter.ts`, replace:

```typescript
function standardQualitySuffix(quality: ChordType): string {
  const MAP: Record<ChordType, string> = {
    Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
    Dim: 'dim', Dim7: 'dim7', Aug: 'aug', HalfDim7: 'm7b5',
    Sus4: 'sus4', Sus2: 'sus2', MinMaj7: 'mMaj7', Maj6: '6', Min6: 'm6',
    Dom9: '9',
  };
  return MAP[quality];
}
```

with:

```typescript
function standardQualitySuffix(quality: ChordType): string {
  const MAP: Record<ChordType, string> = {
    Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
    Dim: 'dim', Dim7: 'dim7', Aug: 'aug', HalfDim7: 'm7b5',
    Sus4: 'sus4', Sus2: 'sus2', MinMaj7: 'mMaj7', Maj6: '6', Min6: 'm6',
    Dom9no1: '9-1', Dom9no3: '9-3', Dom9no5: '9-5', Dom9no7: '9-7',
    Maj9no1: 'maj9-1', Maj9no3: 'maj9-3', Maj9no5: 'maj9-5', Maj9no7: 'maj9-7',
    Min9no1: 'm9-1', Min9no3: 'm9-3', Min9no5: 'm9-5', Min9no7: 'm9-7',
  };
  return MAP[quality];
}
```

- [ ] **Step 2: Update isMajorLike**

In `web/src/engine/romanConverter.ts`, replace:

```typescript
function isMajorLike(quality: ChordType): boolean {
  return quality === 'Major' || quality === 'Dom7' || quality === 'Maj7'
    || quality === 'Aug' || quality === 'Maj6' || quality === 'Dom9'
    || quality === 'Sus4' || quality === 'Sus2';
}
```

with:

```typescript
function isMajorLike(quality: ChordType): boolean {
  return quality === 'Major' || quality === 'Dom7' || quality === 'Maj7'
    || quality === 'Aug' || quality === 'Maj6' || quality === 'Sus4' || quality === 'Sus2'
    || quality === 'Dom9no1' || quality === 'Dom9no3' || quality === 'Dom9no5' || quality === 'Dom9no7'
    || quality === 'Maj9no1' || quality === 'Maj9no3' || quality === 'Maj9no5' || quality === 'Maj9no7';
}
```

Note: Minor 9th variants are NOT major-like (they contain a minor 3rd), so they are excluded.

- [ ] **Step 3: Verify build compiles**

Run: `cd web && npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/src/engine/romanConverter.ts
git commit -m "feat: update romanConverter for 9th chord omission types"
```

---

### Task 5: Integration test (no changes needed)

The default progression was changed to a jazzy Happy Birthday (`Cmaj7 Am7 Dm7 G7 ...`) which has no 9th chords, so the integration test doesn't need 9th chord updates. Skip to Task 6.

---

### Task 6: Update roman numeral tests

**Files:**
- Modify: `web/src/engine/romanParser.test.ts:71-73`

Since `romanParser.ts` delegates to `parseQuality`, no code change is needed — only test updates.

- [ ] **Step 1: Replace old V9 test and add new roman numeral 9th tests**

In `web/src/engine/romanParser.test.ts`, replace:

```typescript
  it('V9 in C = G Dom9', () => {
    expectChord('V9', Cmaj, { root: 'G', quality: 'Dom9', inversion: null });
  });
```

with:

```typescript
  // 9th chords: bare V9 is invalid, must specify omission
  it('V9 (bare) fails', () => {
    expectFail('V9', Cmaj);
  });
  it('V9-1 in C = G Dom9no1', () => {
    expectChord('V9-1', Cmaj, { root: 'G', quality: 'Dom9no1', inversion: null });
  });
  it('V9-5 in C = G Dom9no5', () => {
    expectChord('V9-5', Cmaj, { root: 'G', quality: 'Dom9no5', inversion: null });
  });
  it('IVmaj9-3 in C = F Maj9no3', () => {
    expectChord('IVmaj9-3', Cmaj, { root: 'F', quality: 'Maj9no3', inversion: null });
  });
  it('iim9-5 in C = D Min9no5', () => {
    expectChord('iim9-5', Cmaj, { root: 'D', quality: 'Min9no5', inversion: null });
  });
  it('Iadd9 in C = C Dom9no7', () => {
    expectChord('Iadd9', Cmaj, { root: 'C', quality: 'Dom9no7', inversion: null });
  });
  it('iimadd9 in C = D Min9no7', () => {
    expectChord('iimadd9', Cmaj, { root: 'D', quality: 'Min9no7', inversion: null });
  });
```

- [ ] **Step 2: Run roman numeral tests to verify they pass**

Run: `cd web && npx vitest run src/engine/romanParser.test.ts 2>&1 | tail -20`

Expected: ALL PASS (no romanParser.ts code changes needed — `parseQuality` already handles the new suffixes from Task 3).

- [ ] **Step 3: Commit**

```bash
git add web/src/engine/romanParser.test.ts
git commit -m "test: add roman numeral 9th chord omission tests"
```

---

### Task 7: Update SyntaxReference

**Files:**
- Modify: `web/src/components/SyntaxReference.tsx:23-39`

- [ ] **Step 1: Replace the Dom9 entry with a 9th chord description**

In `web/src/components/SyntaxReference.tsx`, replace:

```typescript
const QUALITIES = [
  { display: 'Major', code: '' },
  { display: 'Dom 9 (rootless)', code: '9' },
  { display: 'Minor', code: 'm' },
  { display: 'Maj 6', code: '6' },
  { display: 'Dom 7', code: '7' },
  { display: 'Min 6', code: 'm6' },
  { display: 'Maj 7', code: 'M7' },
  { display: 'Dim', code: 'dim' },
  { display: 'Min 7', code: 'm7' },
  { display: 'Dim 7', code: 'dim7' },
  { display: 'Half-Dim 7', code: 'm7b5' },
  { display: 'Aug', code: 'aug' },
  { display: 'Min-Maj 7', code: 'mM7' },
  { display: 'Sus 4', code: 'sus4' },
  { display: 'Sus 2', code: 'sus2' },
];
```

with:

```typescript
const QUALITIES = [
  { display: 'Major', code: '' },
  { display: 'Minor', code: 'm' },
  { display: 'Maj 6', code: '6' },
  { display: 'Dom 7', code: '7' },
  { display: 'Min 6', code: 'm6' },
  { display: 'Maj 7', code: 'M7' },
  { display: 'Dim', code: 'dim' },
  { display: 'Min 7', code: 'm7' },
  { display: 'Dim 7', code: 'dim7' },
  { display: 'Half-Dim 7', code: 'm7b5' },
  { display: 'Aug', code: 'aug' },
  { display: 'Min-Maj 7', code: 'mM7' },
  { display: 'Sus 4', code: 'sus4' },
  { display: 'Sus 2', code: 'sus2' },
];
```

Then, in the JSX returned by `SyntaxReference`, add a new section after the qualities section (after the closing `</section>` on line 84, before the inversions section on line 86):

```tsx
        <section className="ninth-chords-section">
          <h3>9th Chords</h3>
          <p className="format-desc">
            9th chords have 5 notes but only 4 voices, so you must omit one note
            with <code>-1</code>, <code>-3</code>, <code>-5</code>, or <code>-7</code>.
          </p>
          <div className="quality-grid">
            <div className="quality-item">
              <span className="quality-display">Dom 9</span>
              <code className="quality-code">9-N</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">Maj 9</span>
              <code className="quality-code">maj9-N</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">Min 9</span>
              <code className="quality-code">m9-N</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">Add 9</span>
              <code className="quality-code">add9</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">Min Add 9</span>
              <code className="quality-code">madd9</code>
            </div>
          </div>
        </section>
```

- [ ] **Step 2: Verify build succeeds**

Run: `cd web && npx tsc --noEmit 2>&1 | tail -10`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/SyntaxReference.tsx
git commit -m "feat: update syntax reference for 9th chord omission system"
```

---

### Task 8: Full test suite verification

- [ ] **Step 1: Run all tests**

Run: `cd web && npx vitest run 2>&1 | tail -30`

Expected: ALL PASS

- [ ] **Step 2: Run full build**

Run: `cd web && npm run build 2>&1 | tail -10`

Expected: Build succeeds with no errors
