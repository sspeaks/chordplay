# Roman Numeral / Nashville Number Toggle — Design Spec

## Problem

ChordPlay currently only accepts and displays chords in standard letter notation (e.g. `D A7 Bm G`). Musicians frequently think in Roman numeral (scale degree) notation, which is key-independent and reveals harmonic function. Users need the ability to toggle between standard notation and Roman numeral notation, typing and reading chords in either format.

## Approach

Add a dual-parser architecture where both the existing standard parser and a new Roman numeral parser produce the same `ChordSymbol` output type. A notation mode toggle switches which parser is active, and the textarea text is bidirectionally transformed when toggling. A manual key selector (dropdown) provides the tonal context required for Roman numeral interpretation.

## Data Types

### New types in `types.ts`

```typescript
export type NotationMode = 'standard' | 'roman';
export type KeyQuality = 'major' | 'minor';

export interface KeySignature {
  root: PitchClass;
  quality: KeyQuality;
}
```

### Scale degree model (internal to `romanNumerals.ts`)

- Major scale intervals: `[0, 2, 4, 5, 7, 9, 11]` (degrees I–VII)
- Natural minor scale intervals: `[0, 2, 3, 5, 7, 8, 10]` (degrees i–VII)
- A scale degree is a 1–7 number plus an optional chromatic alteration (sharp/flat relative to the diatonic pitch at that degree)

Given a key and a scale degree, we compute the `PitchClass`; given a key and a `PitchClass`, we compute the degree and any accidental.

`ChordSymbol` is unchanged — both parsers produce `{ root: PitchClass, quality: ChordType, inversion: number | null }`.

## Roman Numeral Parser (`romanParser.ts`)

New module alongside `parser.ts`. Parses input like `bVII7`, `#IVdim`, `vi`, `V7/ii`.

### Parse steps (given a `KeySignature`):

1. **Optional inversion prefix**: same as standard parser — `[-]digit` before the numeral
2. **Optional accidental prefix**: `#` or `b` — shifts the resolved root chromatically
3. **Roman numeral**: `I`/`i` through `VII`/`vii` — uppercase implies major, lowercase implies minor as the default quality
4. **Quality suffix**: reuse the shared `parseQuality()` function (extracted from `parser.ts`). If present, overrides the case-implied quality. Supports: `7`, `maj7`, `dim7`, `dim`, `m7b5`, `m7`, `m6`, `min`, `m`, `aug`, `+`, `sus4`, `sus2`, `9`, `6`, `mMaj7`
5. **Optional secondary target**: `/ii`, `/V`, etc. — resolves functionally (see below)
6. **Resolve**: scale degree + accidental + key → `PitchClass` root → `ChordSymbol`

### Secondary dominant resolution

The `/X` suffix is functional, not decorative. It changes how the root is computed:

- Parse the target degree `X` after `/` → resolve to a `PitchClass` using the key
- Treat that `PitchClass` as a temporary local key (always treated as major for secondary dominant purposes)
- Resolve the main numeral relative to the temporary key

Example: `V7/ii` in key of D → target `ii` = E → V of E = B → result: **B7** (`{ root: 'B', quality: 'Dom7' }`)

### Function signatures

```typescript
parseRomanChord(input: string, key: KeySignature): ParseResult<ChordSymbol>
parseRomanSequence(input: string, key: KeySignature): ParseResult<ChordSymbol>[]
```

### Shared quality parser

`parseQuality(s: string): ChordType | null` is extracted from `parser.ts` into a shared location (e.g. `parserUtils.ts` or directly exported from `parser.ts`) so both parsers use it identically.

## Bidirectional Text Conversion (`romanConverter.ts`)

### Standard → Roman (`chordTextToRoman(text, key): string`)

1. Split text on `(\s+)` to preserve whitespace
2. Parse each non-whitespace token with the standard parser → `ChordSymbol`
3. For each chord, compute scale degree + accidental from key + root
4. **Secondary dominant detection**: if a chord is Dom7 (or Major) and its root is a perfect 5th above the *next* chord's root, label it `V7/X` (or `V/X`) where X is the next chord's scale degree in the key
5. Format: accidental prefix + Roman numeral (case from quality) + quality suffix
6. Invalid tokens pass through unchanged
7. Rejoin with original whitespace

### Roman → Standard (`romanTextToStandard(text, key): string`)

1. Split text on `(\s+)` to preserve whitespace
2. Parse each non-whitespace token with the Roman parser → `ChordSymbol`
3. Format each `ChordSymbol` as standard notation: root letter + accidental + quality suffix
4. Invalid tokens pass through unchanged
5. Rejoin with original whitespace

### Display formatting

When formatting Roman numerals for display (in the chord overlay and NoteCards), use Unicode symbols:
- `♭` instead of `b` for flats
- `♯` instead of `#` for sharps
- `°` for diminished (when quality is `Dim` or `Dim7`)

### Roundtrip invariant

`standard → roman → standard` must produce an equivalent chord sequence. This is a key property for testing. Note: enharmonic spelling may normalize (e.g. `Db` and `C#` map to the same `PitchClass`), so equivalence is at the `ChordSymbol` level, not necessarily string-identical.

## Quality suffix formatting

When converting a `ChordSymbol` back to text (in either notation), the quality suffix is determined by the `ChordType`:

