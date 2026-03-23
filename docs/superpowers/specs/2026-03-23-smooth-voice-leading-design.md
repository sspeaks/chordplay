# Smooth Voice Leading

## Problem

Chordplay voices each chord independently — every chord starts from a fixed octave-3 root position (or user-specified inversion) with no awareness of what came before. In barbershop music, voice parts move by small intervals (often chromatic half-steps, especially in the bass). Playing `Bb7 Eb` with independent voicings produces jarring leaps when the voices could walk smoothly.

## Approach

Add `--smooth` and `--smooth-bass` CLI flags (and corresponding REPL commands) that enable greedy pairwise voice leading optimization. For each chord transition, the algorithm finds the assignment of pitch classes to voices and octave placement that minimizes total half-step movement from the previous chord.

## Algorithm: Greedy Pairwise Optimization

Given the previous chord's 4 absolute pitches and the next chord's 4 pitch classes:

1. Generate all 24 permutations of the next chord's pitch classes.
2. For each permutation, for each voice slot `i`, find the octave that places `pitchClass[i]` closest (by MIDI number) to `prevPitch[i]`.
3. Compute the weighted cost: `sum of weight[i] * |prevMidi[i] - newMidi[i]|` for voices 0–3.
4. Select the permutation with the lowest cost.

### Octave Selection

For a target MIDI number `t` and a pitch class with chromatic offset `pc`:

```
bestOctave = round((t - pc) / 12) - 1
candidateMidi = (bestOctave + 1) * 12 + pc
```

Check the two nearest octaves and pick whichever yields `|candidateMidi - t|` minimal.

### Weighting Modes

- **`SmoothEqual`**: All voices weighted equally `[1, 1, 1, 1]`.
- **`SmoothBass`**: Bass voice (voice 0 — the lowest pitch after sorting the previous chord) weighted double `[2, 1, 1, 1]`.

### Search Space

24 permutations × O(1) octave lookup per voice = 24 evaluations per chord transition. Negligible cost.

## Data Type Changes

### `SmoothMode`

New type in `MusicTheory.hs`:

```haskell
data SmoothMode = SmoothEqual | SmoothBass
  deriving (Eq, Show)
```

### `ChordSymbol` Inversion Field

Change `csInversion :: Int` to `csInversion :: Maybe Int`.

- `Nothing` = no explicit inversion (smooth mode is free to choose).
- `Just n` = user-specified inversion, overrides smooth optimization.

The parser returns `Nothing` when no inversion prefix is present, `Just n` when one is.

## New Functions

### `smoothVoice`

```haskell
smoothVoice :: SmoothMode -> [Pitch] -> [PitchClass] -> [Pitch]
```

Core algorithm. Takes previous chord pitches and next chord's pitch classes, returns optimally placed pitches.

### `voiceChordSequence`

```haskell
voiceChordSequence :: Maybe SmoothMode -> [ChordSymbol] -> [[Pitch]]
```

- `Nothing`: Current behavior. Each chord voiced independently via `voiceChord`.
- `Just mode`: First chord uses its explicit inversion (or root position if `Nothing`). Each subsequent chord:
  - If `csInversion` is `Just n`: use `voiceChord` with that inversion (explicit override).
  - If `csInversion` is `Nothing`: use `smoothVoice` relative to the previous chord's pitches.

## Voice Assignment

Voices are not constrained to SATB ordering. The algorithm freely assigns any pitch class to any voice slot and allows voice crossing when that produces less total movement. This matches barbershop practice where parts frequently cross (especially tenor and lead).

## CLI Interface

### Flags

```
chordplay --smooth [file]        # Equal-weight smooth voice leading
chordplay --smooth-bass [file]   # Bass-weighted smooth voice leading
```

Flags compose with existing flags:

```
chordplay --smooth --arp file    # Smooth + arpeggio
chordplay --smooth-bass --edit f # Smooth-bass + editor mode
```

### REPL Commands

```
:smooth       — Enable equal-weight smooth mode
:smooth-bass  — Enable bass-weighted smooth mode
:nosmooth     — Disable smooth mode
```

These are independent of `:arp` / `:block` (smooth affects voicing; arp/block affects playback timing).

## Integration

### `Repl.hs`

- Add `Maybe SmoothMode` to REPL state alongside the existing `Bool` for arpeggio.
- `playLine` changes from mapping `chordToNotes` over each chord to calling `voiceChordSequence` on the whole list.
- Add `:smooth`, `:smooth-bass`, `:nosmooth` command handlers.

### `Main.hs`

- Parse `--smooth` and `--smooth-bass` from argv.
- Thread `Maybe SmoothMode` into REPL and batch mode entry points.

### `Parser.hs`

- Update `parseChord` to return `csInversion = Nothing` when no inversion prefix is present.
- All call sites that pattern-match on `csInversion` must handle `Maybe Int`.

## Testing

### Unit Tests (MusicTheorySpec)

- `smoothVoice` with identical chord (no movement needed).
- `smoothVoice` with chromatic bass walk (e.g., Bb7 → Eb: bass moves Bb→Eb by minimal path).
- `smoothVoice` with common tones (shared pitch classes stay in place).
- `smoothVoice` `SmoothBass` vs `SmoothEqual` produces different results on an asymmetric case.
- `voiceChordSequence Nothing` matches current independent voicing.
- `voiceChordSequence (Just mode)` with explicit inversion mid-sequence respects the override.

### Parser Tests

- Chord without inversion prefix → `csInversion = Nothing`.
- Chord with `0` prefix → `csInversion = Just 0`.
- Chord with `2` prefix → `csInversion = Just 2`.

### Integration Tests

- Full chord sequence through `voiceChordSequence` produces valid 4-note chords.
- Total half-step movement in smooth mode ≤ independent voicing for typical barbershop progressions.
