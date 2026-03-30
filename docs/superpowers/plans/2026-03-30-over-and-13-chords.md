# Over (Slash) Chords and Dom13 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add slash chord syntax (`C/E`, `Am7/G`) and dominant 13th chord quality (`C13`) to ChordPlay's web frontend.

**Architecture:** Extend the existing `ChordSymbol` type with an optional `bass` field and a new `Dom13` chord type. The parser detects `/Note` suffixes for slash chords and `13` quality for Dom13. Music theory computes pitch classes with bass substitution logic. Voice leading pins the bass voice and smooths the upper 3 independently. Roman numeral mode uses letter-name bass (`I/E`) to avoid conflict with secondary dominants (`V7/V`).

**Tech Stack:** TypeScript, React, Vitest, Web Audio API

**Spec:** `docs/superpowers/specs/2026-03-30-over-and-13-chords-design.md`

---

### Task 1: Add Dom13 to types and music theory

**Files:**
- Modify: `web/src/types.ts:5-12` (CHORD_TYPES array)
- Modify: `web/src/engine/musicTheory.ts:27-57` (INTERVALS map)
- Test: `web/src/engine/musicTheory.test.ts`

- [ ] **Step 1: Write failing tests for Dom13 intervals**

Add to `musicTheory.test.ts` in the `chordIntervals` describe block:

```typescript
it('Dom13 intervals', () => {
  expect(chordIntervals('Dom13')).toEqual([0, 4, 9, 10]);
});

it('chordPitchClasses C Dom13', () => {
  expect(chordPitchClasses('C', 'Dom13')).toEqual(['C', 'E', 'A', 'As']);
});

it('chordPitchClasses Bb Dom13', () => {
  expect(chordPitchClasses('As', 'Dom13')).toEqual(['As', 'D', 'G', 'Gs']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/musicTheory.test.ts`
Expected: TypeScript error — `'Dom13'` is not assignable to type `ChordType`

- [ ] **Step 3: Add Dom13 to CHORD_TYPES**

In `web/src/types.ts`, add `'Dom13'` at the end of the `CHORD_TYPES` array:

```typescript
export const CHORD_TYPES = [
  'Major','Minor','Dom7','Maj7','Min7',
  'Dim','Dim7','Aug','HalfDim7',
  'Sus4','Sus2','MinMaj7','Maj6','Min6',
  'Dom9no1','Dom9no3','Dom9no5','Dom9no7',
  'Maj9no1','Maj9no3','Maj9no5','Maj9no7',
  'Min9no1','Min9no3','Min9no5','Min9no7',
  'Dom13',
] as const;
```

- [ ] **Step 4: Add Dom13 intervals to INTERVALS map**

In `web/src/engine/musicTheory.ts`, add after the `Min9no7` line (line 56):

```typescript
  // Dominant 13th: dom7 with 5th replaced by 6th/13th (barbershop "Waesche 13")
  Dom13:    [0, 4, 9, 10],
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/musicTheory.test.ts`
Expected: All tests PASS including the 3 new ones

- [ ] **Step 6: Commit**

```bash
git add web/src/types.ts web/src/engine/musicTheory.ts web/src/engine/musicTheory.test.ts
git commit -m "feat: add Dom13 chord type with intervals [0,4,9,10]"
```

---

### Task 2: Add bass field to ChordSymbol type

**Files:**
- Modify: `web/src/types.ts:22-28` (ChordSymbol interface)

- [ ] **Step 1: Add bass field to ChordSymbol**

In `web/src/types.ts`, add `bass` to the `ChordSymbol` interface after `inversion`:

```typescript
export interface ChordSymbol {
  readonly root: PitchClass;
  readonly quality: ChordType;
  readonly inversion: number | null;
  readonly bass?: PitchClass;                // slash chord bass note (e.g., C/E → bass: 'E')
  readonly explicitVoicing?: PitchClass[];
  readonly warning?: boolean;
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `cd web && npx vitest run`
Expected: All 316+ tests still PASS (adding an optional field is backward compatible)

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts
git commit -m "feat: add optional bass field to ChordSymbol for slash chords"
```

---

### Task 3: Parse Dom13 quality in standard parser

**Files:**
- Modify: `web/src/engine/parser.ts:95-133` (parseQuality QUALITIES array)
- Test: `web/src/engine/parser.test.ts`

- [ ] **Step 1: Write failing tests for Dom13 parsing**

Add to `parser.test.ts` in the `parseChord` describe block:

```typescript
it('C13 → C Dom13', () => {
  expectChord('C13', { root: 'C', quality: 'Dom13', inversion: null });
});
it('Bb13 → Bb Dom13', () => {
  expectChord('Bb13', { root: 'As', quality: 'Dom13', inversion: null });
});
it('1C13 → C Dom13, inversion 1', () => {
  expectChord('1C13', { root: 'C', quality: 'Dom13', inversion: 1 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/parser.test.ts`