| ChordType | Standard suffix | Roman suffix (if case matches) | Roman suffix (if case overrides) |
|-----------|----------------|-------------------------------|----------------------------------|
| Major | *(empty)* | *(empty, uppercase numeral)* | `maj` (if numeral is lowercase) |
| Minor | `m` | *(empty, lowercase numeral)* | `m` (if numeral is uppercase) |
| Dom7 | `7` | `7` | `7` |
| Maj7 | `maj7` | `maj7` | `maj7` |
| Min7 | `m7` | `m7` | `m7` |
| Dim | `dim` | `dim` | `dim` |
| Dim7 | `dim7` | `dim7` | `dim7` |
| Aug | `aug` | `aug` | `aug` |
| HalfDim7 | `m7b5` | `m7b5` | `m7b5` |
| Sus4 | `sus4` | `sus4` | `sus4` |
| Sus2 | `sus2` | `sus2` | `sus2` |
| MinMaj7 | `mMaj7` | `mMaj7` | `mMaj7` |
| Maj6 | `6` | `6` | `6` |
| Min6 | `m6` | `m6` | `m6` |
| Dom9 | `9` | `9` | `9` |

For Roman numerals, the case of the numeral itself encodes major/minor:
- Uppercase (`IV`) implies major — no suffix needed for plain major chords
- Lowercase (`iv`) implies minor — no suffix needed for plain minor chords
- If the quality contradicts the case convention, an explicit suffix is added (e.g. `IVm` for a minor IV — though this is unusual)

## Secondary Dominant Detection

When converting standard → Roman, detect secondary dominants:

1. For each chord at index `i` that has quality `Dom7` (or `Major`):
2. Check if the chord at index `i+1` exists
3. Compute the interval from chord `i`'s root to chord `i+1`'s root
4. If the interval is a perfect 5th down (7 semitones down, or equivalently 5 semitones up), chord `i` is a secondary dominant of chord `i+1`
5. Label chord `i` as `V7/X` (or `V/X` for Major) where `X` is chord `i+1`'s scale degree
6. Skip detection for the chord that is already the diatonic V (it's just `V7`, not `V7/I`)

Fall back to plain accidental notation (e.g. `♭V7`) when the chord doesn't match the secondary dominant pattern.

## UI Components & State Management

### New state in `App.tsx`

```typescript
const [notationMode, setNotationMode] = useState<NotationMode>('standard');
const [selectedKey, setSelectedKey] = useState<KeySignature>({ root: 'C', quality: 'major' });
```

### Mode toggle handler

When `notationMode` changes:
- `standard → roman`: `setChordText(chordTextToRoman(chordText, selectedKey))`
- `roman → standard`: `setChordText(romanTextToStandard(chordText, selectedKey))`

### Key change handler

When the selected key changes while in Roman mode:
1. Convert current Roman text → standard (using old key)
2. Convert standard → Roman (using new key)
3. Update both `chordText` and `selectedKey`

### Parser routing

```typescript
const parseResults = notationMode === 'standard'
  ? parseChordSequence(chordText)
  : parseRomanSequence(chordText, selectedKey);
```

Everything downstream (voicings, playback, NoteCards) remains unchanged — they all operate on `ChordSymbol[]`.

### Toolbar additions

- New `ToggleGroup` for notation mode: `Standard` / `Roman`
- **Key selector dropdown** (visible only when notation mode is `roman`): lists all 24 keys (12 pitch classes × major/minor), formatted as `D major`, `D minor`, `E♭ major`, etc.

### Key selector dropdown

The dropdown groups or lists keys in circle-of-fifths order for usability:
- Major: C, G, D, A, E, B, F♯/G♭, D♭, A♭, E♭, B♭, F
- Minor: Am, Em, Bm, F♯m, C♯m, G♯m/A♭m, E♭m, B♭m, Fm, Cm, Gm, Dm

## File Structure

New files:
- `web/src/engine/romanNumerals.ts` — scale degree ↔ pitch class logic, key model
- `web/src/engine/romanParser.ts` — Roman numeral chord parser
- `web/src/engine/romanConverter.ts` — bidirectional text conversion, secondary dominant detection
- `web/src/engine/romanNumerals.test.ts` — unit tests for scale degree logic
- `web/src/engine/romanParser.test.ts` — unit tests for Roman parser
- `web/src/engine/romanConverter.test.ts` — unit tests for conversion and roundtripping

Modified files:
- `web/src/types.ts` — add `NotationMode`, `KeyQuality`, `KeySignature`
- `web/src/engine/parser.ts` — extract `parseQuality()` as a named export
- `web/src/App.tsx` — add state, parser routing, mode toggle handler, key change handler
- `web/src/components/Toolbar.tsx` — add notation mode toggle and key selector dropdown

## Testing Strategy

### Unit tests

1. **Scale degree resolution** (`romanNumerals.test.ts`): pitch class ↔ degree for major and minor keys, with accidentals
2. **Roman numeral parsing** (`romanParser.test.ts`): each numeral I–VII, accidentals, all quality suffixes, secondary dominants (`V7/ii`, `V7/V`), inversions, edge cases
3. **Bidirectional conversion** (`romanConverter.test.ts`): standard → Roman, Roman → standard, secondary dominant detection
4. **Roundtrip property**: `standard → roman → standard` produces equivalent `ChordSymbol[]` for diverse chord sequences across multiple keys
5. **Edge cases**: invalid tokens passed through, empty input, single chord, all 24 keys

### Existing test preservation

The existing `parser.test.ts`, `musicTheory.test.ts`, and `voiceLeading.test.ts` must continue passing. The only change to `parser.ts` is exporting `parseQuality` — no behavioral change.
