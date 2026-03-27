# Chord Spelling Feature Design

## Problem

Users currently enter chords by name (e.g., `Cmaj7`, `Am7`). Sometimes it's more natural to spell a chord by its individual notes — especially when exploring unfamiliar voicings or when you know the notes but not the chord name. This feature adds a parenthesized note syntax so users can type `(F A C Eb)` inline and have it identified as `F7`.

## Approach

Extend the existing `ChordSymbol` type with optional fields for explicit voicing and warning state. Add a reverse chord identification module. Integrate the new syntax into the existing parser so both notations coexist in the same textarea.

Additionally, remove the default "jazzy Happy Birthday" progression from the textarea so it starts empty.

## Design

### Type Changes — `src/types.ts`

Extend `ChordSymbol` with two optional fields:

```typescript
interface ChordSymbol {
  root: PitchClass;
  quality: ChordType;
  inversion: number | null;
  explicitVoicing?: PitchClass[];  // bypass voice leading, play these notes in order
  warning?: boolean;               // true if notes didn't match any known chord type
}
```

- `explicitVoicing`: When set, the audio path uses these pitch classes directly (assigned ascending octaves) instead of computing voicing from `voiceChord()`.
- `warning`: When set, the chord overlay displays with an amber/warning color instead of green. Used when 4 notes don't match any known chord quality.
- For unrecognized spellings: `root` is the first note, `quality` defaults to Major, `warning: true`, and `explicitVoicing` is still set so the notes play.

### Reverse Chord Identification — `src/engine/chordSpelling.ts`

New module with the following exports:

```typescript
parseSpelledChord(input: string): ParseResult<ChordSymbol>
```

Algorithm:

1. **Parse notes**: Strip parentheses, split on whitespace, parse each token as a note name (letter `A`–`G` + optional `#` or `b`). Must have exactly 4 notes; otherwise fail. After mapping to pitch classes, require at least 3 distinct pitch classes; 2 or fewer distinct → warn.
2. **Convert to pitch classes**: Map each note name to a `PitchClass`. Enharmonic equivalents resolve to the same `PitchClass` (e.g., `Ab` → `Gs`, `D#` → `Ds`). The display layer uses context-aware enharmonic spelling for output, so `Ab` input will display correctly.
3. **Reverse lookup**: Only match against "full" chord types (exclude `*no1`, `*no3`, `*no5`, `*no7` 9th-chord voicings, since those omit a chord tone and their "root" may not be in the voicing). Deduplicate the pitch classes for matching purposes:
   - **4 distinct PCs** → match against 4-note chord types (7th chords, 6th chords) first. If no match, try triads (the 4th note is a doubled octave).
   - **3 distinct PCs** (one note doubled) → match against triads only (Major, Minor, Dim, Aug, Sus4, Sus2).
   - For each candidate root among the distinct PCs:
     - Compute intervals from root to the other distinct notes (mod 12).
     - Sort the interval set (including 0 for root).
     - Compare against normalized chord interval patterns.
   - **Disambiguation**: Root-position matches preferred over inversions. Among same-root matches, prefer 7th/6th chords over triads (more specific match wins). If both are root position with same interval count, use priority order: Maj7 > Dom7 > Min7 > Maj6 > Min6 > Dim7 > HalfDim7 > MinMaj7 > Major > Minor > Dim > Aug > Sus4 > Sus2.
4. **Detect inversion**: If the first input note is not the identified root, determine inversion from the note's position in the chord's interval stack (1st inversion = 3rd in bass, 2nd = 5th in bass, etc.).
5. **No match**: Return success with `warning: true`, `root` = first note, `quality` = Major.
6. **Set `explicitVoicing`**: Always set to the 4 parsed pitch classes in input order.

Note name parsing accepts: `C`, `D`, `Eb`, `F#`, `Gb`, `A#`, etc.

### Parser Integration — `src/engine/parser.ts`

Modify `parseChordSequence()` to handle parenthesized groups:

1. **Tokenizer change**: Instead of simple whitespace split, scan the input string:
   - When encountering `(`, capture everything through the matching `)` as one token (including parens).
   - **Malformed parens**: Unclosed `(` (no matching `)`) → treat entire remainder as a failed parse token. Empty `()` → failed parse. Nested `((` → treat inner `(` as literal text (no nesting support).
   - Otherwise split on whitespace as before.
2. **Routing**: For each token:
   - Starts with `(` → call `parseSpelledChord()` from `chordSpelling.ts`.
   - Otherwise → existing `parseChord()`.
3. **Return type unchanged**: Still `ParseResult<ChordSymbol>[]`.

The Roman numeral parser (`romanParser.ts`) does not need changes — spelled chords are note-name-based and notation-mode-independent.

### Audio Path — `src/App.tsx`

When building the `Pitch[]` array for playback:

- **If `chord.explicitVoicing` is set**:
  1. Convert pitch classes to semitone values (C=0 through B=11).
  2. Assign ascending octaves in **input order**: the first note is lowest, each subsequent note must be higher. If a pitch class's semitone value is ≤ the prior note's, bump its octave. (Input order defines pitch order — `(G E C B)` means G is lowest, then E, C, B highest.)
  3. Try starting octaves 2–5 and pick the one where the **mean MIDI value** of all 4 notes is closest to the gravity center.
  4. Skip `voiceChord()` and voice leading entirely.
- **Otherwise**: Existing voice leading + `voiceChord()` path unchanged.

### Display — `src/components/ChordInput.tsx`

The chord input overlay currently colors each chord green (valid) or red (invalid):

- **Spelled chord, recognized** (`explicitVoicing` set, `warning` falsy): Green, display identified chord name (e.g., "Fmaj7").
- **Spelled chord, unrecognized** (`warning: true`): Amber/yellow, display the raw note text.
- **Regular chord**: Existing behavior unchanged.

The raw `(F A C E)` text stays in the textarea; the colored overlay shows the identified name or raw notes.

### Syntax Reference — `src/components/SyntaxReference.tsx`

Add a section documenting the parenthesized note syntax:
- Format: `(Note Note Note Note)` — exactly 4 notes in parentheses
- Notes: letter A–G with optional `#` or `b`
- Example: `(F A C Eb)` → F7, `(C E G B)` → Cmaj7
- Notes are played in the order given (first note = lowest pitch)

### Default Textarea — `src/App.tsx`

Remove the default "jazzy Happy Birthday" chord progression. The textarea starts empty.

## Testing

### Unit Tests — `src/engine/chordSpelling.test.ts`

- **Note parsing**: `F` → F, `Eb` → Ds, `F#` → Fs, invalid notes fail
- **Enharmonic equivalents**: `Ab` and `G#` both map to `Gs`
- **Chord identification**: `(C E G B)` → Cmaj7, `(F A C Eb)` → F7, `(D F A C)` → Dm7, etc.
- **Ambiguous chords**: `(C E G A)` → C6 (root position preferred over Am7 1st inversion)
- **Inversion detection**: `(E G C E)` → C major, 1st inversion
- **Unrecognized spellings**: `(C D E F)` → warning, first note as root
- **Duplicate pitch classes**: `(C C E G)` → identified as C major (3 distinct PCs, triad with doubling)
- **Too few distinct PCs**: `(C C C E)` → warning (only 2 distinct pitch classes)
- **Exactly 4 notes**: 3 notes fail, 5 notes fail
- **Accidentals**: both `#` and `b` accepted, `Eb` and `D#` both work

### Integration Tests — `src/engine/parser.test.ts`

- Mixed sequences: `Cmaj7 (F A C Eb) Dm7` parses correctly
- Parenthesized groups tokenized as single units
- Adjacent spelled chords: `(C E G B) (F A C Eb)`
- Malformed parens: unclosed `(C E G` → parse failure, empty `()` → parse failure

### Existing Tests

All existing tests must continue to pass. The type extension is additive (optional fields), so no breakage expected.