Expected: FAIL — `C13` currently fails (`13` is not a recognized quality; `1` is eaten as inversion prefix, then `3` doesn't match)

- [ ] **Step 3: Add '13' to parseQuality**

In `web/src/engine/parser.ts`, add the `'13'` entry in the QUALITIES array. It must go **after** the `'9-7'` entry and **before** the `'7'` entry (line 126) to avoid `'1'` being consumed as an inversion prefix when `'13'` should match. The entry goes right before `['7', 'Dom7']`:

```typescript
    ['9-7', 'Dom9no7'],
    ['13', 'Dom13'],
    ['7', 'Dom7'],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/parser.test.ts`
Expected: All tests PASS including 3 new ones

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/parser.ts web/src/engine/parser.test.ts
git commit -m "feat: parse Dom13 quality (13 suffix)"
```

---

### Task 4: Parse slash chord bass notes in standard parser

**Files:**
- Modify: `web/src/engine/parser.ts:33-81` (parseChord function)
- Test: `web/src/engine/parser.test.ts`

- [ ] **Step 1: Write failing tests for slash chord parsing**

Add to `parser.test.ts` in the `parseChord` describe block:

```typescript
// Slash chords
it('C/E → C Major, bass=E', () => {
  expectChord('C/E', { root: 'C', quality: 'Major', inversion: null, bass: 'E' });
});
it('Eb/C → Eb Major, bass=C', () => {
  expectChord('Eb/C', { root: 'Ds', quality: 'Major', inversion: null, bass: 'C' });
});
it('Am7/G → A Min7, bass=G', () => {
  expectChord('Am7/G', { root: 'A', quality: 'Min7', inversion: null, bass: 'G' });
});
it('C/Bb → C Major, bass=Bb', () => {
  expectChord('C/Bb', { root: 'C', quality: 'Major', inversion: null, bass: 'As' });
});
it('C7/Bb → C Dom7, bass=Bb', () => {
  expectChord('C7/Bb', { root: 'C', quality: 'Dom7', inversion: null, bass: 'As' });
});
it('C13/Bb → C Dom13, bass=Bb', () => {
  expectChord('C13/Bb', { root: 'C', quality: 'Dom13', inversion: null, bass: 'As' });
});
it('1C/E → slash overrides inversion, bass=E', () => {
  expectChord('1C/E', { root: 'C', quality: 'Major', inversion: null, bass: 'E' });
});
it('F#m7/E → F# Min7, bass=E', () => {
  expectChord('F#m7/E', { root: 'Fs', quality: 'Min7', inversion: null, bass: 'E' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/parser.test.ts`
Expected: FAIL — `/E` is currently parsed as part of the quality string, which doesn't match

- [ ] **Step 3: Implement slash chord parsing in parseChord**

In `web/src/engine/parser.ts`, modify `parseChord` to detect and strip the `/Bass` suffix before parsing quality. Replace the section after the root/accidental parsing (lines 73-80) with:

```typescript
  // Check for slash bass: /[A-G][#b]? at end of remaining string
  const rest = trimmed.slice(pos);
  let qualityStr = rest;
  let bass: PitchClass | undefined;

  const slashMatch = rest.match(/\/([A-G][#b]?)$/);
  if (slashMatch) {
    qualityStr = rest.slice(0, slashMatch.index);
    const bassLetter = slashMatch[1]![0]!;
    const bassAccidental = slashMatch[1]!.length > 1 ? slashMatch[1]![1]! : null;
    const bassPC = resolveRoot(bassLetter, bassAccidental);
    if (bassPC === null) {
      return { ok: false, error: `Invalid bass note: ${slashMatch[1]}` };
    }
    bass = bassPC;
  }

  // Parse quality from remaining string
  const quality = parseQuality(qualityStr);
  if (quality === null) {
    return { ok: false, error: `Unknown quality: '${qualityStr}'` };
  }

  // Slash overrides inversion
  const finalInversion = bass !== undefined ? null : inversion;

  return { ok: true, value: { root, quality, inversion: finalInversion, ...(bass !== undefined && { bass }) } };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/parser.test.ts`
Expected: All tests PASS including 8 new slash chord tests

- [ ] **Step 5: Add slash chord sequence test**

Add to the `parseChordSequence` describe block:

```typescript
it('parses sequence with slash chords', () => {
  const result = parseChordSequence('C/E Am7/G F C13');
  expect(result).toHaveLength(4);
  expect(result.every(r => r.ok)).toBe(true);
  if (result[0]!.ok) {
    expect(result[0]!.value.bass).toBe('E');
  }
  if (result[3]!.ok) {
    expect(result[3]!.value.quality).toBe('Dom13');
  }
});
```

- [ ] **Step 6: Run tests to verify the sequence test passes**

Run: `cd web && npx vitest run src/engine/parser.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/engine/parser.ts web/src/engine/parser.test.ts
git commit -m "feat: parse slash chord bass notes (C/E, Am7/G)"
```

---

### Task 5: Add slashChordPitchClasses to music theory

**Files:**
- Modify: `web/src/engine/musicTheory.ts` (new exported function)
- Test: `web/src/engine/musicTheory.test.ts`

- [ ] **Step 1: Write failing tests for slashChordPitchClasses**

Add a new describe block to `musicTheory.test.ts`:

```typescript
describe('slashChordPitchClasses', () => {
  it('bass is chord tone (C/E) → removes bass from upper, doubles root', () => {
    const result = slashChordPitchClasses('C', 'Major', 'E');
    expect(result).toEqual(['E', 'C', 'G', 'C']);
  });

  it('bass is NOT chord tone, triad (C/Bb) → full triad over bass', () => {
    const result = slashChordPitchClasses('C', 'Major', 'As');
    expect(result).toEqual(['As', 'C', 'E', 'G']);
  });

  it('bass is NOT chord tone, 4-note chord (C7/A) → omit 5th', () => {
    const result = slashChordPitchClasses('C', 'Dom7', 'A');
    expect(result).toEqual(['A', 'C', 'E', 'As']);
  });

  it('bass is chord tone of 4-note chord (C7/E) → remove from upper', () => {
    const result = slashChordPitchClasses('C', 'Dom7', 'E');
    expect(result).toEqual(['E', 'C', 'G', 'As']);
  });

  it('bass is root (C/C) → root in bass, remaining tones upper', () => {
    const result = slashChordPitchClasses('C', 'Major', 'C');
    expect(result).toEqual(['C', 'E', 'G', 'C']);
  });
});
```

Import `slashChordPitchClasses` at the top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/musicTheory.test.ts`
Expected: FAIL — `slashChordPitchClasses` does not exist

- [ ] **Step 3: Implement slashChordPitchClasses**

Add to `web/src/engine/musicTheory.ts` after the `chordPitchClasses` function (after line 66):

```typescript
export function slashChordPitchClasses(
  root: PitchClass,
  quality: ChordType,
  bass: PitchClass,
): PitchClass[] {
  const intervals = chordIntervals(quality);
  const rootInt = pitchClassToInt(root);

  // Get unique pitch classes (deduplicate octave doublings like Major's [0,4,7,12])
  const allPCs = intervals.map(i => pitchClassFromInt(rootInt + i));
  const seen = new Set<PitchClass>();
  const uniquePCs: PitchClass[] = [];
  for (const pc of allPCs) {
    if (!seen.has(pc)) {
      seen.add(pc);
      uniquePCs.push(pc);
    }
  }

  if (seen.has(bass)) {
    // Bass is a chord tone — remove it from upper voices
    const upper = uniquePCs.filter(pc => pc !== bass);
    // If fewer than 3 upper voices, double the root
    while (upper.length < 3) upper.push(root);
    return [bass, ...upper];
  }

  // Bass is NOT a chord tone
  if (uniquePCs.length <= 3) {
    // Triad: full triad sits above the bass
    return [bass, ...uniquePCs];
  }

  // 4+ unique PCs: omit the 5th (interval 7 semitones above root)
  const fifthPC = pitchClassFromInt(rootInt + 7);
  const upper = uniquePCs.filter(pc => pc !== fifthPC);
  // If removing the 5th didn't help (chord has no P5), drop last
  while (upper.length > 3) upper.pop();
  return [bass, ...upper];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/musicTheory.test.ts`
Expected: All tests PASS including 5 new ones

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/musicTheory.ts web/src/engine/musicTheory.test.ts
git commit -m "feat: add slashChordPitchClasses for computing slash chord voicings"
```

---

### Task 6: Integrate slash chords into voice leading

**Files:**
- Modify: `web/src/engine/voiceLeading.ts:144-194` (voiceChordSequence)
- Test: `web/src/engine/voiceLeading.test.ts`

- [ ] **Step 1: Write failing tests for slash chord voice leading**

Add a new describe block to `voiceLeading.test.ts`:

```typescript
describe('voiceChordSequence with slash chords', () => {
  it('slash chord bass is lowest voice (no voice leading)', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null, bass: 'E' },
    ];
    const result = voiceChordSequence(null, chords);
    expect(result).toHaveLength(1);
    const midis = result[0]!.map(pitchToMidi);
    // Bass (E) must be the lowest MIDI note
    expect(midis[0]).toBe(Math.min(...midis));
    expect(result[0]![0]!.pitchClass).toBe('E');
  });

  it('slash chord bass stays lowest with smooth voice leading', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: 0 },
      { root: 'C', quality: 'Major', inversion: null, bass: 'E' },
    ];
    const result = voiceChordSequence('equal', chords);
    expect(result).toHaveLength(2);
    const slashMidis = result[1]!.map(pitchToMidi);
    // Bass (E) must be lowest
    expect(slashMidis[0]).toBe(Math.min(...slashMidis));
    expect(result[1]![0]!.pitchClass).toBe('E');
  });

  it('first chord with slash bass uses bass voicing in smooth mode', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null, bass: 'E' },
      { root: 'G', quality: 'Dom7', inversion: null },
    ];
    const result = voiceChordSequence('equal', chords);
    expect(result).toHaveLength(2);
    const firstMidis = result[0]!.map(pitchToMidi);
    expect(firstMidis[0]).toBe(Math.min(...firstMidis));
    expect(result[0]![0]!.pitchClass).toBe('E');
  });
});
```

Import `pitchToMidi` and `ChordSymbol` at the top of the test file if not already imported.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts`
Expected: FAIL — `voiceChordSequence` doesn't handle `bass` field

