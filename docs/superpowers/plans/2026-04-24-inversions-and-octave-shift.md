# Inversions & Octave Shift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix inversions to set bass voice (not shift register), integrate with voice leading, and add `^`/`_` suffix syntax for octave shifting.

**Architecture:** The parser strips trailing `^`/`_` before quality matching and stores `octaveShift` on `ChordSymbol`. `voiceChord` replaces `rotateUp`/`rotateDown` with register-neutral bass placement. `voiceChordSequence` integrates inversions into smooth voice leading (constrained bass + 3-voice optimization) and applies octave shift via per-chord gravity center adjustment.

**Tech Stack:** TypeScript, Vitest, React

**Key design decision:** `octaveShift` is an optional field on `ChordSymbol` (undefined = 0). Parsers only set it when non-zero. This avoids breaking dozens of existing `toEqual` assertions that construct `ChordSymbol` literals without the field.

---

### Task 1: Add `octaveShift` to `ChordSymbol` type

**Files:**
- Modify: `web/src/types.ts:22-26`

- [ ] **Step 1: Add optional octaveShift field**

In `web/src/types.ts`, add `octaveShift` to the `ChordSymbol` interface:

```ts
export interface ChordSymbol {
  readonly root: PitchClass;
  readonly quality: ChordType;
  readonly inversion: number | null;  // null = auto-voice in smooth mode
  readonly octaveShift?: number;      // undefined/0 = default, +N = up N octaves, -N = down
}
```

- [ ] **Step 2: Verify no tests break**

