# Smooth Voice Leading

## Problem

Chordplay voices each chord independently — every chord starts from a fixed octave-3 root position (or user-specified inversion) with no awareness of what came before. In barbershop music, voice parts move by small intervals (often chromatic half-steps, especially in the bass). Playing `Bb7 Eb` with independent voicings produces jarring leaps when the voices could walk smoothly.

## Approach

Add `--smooth` and `--smooth-bass` CLI flags (and corresponding REPL commands) that enable greedy pairwise voice leading optimization. For each chord transition, the algorithm finds the assignment of pitch classes to voices and octave placement that minimizes total half-step movement from the previous chord.

## Algorithm: Greedy Pairwise Optimization

Given the previous chord's 4 absolute pitches (sorted ascending by MIDI) and the next chord's 4 pitch classes (which may contain duplicates — see below):

1. Sort the previous chord's pitches ascending by MIDI number. Voice indices 0–3 correspond to lowest-to-highest.
2. Compute the next chord's 4 pitch classes from its intervals: `map (\i -> pitchClassFromInt ((fromEnum root + i) `mod` 12)) (chordIntervals quality)`.
3. Generate all 24 permutations of these 4 pitch classes. (Chords with duplicate pitch classes — e.g., Major `[0,4,7,12]` where 0 and 12 are the same pitch class — will produce some equivalent permutations. This is harmless: redundant evaluations yield the same cost and don't affect correctness.)
4. For each permutation, for each voice slot `i`, find the octave that places `pitchClass[i]` closest (by MIDI number) to `prevPitch[i]` using the octave selection algorithm below.
5. Compute the weighted cost: `sum of weight[i] * |prevMidi[i] - newMidi[i]|` for voices 0–3.
6. Select the permutation with the lowest cost. Ties are broken by preferring the permutation whose maximum single-voice movement is smallest (spread the movement evenly).

### Octave Selection

For a target MIDI number `t` and a pitch class with chromatic offset `pc`:

```
octFloat = (fromIntegral t - fromIntegral pc) / 12.0 - 1.0
octLow   = floor octFloat
octHigh  = ceiling octFloat
midiLow  = (octLow + 1)  * 12 + pc
midiHigh = (octHigh + 1) * 12 + pc
```

Pick the octave whose candidate MIDI is closest to `t`:
- If `|midiLow - t| < |midiHigh - t|`, use `octLow`.
- If `|midiHigh - t| < |midiLow - t|`, use `octHigh`.
- If tied (equidistant), use `octLow` (prefer the lower octave to keep voicings compact).

When `octLow == octHigh` (exact integer), there is only one candidate.

### Weighting Modes

Previous chord's pitches are sorted ascending by MIDI before applying weights. Voice 0 is always the lowest-sounding pitch in the previous chord, voice 3 the highest.

- **`SmoothEqual`**: All voices weighted equally `[1, 1, 1, 1]`.
- **`SmoothBass`**: Bass voice (voice 0, the lowest pitch) weighted double `[2, 1, 1, 1]`.

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

#### Downstream Call Site Changes

The `voiceChord` and `voiceChordSafe` signatures remain unchanged (`Int` parameter). The `Maybe` is unwrapped at the boundary with `fromMaybe 0`. Specific changes:

| File | Location | Current | New |
|------|----------|---------|-----|
| `MusicTheory.hs:31-35` | `ChordSymbol` record | `csInversion :: Int` | `csInversion :: Maybe Int` |
| `Parser.hs:28` | `chordP` constructor | `ChordSymbol root qual inv` | unchanged (but `inv` is now `Maybe Int`) |
| `Parser.hs:31` | `inversionP` return type | `Parser Int` | `Parser (Maybe Int)` — returns `Nothing` when no prefix, `Just n` when present |
| `Repl.hs:84` | `chordToNotes` | `voiceChord root qual inv` | `voiceChord root qual (fromMaybe 0 inv)` |
| `Repl.hs:118-122` | `showChordSymbol` | `if inv == 0 then "" else show inv` | `maybe "" show inv` |

#### Test Changes

All `ParserSpec.hs` tests that construct `ChordSymbol` with a bare `Int` must change. Chords parsed without an inversion prefix get `Nothing`; those with an explicit prefix get `Just n`:

| Test input | Current expected | New expected |
|------------|-----------------|--------------|
| `"C"` | `ChordSymbol C Major 0` | `ChordSymbol C Major Nothing` |
| `"Cmaj"` | `ChordSymbol C Major 0` | `ChordSymbol C Major Nothing` |
| `"Am"` | `ChordSymbol A Minor 0` | `ChordSymbol A Minor Nothing` |
| `"Bb7"` | `ChordSymbol As Dom7 0` | `ChordSymbol As Dom7 Nothing` |
| `"F#m7"` | `ChordSymbol Fs Min7 0` | `ChordSymbol Fs Min7 Nothing` |
| `"Ebmaj7"` | `ChordSymbol Ds Maj7 0` | `ChordSymbol Ds Maj7 Nothing` |
| `"Gdim7"` | `ChordSymbol G Dim7 0` | `ChordSymbol G Dim7 Nothing` |
| `"C+"` | `ChordSymbol C Aug 0` | `ChordSymbol C Aug Nothing` |
| `"Caug"` | `ChordSymbol C Aug 0` | `ChordSymbol C Aug Nothing` |
| `"Cm7b5"` | `ChordSymbol C HalfDim7 0` | `ChordSymbol C HalfDim7 Nothing` |
| `"Csus4"` | `ChordSymbol C Sus4 0` | `ChordSymbol C Sus4 Nothing` |
| `"CmMaj7"` | `ChordSymbol C MinMaj7 0` | `ChordSymbol C MinMaj7 Nothing` |
| `"C6"` | `ChordSymbol C Maj6 0` | `ChordSymbol C Maj6 Nothing` |
| `"Cm6"` | `ChordSymbol C Min6 0` | `ChordSymbol C Min6 Nothing` |
| `"1G7"` | `ChordSymbol G Dom7 1` | `ChordSymbol G Dom7 (Just 1)` |
| `"2Eb"` | `ChordSymbol Ds Major 2` | `ChordSymbol Ds Major (Just 2)` |
| `"-1G7"` | `ChordSymbol G Dom7 (-1)` | `ChordSymbol G Dom7 (Just (-1))` |
| `"0C"` | `ChordSymbol C Major 0` | `ChordSymbol C Major (Just 0)` |
| `"Bb7 2Eb Fm7"` | `[..As Dom7 0, ..Ds Major 2, ..F Min7 0]` | `[..As Dom7 Nothing, ..Ds Major (Just 2), ..F Min7 Nothing]` |

## New Functions

### `chordPitchClasses`

```haskell
chordPitchClasses :: PitchClass -> ChordType -> [PitchClass]
```

Extracts the 4 pitch classes for a chord. This list may contain duplicates (e.g., Major `[0,4,7,12]` produces `[C, E, G, C]`). The smooth voicing algorithm treats each as an independent voice slot.

### `smoothVoice`

```haskell
smoothVoice :: SmoothMode -> [Pitch] -> [PitchClass] -> [Pitch]
```

Core algorithm. Takes previous chord pitches (sorted ascending) and next chord's pitch classes (4 elements, possibly with duplicates), returns optimally placed pitches.

### `nearestPitch`

```haskell
nearestPitch :: PitchClass -> Int -> Pitch
```

Given a pitch class and a target MIDI number, returns the `Pitch` in the octave closest to the target (using the octave selection algorithm above).

### `voiceChordSequence`

```haskell
voiceChordSequence :: Maybe SmoothMode -> [ChordSymbol] -> [[Pitch]]
```

- `Nothing`: Current behavior. Each chord voiced independently via `voiceChord`.
- `Just mode`: First chord uses its explicit inversion (or root position if `Nothing`). Each subsequent chord:
  - If `csInversion` is `Just n`: use `voiceChord` with that inversion (explicit override).
  - If `csInversion` is `Nothing`: use `smoothVoice` relative to the previous chord's pitches.

### Edge Cases

- **Empty chord list** (`[]`): returns `[]`.
- **Single chord**: voiced using its explicit inversion or root position. No smooth optimization needed.
- **All chords have explicit inversions**: each is voiced independently (smooth mode has no effect, which is correct).

## Voice Assignment

Voices are not constrained to SATB ordering. The algorithm freely assigns any pitch class to any voice slot and allows voice crossing when that produces less total movement. This matches barbershop practice where parts frequently cross (especially tenor and lead).

## CLI Interface

### Flags

```
chordplay --smooth [file]        # Equal-weight smooth voice leading
chordplay --smooth-bass [file]   # Bass-weighted smooth voice leading
```

`--smooth` and `--smooth-bass` are mutually exclusive. Passing both is an error (print usage and exit).

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

In the REPL, the last-issued command wins (`:smooth-bass` overrides a previous `:smooth`).

These are independent of `:arp` / `:block` (smooth affects voicing; arp/block affects playback timing).

## Integration

### `Repl.hs`

- Add `Maybe SmoothMode` to `ReplState` alongside the existing `rsArpeggio :: Bool`.
- `repl` gains a `Maybe SmoothMode` parameter (threaded from `Main.hs`).
- `playLine` changes from mapping `chordToNotes` over each chord to calling `voiceChordSequence` on the whole list.
- Add `:smooth`, `:smooth-bass`, `:nosmooth` command handlers.

### `Main.hs`

- Parse `--smooth` and `--smooth-bass` from argv.
- Thread `Maybe SmoothMode` into `repl`, `runBatch`, and `runEditMode`.

Updated signatures:

```haskell
repl        :: Maybe SmoothMode -> IO ()
runBatch    :: FilePath -> Bool -> Maybe SmoothMode -> IO ()
runEditMode :: FilePath -> Bool -> Maybe SmoothMode -> IO ()
```

### `Parser.hs`

- Change `inversionP :: Parser Int` to `inversionP :: Parser (Maybe Int)`.
  - No prefix → `Nothing`.
  - Digit (with optional `-`) → `Just n`.

## Testing

### Unit Tests (MusicTheorySpec)

- `chordPitchClasses C Major` returns `[C, E, G, C]` (note the duplicate root).
- `chordPitchClasses C Dom7` returns `[C, E, G, As]` (no duplicates).
- `nearestPitch C 60` returns `Pitch C 4` (MIDI 60 is C4).
- `nearestPitch C 61` returns `Pitch C 4` (closer to 60 than 72).
- `smoothVoice` with identical chord (no movement needed — cost 0).
- `smoothVoice` with chromatic bass walk (e.g., Bb7 → Eb: bass moves Bb→Eb by minimal path).
- `smoothVoice` with common tones (shared pitch classes stay in place).
- `smoothVoice` `SmoothBass` vs `SmoothEqual` produces different results on an asymmetric case.
- `voiceChordSequence Nothing` matches current independent voicing.
- `voiceChordSequence (Just mode)` with explicit inversion mid-sequence respects the override.
- `voiceChordSequence` with empty list returns `[]`.
- `voiceChordSequence` with single chord returns same as independent voicing.

### Parser Tests

- Chord without inversion prefix → `csInversion = Nothing`.
- Chord with `0` prefix → `csInversion = Just 0`.
- Chord with `2` prefix → `csInversion = Just 2`.
- Chord with `-1` prefix → `csInversion = Just (-1)`.

### Integration Tests

- Full chord sequence through `voiceChordSequence` produces valid 4-note chords.
- Total half-step movement in smooth mode ≤ independent voicing for typical barbershop progressions.
- The progression `D A7 A9 D D7 Ab7 G6 Gm6 D F#7` produces smooth voice movement with `--smooth`.