- [ ] **Step 3: Implement slash chord handling in voiceChordSequence**

In `web/src/engine/voiceLeading.ts`:

1. Add import of `slashChordPitchClasses` from `./musicTheory`:

```typescript
import { pitchToMidi, midiToPitch, nearestPitch, voiceChord, chordPitchClasses, pitchClassToInt, slashChordPitchClasses } from './musicTheory';
```

2. Add a helper function after `assignOctaves` (after line 142):

```typescript
function voiceSlashChord(
  chord: ChordSymbol,
  prevPitches: Pitch[] | null,
  mode: SmoothMode | null,
  options?: VoiceLeadingOptions,
): Pitch[] {
  const { gravityCenter = DEFAULT_GRAVITY_CENTER } = options ?? {};
  const pcs = slashChordPitchClasses(chord.root, chord.quality, chord.bass!);
  const bassPc = pcs[0]!;
  const upperPCs = pcs.slice(1);

  if (!prevPitches || mode === null) {
    // No previous chord or no voice leading: assign octaves ascending from bass
    const bassPitch = nearestPitch(bassPc, gravityCenter - 12);
    const bassMidi = pitchToMidi(bassPitch);
    const upper = upperPCs.map((pc, i) => {
      const target = bassMidi + 4 + i * 4; // space upper voices above bass
      const p = nearestPitch(pc, target);
      // Ensure above bass
      let midi = pitchToMidi(p);
      if (midi <= bassMidi) midi += 12;
      return midiToPitch(midi);
    });
    return [bassPitch, ...upper];
  }

  // With voice leading: pin bass, smooth upper 3
  const prevSorted = [...prevPitches].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
  const prevBassMidi = pitchToMidi(prevSorted[0]!);
  const bassPitch = nearestPitch(bassPc, prevBassMidi);
  const bassMidi = pitchToMidi(bassPitch);

  const prevUpper = prevSorted.slice(1);
  const smoothed = smoothVoice(mode, prevUpper, upperPCs, options);

  // Ensure all upper voices are above bass
  const result = smoothed.map(p => {
    let midi = pitchToMidi(p);
    if (midi <= bassMidi) midi += 12;
    return midiToPitch(midi);
  });

  return [bassPitch, ...result];
}
```