Run: `cd web && npx vitest run 2>&1 | tail -5`
Expected: 275 tests passed (the field is optional, so all existing code is compatible)

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts
git commit -m "feat: add optional octaveShift field to ChordSymbol type"
```

---

### Task 2: Parser — octave shift parsing

**Files:**
- Modify: `web/src/engine/parser.ts`
- Modify: `web/src/engine/parser.test.ts`

- [ ] **Step 1: Write failing tests for octave shift**

Add to `web/src/engine/parser.test.ts` inside the `describe('parseChord', ...)` block, after the existing inversions tests (after line 139):

```ts
  // Octave shift
  it('D7^ → D Dom7 octaveShift 1', () => {
    expectChord('D7^', { root: 'D', quality: 'Dom7', inversion: null, octaveShift: 1 });
  });
  it('D^^ → D Major octaveShift 2', () => {
    expectChord('D^^', { root: 'D', quality: 'Major', inversion: null, octaveShift: 2 });
  });
  it('D_ → D Major octaveShift -1', () => {
    expectChord('D_', { root: 'D', quality: 'Major', inversion: null, octaveShift: -1 });
  });
  it('D__ → D Major octaveShift -2', () => {
    expectChord('D__', { root: 'D', quality: 'Major', inversion: null, octaveShift: -2 });
  });
  it('D^^^ → D Major octaveShift 3', () => {
    expectChord('D^^^', { root: 'D', quality: 'Major', inversion: null, octaveShift: 3 });
  });
  it('1D7^ → D Dom7 inversion 1 octaveShift 1', () => {
    expectChord('1D7^', { root: 'D', quality: 'Dom7', inversion: 1, octaveShift: 1 });
  });
  it('Ebm7^^ → Eb Min7 octaveShift 2', () => {
    expectChord('Ebm7^^', { root: 'Ds', quality: 'Min7', inversion: null, octaveShift: 2 });
  });
  it('mixed ^_ fails', () => {
    expectFail('D^_');
  });
  it('D7 has no octaveShift (backward compat)', () => {
    // existing test already covers this — octaveShift is undefined, so toEqual matches without it
  });
  it('Cm9-5^ → C Min9no5 octaveShift 1', () => {
    expectChord('Cm9-5^', { root: 'C', quality: 'Min9no5', inversion: null, octaveShift: 1 });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/parser.test.ts 2>&1 | tail -15`
Expected: New octave shift tests FAIL (parser returns error for `D7^` etc.)

- [ ] **Step 3: Implement octave shift parsing**

In `web/src/engine/parser.ts`, replace the section from `// Parse quality from remaining string` (around line 43) through the return statement (line 50) with:

```ts
  // Parse quality from remaining string, stripping octave shift suffix
  const rest = trimmed.slice(pos);

  // Strip trailing ^ or _ for octave shift
  const shiftMatch = rest.match(/([_^]+)$/);
  const qualityStr = shiftMatch ? rest.slice(0, -shiftMatch[1]!.length) : rest;

  let octaveShift: number | undefined;
  if (shiftMatch) {
    const chars = shiftMatch[1]!;
    const hasUp = chars.includes('^');
    const hasDown = chars.includes('_');
    if (hasUp && hasDown) {
      return { ok: false, error: "Cannot mix ^ and _ in octave shift" };
    }
    octaveShift = hasUp ? chars.length : -chars.length;
  }

  const quality = parseQuality(qualityStr);
  if (quality === null) {
    return { ok: false, error: `Unknown quality: '${qualityStr}'` };
  }

  return {
    ok: true,
    value: {
      root,
      quality,
      inversion,
      ...(octaveShift !== undefined ? { octaveShift } : {}),
    },
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/parser.test.ts 2>&1 | tail -10`
Expected: ALL parser tests pass (new + existing)

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/parser.ts web/src/engine/parser.test.ts
git commit -m "feat: parse octave shift suffix (^/_) in chord notation"
```

---

### Task 3: Register-neutral inversions in `voiceChord`

**Files:**
- Modify: `web/src/engine/musicTheory.ts:68-92`
- Modify: `web/src/engine/musicTheory.test.ts:122-141`

- [ ] **Step 1: Write failing tests for new inversion behavior**

In `web/src/engine/musicTheory.test.ts`, replace the existing `voiceChord` describe block (lines 122-141) with:

```ts
describe('voiceChord', () => {
  it('C Major root position has 4 notes', () => {
    const pitches = voiceChord('C', 'Major', 0);
    expect(pitches).toHaveLength(4);
  });
  it('C Major root position starts on C3', () => {
    const pitches = voiceChord('C', 'Major', 0);
    expect(pitches[0]).toEqual({ pitchClass: 'C', octave: 3 });
  });
  it('1st inversion puts 2nd chord tone in bass, below root', () => {
    const first = voiceChord('C', 'Major', 1);
    const midis = first.map(pitchToMidi).sort((a, b) => a - b);
    // E should be the lowest note
    expect(first.find(p => pitchToMidi(p) === midis[0])!.pitchClass).toBe('E');
    // Bass should be below root position's lowest note (C3 = 48)
    expect(midis[0]).toBeLessThan(48);
  });
  it('1st inversion D major: F# is bass', () => {
    const inv1 = voiceChord('D', 'Major', 1);
    const sorted = [...inv1].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
    expect(sorted[0]!.pitchClass).toBe('Fs');
    // F#2 = MIDI 42, below D3 = MIDI 50
    expect(pitchToMidi(sorted[0]!)).toBe(42);
  });
  it('2nd inversion D7: A is bass', () => {
    const inv2 = voiceChord('D', 'Dom7', 2);
    const sorted = [...inv2].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
    expect(sorted[0]!.pitchClass).toBe('A');
    expect(pitchToMidi(sorted[0]!)).toBe(45); // A2
  });
  it('3rd inversion D7: C is bass', () => {
    const inv3 = voiceChord('D', 'Dom7', 3);
    const sorted = [...inv3].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
    expect(sorted[0]!.pitchClass).toBe('C');
  });
  it('all 4 notes preserved in inversions', () => {
    const root = voiceChord('D', 'Dom7', 0);
    const inv1 = voiceChord('D', 'Dom7', 1);
    const inv2 = voiceChord('D', 'Dom7', 2);
    for (const voicing of [root, inv1, inv2]) {
      expect(voicing).toHaveLength(4);
      const midis = new Set(voicing.map(pitchToMidi));
      expect(midis.size).toBe(4); // no unisons
    }
  });
  it('negative inversion clamped to root position', () => {
    const neg = voiceChord('C', 'Major', -1);
    const root = voiceChord('C', 'Major', 0);
    expect(neg).toEqual(root);
  });
  it('inversion clamped to max index', () => {
    const inv3 = voiceChord('C', 'Major', 3);
    const inv4 = voiceChord('C', 'Major', 4); // clamped to 3
    expect(inv3).toEqual(inv4);
  });
});
```

- [ ] **Step 2: Run tests to verify failures**

Run: `cd web && npx vitest run src/engine/musicTheory.test.ts 2>&1 | tail -20`
Expected: New inversion tests FAIL (old rotateUp behavior doesn't match)

- [ ] **Step 3: Implement register-neutral inversions**

In `web/src/engine/musicTheory.ts`, replace `voiceChord`, `applyInversion`, `rotateUp`, and `rotateDown` (lines 68-92) with:

```ts
export function voiceChord(root: PitchClass, ct: ChordType, inv: number): Pitch[] {
  const baseMidi = pitchToMidi({ pitchClass: root, octave: 3 });
  const intervals = chordIntervals(ct);
  const basePitches = intervals.map(i => midiToPitch(baseMidi + i));
  const clampedInv = Math.max(0, Math.min(intervals.length - 1, inv));
  if (clampedInv === 0) return basePitches;

  // Pull the inv-th pitch below all others
  const others = [...basePitches.slice(0, clampedInv), ...basePitches.slice(clampedInv + 1)];
  const lowestOtherMidi = Math.min(...others.map(pitchToMidi));
  let bassMidi = pitchToMidi(basePitches[clampedInv]!);
  while (bassMidi >= lowestOtherMidi) bassMidi -= 12;

  return [midiToPitch(bassMidi), ...others].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
}
```

Also export a helper needed by voice leading (add after `voiceChord`):

```ts
export function inversionBassPC(root: PitchClass, ct: ChordType, inv: number): PitchClass {
  const intervals = chordIntervals(ct);
  const clampedInv = Math.max(0, Math.min(intervals.length - 1, inv));
  return pitchClassFromInt(pitchClassToInt(root) + intervals[clampedInv]!);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/musicTheory.test.ts 2>&1 | tail -10`
Expected: ALL musicTheory tests pass

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/musicTheory.ts web/src/engine/musicTheory.test.ts
git commit -m "feat: register-neutral inversions in voiceChord

Inversions now set bass voice instead of rotating notes up.
1st inversion drops the 2nd chord tone below the others, etc.
Removes rotateUp/rotateDown/applyInversion."
```

---

### Task 4: Integrate inversions with voice leading + octave shift

**Files:**
- Modify: `web/src/engine/voiceLeading.ts`
- Modify: `web/src/engine/voiceLeading.test.ts`

This is the core change. When a chord has an inversion and voice leading is active, the bass voice is constrained while the upper 3 voices are smoothed normally. Octave shift adjusts the gravity center per-chord.

- [ ] **Step 1: Write failing tests for inversion + voice leading**

In `web/src/engine/voiceLeading.test.ts`, replace the `'explicit inversion overrides smooth'` test (lines 69-77) with new tests. Add these inside the `describe('voiceChordSequence', ...)` block:

```ts
  it('inversion forces correct bass note in smooth mode', () => {
    const chords: ChordSymbol[] = [
      { root: 'D', quality: 'Major', inversion: null },
      { root: 'D', quality: 'Major', inversion: 1 },  // F# bass
    ];
    const result = voiceChordSequence('equal', chords);
    const secondSorted = [...result[1]!].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
    expect(secondSorted[0]!.pitchClass).toBe('Fs');
  });

  it('inversion stays in similar register to previous chord', () => {
    const chords: ChordSymbol[] = [
      { root: 'D', quality: 'Major', inversion: null },
      { root: 'D', quality: 'Major', inversion: 1 },
    ];
    const result = voiceChordSequence('equal', chords);
    const prevCentroid = result[0]!.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    const currCentroid = result[1]!.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    // Centroids should be within an octave of each other
    expect(Math.abs(prevCentroid - currCentroid)).toBeLessThan(12);
  });

  it('inversion bass is lowest voice', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null },
      { root: 'G', quality: 'Dom7', inversion: 2 },  // D bass
    ];
    const result = voiceChordSequence('bass', chords);
    const sorted = [...result[1]!].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
    expect(sorted[0]!.pitchClass).toBe('D');
  });

  it('sequence D → 1D → G has smooth upper voices', () => {
    const chords: ChordSymbol[] = [
      { root: 'D', quality: 'Major', inversion: null },
      { root: 'D', quality: 'Major', inversion: 1 },
      { root: 'G', quality: 'Major', inversion: null },
    ];
    const result = voiceChordSequence('equal', chords);
    expect(result).toHaveLength(3);
    // All voicings have 4 notes
    result.forEach(v => expect(v).toHaveLength(4));
  });

  it('explicit 0 inversion forces root in bass in smooth mode', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null },
      { root: 'G', quality: 'Major', inversion: 0 },  // explicit root position
    ];
    const result = voiceChordSequence('equal', chords);
    const sorted = [...result[1]!].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
    expect(sorted[0]!.pitchClass).toBe('G');
  });
```

- [ ] **Step 2: Write failing tests for octave shift**

Add these tests inside `describe('voiceChordSequence', ...)`:

```ts
  it('octave shift up produces higher voicing (voice leading on)', () => {
    const normal: ChordSymbol[] = [
      { root: 'D', quality: 'Major', inversion: null },
    ];
    const shifted: ChordSymbol[] = [
      { root: 'D', quality: 'Major', inversion: null, octaveShift: 1 },
    ];
    const normalResult = voiceChordSequence('equal', normal);
    const shiftedResult = voiceChordSequence('equal', shifted);
    const normalCentroid = normalResult[0]!.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    const shiftedCentroid = shiftedResult[0]!.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    expect(shiftedCentroid - normalCentroid).toBeGreaterThanOrEqual(10);
  });

  it('octave shift down produces lower voicing (voice leading on)', () => {
    const normal: ChordSymbol[] = [
      { root: 'D', quality: 'Major', inversion: null },
    ];
    const shifted: ChordSymbol[] = [
      { root: 'D', quality: 'Major', inversion: null, octaveShift: -1 },
    ];
    const normalResult = voiceChordSequence('equal', normal);
    const shiftedResult = voiceChordSequence('equal', shifted);
    const normalCentroid = normalResult[0]!.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    const shiftedCentroid = shiftedResult[0]!.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    expect(normalCentroid - shiftedCentroid).toBeGreaterThanOrEqual(10);
  });

  it('octave shift works when voice leading is off', () => {
    const normal: ChordSymbol[] = [
      { root: 'D', quality: 'Major', inversion: null },
    ];
    const shifted: ChordSymbol[] = [
      { root: 'D', quality: 'Major', inversion: null, octaveShift: 1 },
    ];
    const normalResult = voiceChordSequence(null, normal);
    const shiftedResult = voiceChordSequence(null, shifted);
    const normalMidis = normalResult[0]!.map(pitchToMidi);
    const shiftedMidis = shiftedResult[0]!.map(pitchToMidi);
    // Each note should be exactly 12 semitones higher
    for (let i = 0; i < 4; i++) {
      expect(shiftedMidis[i]! - normalMidis[i]!).toBe(12);
    }
  });

  it('combined inversion + octave shift', () => {
    const chords: ChordSymbol[] = [
      { root: 'D', quality: 'Dom7', inversion: 1, octaveShift: 1 },
    ];
    const result = voiceChordSequence(null, chords);
    const sorted = [...result[0]!].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
    // F# should be bass (inversion 1)
    expect(sorted[0]!.pitchClass).toBe('Fs');
    // Everything should be ~12 higher than non-shifted inversion 1
    const unshifted = voiceChordSequence(null, [
      { root: 'D', quality: 'Dom7', inversion: 1 },
    ]);
    const unshiftedMidis = unshifted[0]!.map(pitchToMidi).sort((a, b) => a - b);
    const shiftedMidis = sorted.map(pitchToMidi);
    for (let i = 0; i < 4; i++) {
      expect(shiftedMidis[i]! - unshiftedMidis[i]!).toBe(12);
    }
  });

  it('mid-sequence octave shift raises voicing in smooth mode', () => {
    const chords: ChordSymbol[] = [
      { root: 'D', quality: 'Major', inversion: null },
      { root: 'A', quality: 'Dom7', inversion: null },
      { root: 'D', quality: 'Major', inversion: null, octaveShift: 1 },
      { root: 'G', quality: 'Major', inversion: null },
    ];
    const result = voiceChordSequence('equal', chords);
    const centroid2 = result[1]!.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    const centroid3 = result[2]!.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    // The shifted chord should be noticeably higher
    expect(centroid3).toBeGreaterThan(centroid2 + 5);
  });
```

- [ ] **Step 3: Run tests to verify failures**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts 2>&1 | tail -20`
Expected: New inversion/octave tests FAIL, plus `'explicit inversion overrides smooth'` FAILS (removed)

- [ ] **Step 4: Implement voice leading integration**

In `web/src/engine/voiceLeading.ts`, update the imports (line 2) to include `inversionBassPC`:

```ts
import { pitchToMidi, midiToPitch, nearestPitch, voiceChord, chordPitchClasses, pitchClassToInt, inversionBassPC } from './musicTheory';
```

Replace the `voiceChordSequence` function (lines 117-157) with:

```ts
export function voiceChordSequence(
  mode: SmoothMode | null,
  chords: ChordSymbol[],
  options?: VoiceLeadingOptions,
): Pitch[][] {
  if (chords.length === 0) return [];

  if (mode === null) {
    return chords.map(c => {
      const voicing = voiceChord(c.root, c.quality, c.inversion ?? 0);
      const shift = (c.octaveShift ?? 0) * 12;
      if (shift === 0) return voicing;
      return voicing.map(p => midiToPitch(pitchToMidi(p) + shift));
    });
  }

  const { gravityCenter = DEFAULT_GRAVITY_CENTER } = options ?? {};

  const first = chords[0]!;
  const firstGravity = gravityCenter + (first.octaveShift ?? 0) * 12;
  const baseVoicing = voiceChord(first.root, first.quality, first.inversion ?? 0);

  // Shift first voicing toward gravity center
  const baseMidis = baseVoicing.map(pitchToMidi);
  const baseCentroid = baseMidis.reduce((a, b) => a + b, 0) / baseMidis.length;
  const shiftSemitones = Math.round((firstGravity - baseCentroid) / 12) * 12;
  const firstVoicing = shiftSemitones === 0
    ? baseVoicing
    : baseVoicing.map(p => midiToPitch(pitchToMidi(p) + shiftSemitones));

  const result: Pitch[][] = [firstVoicing];

  let prev = firstVoicing;
  for (let i = 1; i < chords.length; i++) {
    const chord = chords[i]!;
    const chordGravity = gravityCenter + (chord.octaveShift ?? 0) * 12;
    const chordOptions = { ...options, gravityCenter: chordGravity };
    let voicing: Pitch[];

    const inv = chord.inversion;
    if (inv !== null) {
      voicing = voiceWithConstrainedBass(mode, prev, chord, chordOptions);
    } else {
      voicing = smoothVoice(mode, prev, chordPitchClasses(chord.root, chord.quality), chordOptions);
    }
    result.push(voicing);
    prev = voicing;
  }

  return result;
}

function voiceWithConstrainedBass(
  mode: SmoothMode,
  prev: Pitch[],
  chord: ChordSymbol,
  options?: VoiceLeadingOptions,
): Pitch[] {
  const allPCs = chordPitchClasses(chord.root, chord.quality);
  const inv = Math.max(0, Math.min(allPCs.length - 1, chord.inversion!));
  const bassPC = inversionBassPC(chord.root, chord.quality, inv);

  // Split previous voicing into bass + upper
  const prevSorted = [...prev].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
  const prevBass = prevSorted[0]!;
  const prevUpper = prevSorted.slice(1);

  // Upper pitch classes: remove the bass PC from the chord's pitch classes
  const upperPCs = [...allPCs.slice(0, inv), ...allPCs.slice(inv + 1)];

  // Optimize upper 3 voices (always use equal weights — bass handled separately)
  const upper = smoothVoice('equal', prevUpper, upperPCs, options);

  // Place bass near previous bass
  let bass = nearestPitch(bassPC, pitchToMidi(prevBass));
  let bassMidi = pitchToMidi(bass);

  // Ensure bass is strictly below all upper voices
  const lowestUpperMidi = Math.min(...upper.map(pitchToMidi));
  while (bassMidi >= lowestUpperMidi) bassMidi -= 12;
  bass = midiToPitch(bassMidi);

  return [bass, ...upper].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts 2>&1 | tail -15`
Expected: ALL voice leading tests pass

- [ ] **Step 6: Run full test suite for regressions**

Run: `cd web && npx vitest run 2>&1 | tail -5`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add web/src/engine/voiceLeading.ts web/src/engine/voiceLeading.test.ts
git commit -m "feat: integrate inversions with voice leading + octave shift

Inversions now participate in smooth voice leading with a
constrained bass (forced lowest) and 3-voice optimization
for upper parts. Octave shift adjusts per-chord gravity center."
```

---

### Task 5: Roman parser + converter — octave shift support

**Files:**
- Modify: `web/src/engine/romanParser.ts`
- Modify: `web/src/engine/romanParser.test.ts`
- Modify: `web/src/engine/romanConverter.ts`

- [ ] **Step 1: Write failing tests for Roman parser octave shift**

Add to `web/src/engine/romanParser.test.ts` inside `describe('parseRomanChord', ...)`, after the existing inversion tests:

```ts
  // Octave shift
  it('V7^ in C = G Dom7 octaveShift 1', () => {
    expectChord('V7^', Cmaj, { root: 'G', quality: 'Dom7', inversion: null, octaveShift: 1 });
  });
  it('IV__ in C = F Major octaveShift -2', () => {
    expectChord('IV__', Cmaj, { root: 'F', quality: 'Major', inversion: null, octaveShift: -2 });
  });
  it('1V7^ in C = G Dom7 inversion 1 octaveShift 1', () => {
    expectChord('1V7^', Cmaj, { root: 'G', quality: 'Dom7', inversion: 1, octaveShift: 1 });
  });
  it('V7/V^ in C = D Dom7 octaveShift 1', () => {
    expectChord('V7/V^', Cmaj, { root: 'D', quality: 'Dom7', inversion: null, octaveShift: 1 });
  });
  it('mixed ^_ in Roman fails', () => {
    expectFail('I^_', Cmaj);
  });
```

- [ ] **Step 2: Run to verify failures**

Run: `cd web && npx vitest run src/engine/romanParser.test.ts 2>&1 | tail -15`
Expected: New tests FAIL

- [ ] **Step 3: Implement octave shift in Roman parser**

In `web/src/engine/romanParser.ts`, in the `parseRomanChord` function, after extracting `rest` from `numeralResult` (after line 37 `const { degree, upper, rest } = numeralResult;`), add octave shift stripping before the slash parsing:

```ts
  const { degree, upper, rest: rawRest } = numeralResult;

  // Strip trailing octave shift
  const shiftMatch = rawRest.match(/([_^]+)$/);
  const rest = shiftMatch ? rawRest.slice(0, -shiftMatch[1]!.length) : rawRest;
  let octaveShift: number | undefined;
  if (shiftMatch) {
    const chars = shiftMatch[1]!;
    const hasUp = chars.includes('^');
    const hasDown = chars.includes('_');
    if (hasUp && hasDown) {
      return { ok: false, error: "Cannot mix ^ and _ in octave shift" };
    }
    octaveShift = hasUp ? chars.length : -chars.length;
  }
```

And update the return statement (line 74) to include octaveShift:

```ts
  return {
    ok: true,
    value: {
      root,
      quality,
      inversion,
      ...(octaveShift !== undefined ? { octaveShift } : {}),
    },
  };
```

- [ ] **Step 4: Run Roman parser tests**

Run: `cd web && npx vitest run src/engine/romanParser.test.ts 2>&1 | tail -10`
Expected: ALL tests pass

- [ ] **Step 5: Update romanConverter to preserve octave shift**

In `web/src/engine/romanConverter.ts`, add a helper function at the top of the file (after the imports):

```ts
function octaveShiftSuffix(shift: number | undefined): string {
  if (!shift) return '';
  return shift > 0 ? '^'.repeat(shift) : '_'.repeat(-shift);
}
```

In `chordTextToRoman` (around line 107), update the return to include the shift suffix:

```ts
    const shiftSuffix = octaveShiftSuffix(chord.octaveShift);

    if (secDom) {
      const secQual = chord.quality === 'Dom7' ? '7' : '';
      return `${invPrefix}V${secQual}/${secDom}${shiftSuffix}`;
    }

    return `${invPrefix}${accStr}${numeral}${qualSuffix}${shiftSuffix}`;
```

In `romanTextToStandard` (around line 129), update similarly:

```ts
    const shiftSuffix = octaveShiftSuffix(chord.octaveShift);
    return `${invPrefix}${rootName}${qualSuffix}${shiftSuffix}`;
```

- [ ] **Step 6: Run full test suite**

Run: `cd web && npx vitest run 2>&1 | tail -5`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add web/src/engine/romanParser.ts web/src/engine/romanParser.test.ts web/src/engine/romanConverter.ts
git commit -m "feat: octave shift support in Roman numeral parser and converter"
```

---

### Task 6: SyntaxReference UI + final verification

**Files:**
- Modify: `web/src/components/SyntaxReference.tsx`

- [ ] **Step 1: Update SyntaxReference component**

In `web/src/components/SyntaxReference.tsx`, update the format section (lines 50-60) to include the octave shift:

```tsx
        <section className="format-section">
          <h3>Format</h3>
          <div className="format-example">
            <span className="fmt-inversion">[inversion]</span>
            <span className="fmt-root">root</span>
            <span className="fmt-quality">quality</span>
            <span className="fmt-inversion">[octave shift]</span>
          </div>
          <p className="format-desc">
            Inversion is optional (defaults to automatic in smooth mode).
            Root is required. Quality defaults to Major if omitted.
            Octave shift is optional — use <code>^</code> to go up or <code>_</code> to go down.
          </p>
        </section>
```

Update the inversions section (lines 115-124) to clarify the corrected behavior and add octave shift:

```tsx
        <section className="inversions-section">
          <h3>Inversions</h3>
          <div className="inversion-info">
            <p><strong>0</strong> = Root position</p>
            <p><strong>1</strong> = 1st inversion (3rd in bass)</p>
            <p><strong>2</strong> = 2nd inversion (5th in bass)</p>
            <p><strong>3</strong> = 3rd inversion (7th in bass, if present)</p>
            <p><em>Omit for automatic voice leading in smooth modes</em></p>
          </div>
        </section>

        <section className="octave-shift-section">
          <h3>Octave Shift</h3>
          <div className="inversion-info">
            <p><code>D7^</code> = Up 1 octave</p>
            <p><code>D7^^</code> = Up 2 octaves</p>
            <p><code>D7_</code> = Down 1 octave</p>
            <p><code>D7__</code> = Down 2 octaves</p>
            <p><em>Combinable with inversions: <code>1D7^</code></em></p>
          </div>
        </section>
```

- [ ] **Step 2: Build and verify**

Run: `cd web && npm run build 2>&1 | tail -10`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run full test suite**

Run: `cd web && npx vitest run 2>&1 | tail -5`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add web/src/components/SyntaxReference.tsx
git commit -m "docs: add octave shift to syntax reference, clarify inversion descriptions"
```
