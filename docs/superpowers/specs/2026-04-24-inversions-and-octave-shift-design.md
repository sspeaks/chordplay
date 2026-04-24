# Inversions & Octave Shift — Design Spec

## Problem

Inversions currently make chords jump up in register. `rotateUp` takes the bottom note and moves it an octave higher, and inverted chords bypass voice leading entirely. This is wrong musically — inversions should specify which chord tone is in the bass while keeping the chord in roughly the same register.

Separately, there's no syntax for intentionally shifting a chord's register (up/down by octaves), which is useful now that inversions will no longer have that side effect.

## Changes

### 1. Fix Inversion Behavior

**Inversions = "which chord tone is in the bass."** The inversion number selects the Nth tone from the chord's interval stack (0 = root, 1 = 2nd tone, 2 = 3rd tone, etc.) and forces it into the bass voice.

#### Voice leading OFF

Replace `rotateUp`/`rotateDown` with register-neutral rearrangement:

1. Build the chord from intervals as before (root at octave 3).
2. Identify the pitch at index N in the interval stack.
3. Pull that pitch down below the others (drop its octave as needed).
4. The remaining three voices stay in place.

Example — `1D` (first inversion D major, intervals [0,4,7,12]):
- Base: D3, F#3, A3, D4
- Bass = F# (index 1) → drop to F#2
- Result: F#2, D3, A3, D4

Example — `2D7` (second inversion D7, intervals [0,4,7,10]):
- Base: D3, F#3, A3, C4
- Bass = A (index 2) → drop to A2
- Result: A2, D3, F#3, C4

All four notes are always preserved.

#### Voice leading ON (the core change)

Currently `voiceChordSequence` bypasses smooth voice leading when `chord.inversion !== null` (line 147-148 of voiceLeading.ts). The new behavior integrates inversions into voice leading:

1. Get the chord's 4 pitch classes via `chordPitchClasses()`.
2. Determine the bass pitch class from the inversion number (Nth tone in interval stack).
3. **Bass voice**: Place the bass pitch class near the previous bass note using `nearestPitch()`, biased downward, ensuring it is the lowest voice.
4. **Upper 3 voices**: Run the existing `smoothVoice()` optimizer on the remaining 3 pitch classes against the previous upper 3 voices.
5. Combine: `[bass, ...upper3]` sorted low-to-high.

This means inversions participate in voice leading with a hard constraint on the bass note.

### 2. Octave Shift Syntax

New suffix syntax on chords to shift register by whole octaves:

| Syntax | Meaning |
|--------|---------|
| `D7^`  | Up 1 octave |
| `D7^^` | Up 2 octaves |
| `D7_`  | Down 1 octave |
| `D7__` | Down 2 octaves |

Combinable with inversions: `1D7^` = first inversion D7, one octave up.

#### Implementation

**Voice leading ON**: Temporarily adjust the gravity center for that chord by `octaveShift * 12` semitones. The next chord reverts to its own gravity center (default or shifted), so the sequence transitions smoothly.

**Voice leading OFF**: After building the voicing via `voiceChord()`, shift all pitches by `octaveShift * 12` semitones.

## Type Changes

```ts
interface ChordSymbol {
  root: PitchClass;
  quality: ChordType;
  inversion: number | null;  // existing field, unchanged
  octaveShift: number;       // NEW: 0 = default, +N = up N octaves, -N = down
}
```

Default `octaveShift: 0` everywhere for backward compatibility.

## Parser Changes

In `parseChord()`, after parsing root + accidental and before calling `parseQuality()`:

1. Take the remaining string (e.g. `7^^` for `D7^^`).
2. Strip trailing `^` and `_` characters from the end.
3. Pass the stripped string to `parseQuality()` (e.g. `7`).
4. Count stripped `^` → positive octave shift; count `_` → negative.
5. Mixed `^` and `_` in the same chord is a parse error.

**Negative inversions**: The current parser supports `-1D`. In the new model, inversion numbers are clamped to valid indices in the chord's interval stack (0 to length-1). Negative values are treated as 0 (root position). This matches the music theory convention where inversions are non-negative.

Examples:
- `D7^` → `{ root: 'D', quality: 'Dom7', inversion: null, octaveShift: 1 }`
- `1D7^^` → `{ root: 'D', quality: 'Dom7', inversion: 1, octaveShift: 2 }`
- `D__` → `{ root: 'D', quality: 'Major', inversion: null, octaveShift: -2 }`
- `-1D` → treated as `{ root: 'D', quality: 'Major', inversion: 0, octaveShift: 0 }`

## UI Changes

Minimal — no new controls:

- **SyntaxReference.tsx**: Add `^`/`_` octave shift to the syntax table.
- **ChordInput.tsx**: Recognize `^`/`_` as valid suffixes in syntax highlighting (no red error).
- **NoteCards.tsx**: No changes — displays whatever voicing the engine produces.

## Testing

### Parser tests
- `D7^` → octaveShift 1
- `D__` → octaveShift -2
- `1D7^` → inversion 1 + octaveShift 1
- `D7` → octaveShift 0 (backward compat)
- `D^^^` → octaveShift 3
- Mixed `^_` → parse error

### Inversion voicing tests (voice leading off)
- `1D` → F# is the lowest pitch, all 4 notes present, register ≈ same as root position D
- `2D7` → A is the bass, register similar to root position
- No unison collisions

### Inversion + voice leading tests
- Sequence `D 1D G` → F# forced to bass on second chord, smooth transitions
- Bass note is correct for each inversion value
- Upper voices minimize movement from previous chord

### Octave shift tests
- `D^` produces voicing ~12 semitones higher centroid than `D`
- `D_` produces voicing ~12 semitones lower centroid
- Combined `1D^` — correct bass note in the shifted register

### Regression tests
- Existing chord sequences without inversions or shifts produce identical voicings to current behavior