3. Modify `voiceChordSequence` to use `voiceSlashChord` when `bass` is present. In the `mode === null` branch (lines 156-159), change:

```typescript
  if (mode === null) {
    return chords.map(c =>
      c.explicitVoicing ? voiceExplicit(c)
      : c.bass ? voiceSlashChord(c, null, null, options)
      : voiceChord(c.root, c.quality, c.inversion ?? 0)
    );
  }
```

4. In the first-chord initialization (lines 162-174), add a slash chord check before `explicitVoicing`:

```typescript
  const first = chords[0]!;
  let firstVoicing: Pitch[];
  if (first.bass) {
    firstVoicing = voiceSlashChord(first, null, null, options);
  } else if (first.explicitVoicing) {
    firstVoicing = voiceExplicit(first);
  } else {
```

(The rest of the first-chord block stays the same — the `else {` leads into the existing baseVoicing/gravity shift logic.)

5. In the loop body (lines 179-191), change the voicing logic:

```typescript
    let voicing: Pitch[];
    if (chord.explicitVoicing) {
      voicing = voiceExplicit(chord);
    } else if (chord.bass) {
      voicing = voiceSlashChord(chord, prev, mode, options);
    } else if (chord.inversion !== null) {
      voicing = voiceChord(chord.root, chord.quality, chord.inversion);
    } else {
      voicing = smoothVoice(mode, prev, chordPitchClasses(chord.root, chord.quality), options);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts`
