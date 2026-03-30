# Over (Slash) Chords and Dom13 Chords

## Problem

ChordPlay has no way to specify a bass note independent of the chord quality. Barbershop arrangers frequently use slash chords (e.g., `Eb/C`, `Am7/G`) to indicate a specific bass note beneath a chord voicing. Additionally, the dominant 13th chord — a staple of barbershop harmony (the "Waesche 13") — is not supported.

## Features

### Slash Chords

Syntax: `root[quality]/bassNote` — e.g., `C/E`, `Am7/G`, `Eb/C`, `C7/Bb`

The bass note is pinned to the lowest voice. The upper 3 voices contain the chord tones:

- **Bass IS a chord tone** (e.g., `C/E`): The bass note is removed from the upper voice pool. Remaining chord tones fill the upper 3 voices (double the root if fewer than 3 remain).
- **Bass is NOT a chord tone, triad** (e.g., `C/Bb`): The full triad (3 pitch classes) occupies the upper 3 voices. The bass note adds the 4th voice. Nothing is omitted.
- **Bass is NOT a chord tone, 4-note chord** (e.g., `C7/A`): The 5th is omitted from the chord to make room. Upper 3 voices = root, 3rd, 7th (or equivalent).

When `bass` is present, any inversion prefix is ignored.

### Dom13 Chord

Syntax: `C13`, `Bb13`, etc.

Intervals: `[0, 4, 9, 10]` — root, major 3rd, major 6th/13th, minor 7th.

This is a Dom7 with the 5th replaced by the 6th (the barbershop "Waesche 13" voicing: 1-♭7-3-13 from bottom to top).

## Data Model

```typescript
// types.ts — add 'Dom13' to CHORD_TYPES
export const CHORD_TYPES = [
  ...existing,
  'Dom13',
] as const;

// ChordSymbol gains bass field
interface ChordSymbol {
  readonly root: PitchClass;
  readonly quality: ChordType;
  readonly inversion: number | null;
  readonly bass?: PitchClass;
  readonly explicitVoicing?: PitchClass[];
  readonly warning?: boolean;
}
```

## Parser

### Standard Mode

After parsing `[inversion]root[accidental]quality`, check for a `/[A-G][#b]?` suffix:

1. Strip the suffix, parse the bass note via `resolveRoot`
2. Set `bass` on the ChordSymbol, set `inversion` to `null`

Quality `13` maps to `Dom13` (parsed after `9` variants, before `7`).

### Roman Numeral Mode

Slash chords use letter-name bass to avoid conflict with secondary dominants:

- `I/E` — slash chord (I with E in bass)
- `V7/V` — secondary dominant (V7 of V)

Disambiguation: `/[A-G][#b]?` → slash chord bass; `/[b#]?[IViv]+` → secondary dominant. Letter names (A-G) and Roman numerals (I, V, i, v combinations) do not overlap.

## Music Theory

### Dom13 Intervals

```typescript
Dom13: [0, 4, 9, 10]  // root, M3, M6/13, m7
```

### Slash Chord Pitch Classes

New function `slashChordPitchClasses(root, quality, bass)`:

1. Compute unique pitch classes for the chord
2. If bass is a chord tone → remove from set; upper = remaining (double root if < 3)
3. If bass is not a chord tone:
   - ≤3 unique PCs → upper = all chord tones
   - 4 unique PCs → omit the 5th (interval 7 from root)
4. Return `[bass, ...upperVoices]`

### Just Intonation

No changes needed. `justFrequencies` already computes ratios relative to the chord root (the `root` parameter), not the bass note. Slash chords pass `ChordSymbol.root` as the root, so intervals are tuned correctly.

## Voice Leading

When `bass` is set and voice leading is active:

1. **Bass voice**: Find nearest pitch of the bass pitch class to the previous chord's bass, ensuring it stays below the upper voices.
2. **Upper 3 voices**: Run `smoothVoice` on only the 3 upper pitch classes, using the previous chord's upper 3 voices as reference.
3. **Constraint**: All upper voice MIDI values ≥ bass MIDI value.

When voice leading is off: bass at octave 3, upper voices ascending above.

## Roman Numeral Conversion

- Standard → Roman: `C/E` (key of C) → `I/E`. The quality converts to Roman; the bass stays as a letter name.
- Roman → Standard: `I/E` (key of C) → `C/E`. Bass passes through unchanged.
- The `bass` field on ChordSymbol is preserved during conversion.
- `V7/V` remains a secondary dominant — the parser distinguishes by checking if the text after `/` is a letter name or Roman numeral.

## UI Changes

- **SyntaxReference**: Add `13` to qualities table; add row explaining `/bass` syntax.
- **ChordInput**: Syntax highlighting recognizes `/Note` suffix (same color as chord roots).
- **NoteCards**: No changes — displays whatever pitches are computed.
- **URL state**: No new URL key needed — the `bass` field is embedded in the chord text (e.g., `C/E`), which is already URL-encoded as part of the chord string.

## Testing

### Parser

- `C/E` → root=C, quality=Major, bass=E
- `Eb/C` → root=Eb, quality=Major, bass=C
- `Am7/G` → root=A, quality=Min7, bass=G
- `C/Bb` → root=C, quality=Major, bass=Bb
- `C13` → root=C, quality=Dom13
- `1C/E` → inversion ignored, bass=E
- Sequence parsing: `C/E Am7/G F C13`

### Music Theory

- `Dom13` intervals = `[0, 4, 9, 10]`
- `chordPitchClasses('C', 'Dom13')` = `[C, E, A, Bb]`
- `slashChordPitchClasses('C', 'Major', 'E')` → bass=E, upper=[C, G, C]
- `slashChordPitchClasses('C', 'Major', 'Bb')` → bass=Bb, upper=[C, E, G]
- `slashChordPitchClasses('C', 'Dom7', 'A')` → bass=A, upper=[C, E, Bb] (5th omitted)

### Voice Leading

- Slash chord bass stays pinned to lowest voice
- Upper 3 voices smooth independently

### Roman Numeral Disambiguation

- `V7/V` → secondary dominant (not slash)
- `V/B` → slash chord (not secondary dominant)
- `V7/bIII` → secondary dominant
- `V7/Bb` → slash chord
- Round-trip: `G7/B` ↔ `V7/B` ↔ `G7/B`

### Chord Spelling

- Identify `[C, E, A, Bb]` as Dom13
- Slash chords do not need special chord spelling handling — they are voicings of existing chord types, not new pitch class sets. Reverse identification works on pitch classes, which are independent of bass voicing.