Expected: All tests PASS including 3 new ones

- [ ] **Step 5: Run full test suite**

Run: `cd web && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/engine/voiceLeading.ts web/src/engine/voiceLeading.test.ts
git commit -m "feat: integrate slash chords into voice leading with pinned bass"
```

---

### Task 7: Add Dom13 to chord spelling (reverse identification)

**Files:**
- Modify: `web/src/engine/chordSpelling.ts:14-16` (LOOKUP_TYPES filter)
- Modify: `web/src/engine/chordSpelling.ts:18-22` (PRIORITY array)
- Modify: `web/src/engine/chordSpelling.ts:136-143` (QUALITY_DISPLAY map)
- Test: `web/src/engine/chordSpelling.test.ts`

- [ ] **Step 1: Write failing test for Dom13 identification**

Add to `chordSpelling.test.ts` in the `identifyChord` describe block:

```typescript
it('identifies C Dom13 from [C, E, A, Bb]', () => {
  const result = identifyChord(['C', 'E', 'A', 'As']);
  expect(result).toEqual({ root: 'C', quality: 'Dom13', inversion: 0 });
});

it('identifies Bb Dom13 from [Bb, D, G, Ab]', () => {
  const result = identifyChord(['As', 'D', 'G', 'Gs']);
  expect(result).toEqual({ root: 'As', quality: 'Dom13', inversion: 0 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/chordSpelling.test.ts`
Expected: FAIL — Dom13 is not in LOOKUP_TYPES so it can't be identified

- [ ] **Step 3: Add Dom13 to chord spelling**

In `web/src/engine/chordSpelling.ts`:

1. The `LOOKUP_TYPES` filter (line 14) already excludes 9th chords. Dom13 doesn't start with `Dom9`/`Maj9`/`Min9`, so it will be included automatically. No change needed here.

2. Add `'Dom13'` to the PRIORITY array (line 18), after `'Dom7'`:

```typescript
const PRIORITY: ChordType[] = [
  'Maj7', 'Dom7', 'Dom13', 'Min7', 'Maj6', 'Min6',
  'Dim7', 'HalfDim7', 'MinMaj7',
  'Major', 'Minor', 'Dim', 'Aug', 'Sus4', 'Sus2',
];
```

3. Add `Dom13` to the `QUALITY_DISPLAY` map (line 136):

```typescript
const QUALITY_DISPLAY: Record<ChordType, string> = {
  Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
  Dim: 'dim', Dim7: 'dim7', Aug: 'aug', HalfDim7: 'm7b5',
  Sus4: 'sus4', Sus2: 'sus2', MinMaj7: 'mMaj7', Maj6: '6', Min6: 'm6',
  Dom13: '13',
  Dom9no1: '9-1', Dom9no3: '9-3', Dom9no5: '9-5', Dom9no7: '9-7',
  Maj9no1: 'maj9-1', Maj9no3: 'maj9-3', Maj9no5: 'maj9-5', Maj9no7: 'maj9-7',
  Min9no1: 'm9-1', Min9no3: 'm9-3', Min9no5: 'm9-5', Min9no7: 'm9-7',
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/chordSpelling.test.ts`
Expected: All tests PASS including 2 new ones

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/chordSpelling.ts web/src/engine/chordSpelling.test.ts
git commit -m "feat: add Dom13 to chord spelling reverse identification"
```

---

### Task 8: Add Dom13 to chord suggestions and display maps

**Files:**
- Modify: `web/src/engine/chordSuggestions.ts:22-28` (QUALITY_SUFFIX map)
- Modify: `web/src/engine/romanConverter.ts:14-21` (standardQualitySuffix map)
- Modify: `web/src/engine/romanConverter.ts:31-36` (isMajorLike function)

- [ ] **Step 1: Add Dom13 to QUALITY_SUFFIX in chordSuggestions.ts**

In `web/src/engine/chordSuggestions.ts`, add to the `QUALITY_SUFFIX` map:

```typescript
const QUALITY_SUFFIX: Record<ChordType, string> = {
  Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
  Dim: 'dim', Dim7: 'dim7', Aug: 'aug', HalfDim7: 'm7b5',
  Sus4: 'sus4', Sus2: 'sus2', MinMaj7: 'mMaj7', Maj6: '6', Min6: 'm6',
  Dom13: '13',
  Dom9no1: '9-1', Dom9no3: '9-3', Dom9no5: '9-5', Dom9no7: '9-7',
  Maj9no1: 'maj9-1', Maj9no3: 'maj9-3', Maj9no5: 'maj9-5', Maj9no7: 'maj9-7',
  Min9no1: 'm9-1', Min9no3: 'm9-3', Min9no5: 'm9-5', Min9no7: 'm9-7',
};
```

- [ ] **Step 2: Add Dom13 to standardQualitySuffix in romanConverter.ts**

In `web/src/engine/romanConverter.ts`, add `Dom13: '13'` to the `standardQualitySuffix` map:

```typescript
function standardQualitySuffix(quality: ChordType): string {
  const MAP: Record<ChordType, string> = {
    Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
    Dim: 'dim', Dim7: 'dim7', Aug: 'aug', HalfDim7: 'm7b5',
    Sus4: 'sus4', Sus2: 'sus2', MinMaj7: 'mMaj7', Maj6: '6', Min6: 'm6',
    Dom13: '13',
    Dom9no1: '9-1', Dom9no3: '9-3', Dom9no5: '9-5', Dom9no7: '9-7',
    Maj9no1: 'maj9-1', Maj9no3: 'maj9-3', Maj9no5: 'maj9-5', Maj9no7: 'maj9-7',
    Min9no1: 'm9-1', Min9no3: 'm9-3', Min9no5: 'm9-5', Min9no7: 'm9-7',
  };
  return MAP[quality];
}
```

- [ ] **Step 3: Add Dom13 to isMajorLike in romanConverter.ts**

Dom13 is dominant (major-like), so add it to `isMajorLike`:

```typescript
function isMajorLike(quality: ChordType): boolean {
  return quality === 'Major' || quality === 'Dom7' || quality === 'Maj7'
    || quality === 'Aug' || quality === 'Maj6' || quality === 'Sus4' || quality === 'Sus2'
    || quality === 'Dom13'
    || quality === 'Dom9no1' || quality === 'Dom9no3' || quality === 'Dom9no5' || quality === 'Dom9no7'
    || quality === 'Maj9no1' || quality === 'Maj9no3' || quality === 'Maj9no5' || quality === 'Maj9no7';
}
```

- [ ] **Step 4: Run full test suite**

Run: `cd web && npx vitest run`
Expected: All tests PASS (these are map updates — type checker catches missing entries)

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/chordSuggestions.ts web/src/engine/romanConverter.ts
git commit -m "feat: add Dom13 to display maps and mark as major-like"
```

---

### Task 9: Handle slash chords in Roman numeral parser

**Files:**
- Modify: `web/src/engine/romanParser.ts:40-49` (slash detection in parseRomanChord)
- Test: `web/src/engine/romanParser.test.ts`

- [ ] **Step 1: Write failing tests for Roman slash chord parsing**

Add a new describe block to `romanParser.test.ts`:

```typescript
describe('parseRomanChord slash chords', () => {
  const key: KeySignature = { root: 'C', quality: 'major' };

  it('I/E → C Major with bass E', () => {
    const result = parseRomanChord('I/E', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root).toBe('C');
      expect(result.value.quality).toBe('Major');
      expect(result.value.bass).toBe('E');
    }
  });

  it('V7/B → G Dom7 with bass B (not secondary dominant)', () => {
    const result = parseRomanChord('V7/B', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root).toBe('G');
      expect(result.value.quality).toBe('Dom7');
      expect(result.value.bass).toBe('B');
    }
  });

  it('V7/V → secondary dominant (D Dom7, no bass)', () => {
    const result = parseRomanChord('V7/V', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root).toBe('D');
      expect(result.value.quality).toBe('Dom7');
      expect(result.value.bass).toBeUndefined();
    }
  });

  it('V7/Bb → G Dom7 with bass Bb', () => {
    const result = parseRomanChord('V7/Bb', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root).toBe('G');
      expect(result.value.quality).toBe('Dom7');
      expect(result.value.bass).toBe('As');
    }
  });

  it('V7/bIII → secondary dominant (not slash)', () => {
    const result = parseRomanChord('V7/bIII', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // V7 of bIII (Eb) → Bb7
      expect(result.value.root).toBe('As');
      expect(result.value.quality).toBe('Dom7');
      expect(result.value.bass).toBeUndefined();
    }
  });

  it('IV/C → F Major with bass C', () => {
    const result = parseRomanChord('IV/C', key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.root).toBe('F');
      expect(result.value.quality).toBe('Major');
      expect(result.value.bass).toBe('C');
    }
  });
});
```

Import `KeySignature` if not already imported.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/romanParser.test.ts`
Expected: FAIL — the parser currently treats all `/X` as secondary dominants

- [ ] **Step 3: Implement slash chord detection in Roman parser**

In `web/src/engine/romanParser.ts`, modify the slash handling (lines 40-49). The key insight: after finding a `/`, check if what follows is a letter name (A-G) — if so, it's a slash bass. If it starts with a Roman numeral character or accidental+Roman, it's a secondary dominant.

Replace lines 40-49 with:

```typescript
  const slashIdx = rest.indexOf('/');
  let qualityStr: string;
  let secondaryTarget: string | null = null;
  let slashBass: PitchClass | undefined;

  if (slashIdx !== -1) {
    qualityStr = rest.slice(0, slashIdx);
    const afterSlash = rest.slice(slashIdx + 1);

    // Check if it's a letter name (slash chord bass) vs Roman numeral (secondary dominant)
    const bassMatch = afterSlash.match(/^([A-G][#b]?)$/);
    if (bassMatch) {
      // Slash chord: /E, /Bb, /F#
      const bassLetter = bassMatch[1]![0]!;
      const bassAcc = bassMatch[1]!.length > 1 ? bassMatch[1]![1]! : null;
      const bassPC = resolveRoot(bassLetter, bassAcc);
      if (bassPC === null) {
        return { ok: false, error: `Invalid bass note: '${afterSlash}'` };
      }
      slashBass = bassPC;
    } else {
      // Secondary dominant: /V, /ii, /bIII
      secondaryTarget = afterSlash;
    }
  } else {
    qualityStr = rest;
  }
```

Add the import for `resolveRoot` at the top:

```typescript
import { resolveRoot } from './musicTheory';
```

Then, at the end of the function (line 84), include the `bass` in the return:

```typescript
  return { ok: true, value: { root, quality, inversion, ...(slashBass !== undefined && { bass: slashBass }) } };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/romanParser.test.ts`
Expected: All tests PASS including 6 new ones

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/romanParser.ts web/src/engine/romanParser.test.ts
git commit -m "feat: parse slash chord bass notes in Roman numeral mode"
```

---

### Task 10: Handle slash chords in Roman numeral converter

**Files:**
- Modify: `web/src/engine/romanConverter.ts:66-112` (chordTextToRoman)
- Modify: `web/src/engine/romanConverter.ts:114-135` (romanTextToStandard)
- Test: `web/src/engine/romanConverter.test.ts`

- [ ] **Step 1: Write failing tests for slash chord conversion**

Add to `romanConverter.test.ts`:

```typescript
describe('slash chord conversion', () => {
  const key: KeySignature = { root: 'C', quality: 'major' };

  it('C/E → I/E (standard to roman)', () => {
    expect(chordTextToRoman('C/E', key)).toBe('I/E');
  });

  it('Am7/G → vi7/G (standard to roman)', () => {
    expect(chordTextToRoman('Am7/G', key)).toBe('vim7/G');
  });

  it('I/E → C/E (roman to standard)', () => {
    expect(romanTextToStandard('I/E', key)).toBe('C/E');
  });

  it('vim7/G → Am7/G (roman to standard)', () => {
    expect(romanTextToStandard('vim7/G', key)).toBe('Am7/G');
  });

  it('round-trip: G7/B ↔ V7/B', () => {
    const roman = chordTextToRoman('G7/B', key);
    expect(roman).toBe('V7/B');
    expect(romanTextToStandard(roman, key)).toBe('G7/B');
  });

  it('V7/V stays secondary dominant (not slash)', () => {
    const standard = romanTextToStandard('V7/V', key);
    expect(standard).toBe('D7');
  });
});
```

Import `chordTextToRoman`, `romanTextToStandard`, and `KeySignature` if not already imported.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/romanConverter.test.ts`
Expected: FAIL — converter doesn't handle the `bass` field

- [ ] **Step 3: Implement slash chord handling in chordTextToRoman**

In `web/src/engine/romanConverter.ts`, in the `chordTextToRoman` function, modify the section that builds the Roman string (around line 110). After line 108 (`return \`${invPrefix}V${secQual}/${secDom}\``), and before the final return on line 110, add bass handling. The `parseChord` function now returns `bass` on slash chords, so we need to convert it to a letter name:

Import `pcToStandardName` is already imported. We need `isSharpKey` to determine sharp/flat display. Both are already imported at line 9.

Modify the mapping function (the `tokens.map` lambda). After line 102 (`const invPrefix = ...`), before the `if (secDom)` check, add bass handling. Change the final return (line 110) to include bass:

```typescript
    const bassStr = chord.bass !== undefined
      ? '/' + pcToStandardName(chord.bass, isSharpKey(key))
      : '';

    if (secDom) {
      const secQual = chord.quality === 'Dom7' ? '7' : '';
      return `${invPrefix}V${secQual}/${secDom}`;
    }

    return `${invPrefix}${accStr}${numeral}${qualSuffix}${bassStr}`;
```

- [ ] **Step 4: Implement slash chord handling in romanTextToStandard**

In `romanTextToStandard`, modify the token mapping. After line 131 (`const invPrefix = ...`), add bass handling. The `parseRomanChord` now returns `bass`, which is already a PitchClass. Convert it to a letter name:

```typescript
    const bassStr = chord.bass !== undefined
      ? '/' + pcToStandardName(chord.bass, useSharps)
      : '';

    return `${invPrefix}${rootName}${qualSuffix}${bassStr}`;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/romanConverter.test.ts`
Expected: All tests PASS including 6 new ones

- [ ] **Step 6: Run full test suite**

Run: `cd web && npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/engine/romanConverter.ts web/src/engine/romanConverter.test.ts
git commit -m "feat: handle slash chords in Roman numeral conversion"
```

---

### Task 11: Update SyntaxReference UI

**Files:**
- Modify: `web/src/components/SyntaxReference.tsx`

- [ ] **Step 1: Add Dom13 to QUALITIES array**

In `SyntaxReference.tsx`, add Dom13 to the `QUALITIES` array (after Min-Maj 7):

```typescript
  { display: 'Dom 13', code: '13' },
```

- [ ] **Step 2: Add slash chord section**

Add a new section after the inversions section (after line 124):

```tsx
        <section className="slash-section">
          <h3>Slash (Over) Chords</h3>
          <p className="format-desc">
            Add <code>/note</code> after any chord to specify the bass note.
            The bass is pinned to the lowest voice.
          </p>
          <div className="format-example">
            <span className="fmt-root">chord</span>
            <span className="fmt-quality">/bass</span>
          </div>
          <div className="quality-grid">
            <div className="quality-item">
              <span className="quality-display">C over E</span>
              <code className="quality-code">C/E</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">Am7 over G</span>
              <code className="quality-code">Am7/G</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">C over B♭</span>
              <code className="quality-code">C/Bb</code>
            </div>
          </div>
        </section>
```

- [ ] **Step 3: Verify build succeeds**

Run: `cd web && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/src/components/SyntaxReference.tsx
git commit -m "docs: add Dom13 and slash chords to syntax reference"
```

---

### Task 12: Update App.tsx chord display for slash chords

**Files:**
- Modify: `web/src/App.tsx:253-255` (chordName display)
- Modify: `web/src/engine/chordSpelling.ts:150-155` (chordDisplayName)

- [ ] **Step 1: Update chordDisplayName to show bass**

In `web/src/engine/chordSpelling.ts`, modify `chordDisplayName` to include the bass note:

```typescript
export function chordDisplayName(chord: ChordSymbol): string {
  if (chord.warning) return '?';
  const root = PC_DISPLAY[chord.root] ?? chord.root;
  const quality = QUALITY_DISPLAY[chord.quality] ?? '';
  const bass = chord.bass !== undefined ? `/${PC_DISPLAY[chord.bass] ?? chord.bass}` : '';
  return `${root}${quality}${bass}`;
}
```

- [ ] **Step 2: Update chord name display in App.tsx**

In `web/src/App.tsx`, update the `chordName` computation (line 253) to include bass:

```typescript
  const chordName = currentChord
    ? `${currentChord.root} ${currentChord.quality}${currentChord.bass ? ` / ${currentChord.bass}` : ''}${currentChord.inversion !== null ? ` (inv ${currentChord.inversion})` : ''}`
    : '';
```

- [ ] **Step 3: Verify build succeeds**

Run: `cd web && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/src/engine/chordSpelling.ts web/src/App.tsx
git commit -m "feat: display slash chord bass in chord name and spelled display"
```

---

### Task 13: Update chordSuggestions for slash chord text output

**Files:**
- Modify: `web/src/engine/chordSuggestions.ts:47-49` (chordSymbolToText)

- [ ] **Step 1: Update chordSymbolToText for bass**

In `web/src/engine/chordSuggestions.ts`, update `chordSymbolToText` to include bass:

```typescript
export function chordSymbolToText(chord: ChordSymbol): string {
  const bass = chord.bass ? '/' + ROOT_DISPLAY[chord.bass] : '';
  return ROOT_DISPLAY[chord.root] + QUALITY_SUFFIX[chord.quality] + bass;
}
```

- [ ] **Step 2: Run tests**

Run: `cd web && npx vitest run src/engine/chordSuggestions.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/engine/chordSuggestions.ts
git commit -m "feat: include bass note in chordSymbolToText output"
```

---

### Task 14: Final integration test and build verification

**Files:**
- Test: all test files
- Build: `web/`

- [ ] **Step 1: Run complete test suite**

Run: `cd web && npx vitest run`
Expected: All tests PASS (316 original + ~30 new ≈ 346+)

- [ ] **Step 2: Run TypeScript type check**

Run: `cd web && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 3: Run production build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Final commit if any stragglers**

```bash
git add -A && git status
# Only commit if there are changes
```
