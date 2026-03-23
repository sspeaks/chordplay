# Smooth Voice Leading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--smooth` and `--smooth-bass` flags that minimize half-step movement between consecutive chords via greedy pairwise voice leading optimization.

**Architecture:** For each chord transition, enumerate all 24 permutations of pitch-class-to-voice assignment, pick the nearest octave per voice, and select the permutation with minimum weighted total half-step cost. The algorithm is encapsulated in `smoothVoice` (core) and `voiceChordSequence` (sequence wrapper) in `MusicTheory.hs`. CLI flags and REPL commands thread a `Maybe SmoothMode` through the existing infrastructure.

**Tech Stack:** Haskell (GHC2021), Parsec, HSpec. Build/test: `nix develop -c cabal test`. No new dependencies — everything is in `base`.

**Spec:** `docs/superpowers/specs/2026-03-23-smooth-voice-leading-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/ChordPlay/MusicTheory.hs` | Modify | `csInversion` → `Maybe Int`; add `SmoothMode`, `chordPitchClasses`, `nearestPitch`, `smoothVoice`, `voiceChordSequence` |
| `src/ChordPlay/Parser.hs` | Modify | `inversionP` returns `Maybe Int` |
| `src/ChordPlay/Repl.hs` | Modify | Add smooth state + REPL commands; `playLine` uses `voiceChordSequence`; update `repl`/`runBatch`/`runEditMode` signatures |
| `app/Main.hs` | Modify | Refactor to flag-partition parsing; pass `Maybe SmoothMode` |
| `test/MusicTheorySpec.hs` | Modify | Tests for `chordPitchClasses`, `nearestPitch`, `smoothVoice`, `voiceChordSequence` |
| `test/ParserSpec.hs` | Modify | Update all `ChordSymbol` expectations for `Maybe Int` |

---

### Task 1: Migrate `csInversion` from `Int` to `Maybe Int`

This is a pure refactor. All existing tests must pass with updated expectations.

**Files:**
- Modify: `src/ChordPlay/MusicTheory.hs:31-35`
- Modify: `src/ChordPlay/Parser.hs:24-34`
- Modify: `src/ChordPlay/Repl.hs:83-84,117-122`
- Modify: `test/ParserSpec.hs` (all `ChordSymbol` expectations)

- [ ] **Step 1: Update the `ChordSymbol` data type**

In `src/ChordPlay/MusicTheory.hs`, change the record field:

```haskell
data ChordSymbol = ChordSymbol
  { csRoot      :: PitchClass
  , csQuality   :: ChordType
  , csInversion :: Maybe Int
  } deriving (Eq, Show)
```

- [ ] **Step 2: Update `inversionP` in Parser.hs**

Change the parser from `option 0` (returns `Int`) to `optionMaybe` (returns `Maybe Int`):

```haskell
inversionP :: Parser (Maybe Int)
inversionP = optionMaybe $ do
  sign <- option 1 (char '-' >> pure (-1))
  d <- digit
  pure (sign * (read [d] :: Int))
```

No change to `chordP` — `inv` is now `Maybe Int` and flows into `ChordSymbol` naturally.

- [ ] **Step 3: Update `chordToNotes` in Repl.hs**

Add `import Data.Maybe (fromMaybe)` to the import block, then update:

```haskell
chordToNotes :: ChordSymbol -> [Pitch]
chordToNotes (ChordSymbol root qual inv) = voiceChord root qual (fromMaybe 0 inv)
```

- [ ] **Step 4: Update `showChordSymbol` in Repl.hs**

```haskell
showChordSymbol :: ChordSymbol -> String
showChordSymbol (ChordSymbol root qual inv) =
  let invStr = maybe "" show inv
      rootStr = showPitchClass root
      qualStr = showQuality qual
  in invStr ++ rootStr ++ qualStr
```

- [ ] **Step 5: Update all ParserSpec.hs expectations**

Every `ChordSymbol` constructed with a bare `0` (no inversion in input) becomes `Nothing`. Every explicit inversion becomes `Just n`:

```haskell
-- parseChord tests: all "no inversion prefix" cases
parseChord "C" `shouldBe` Right (ChordSymbol C Major Nothing)
parseChord "Cmaj" `shouldBe` Right (ChordSymbol C Major Nothing)
parseChord "Am" `shouldBe` Right (ChordSymbol A Minor Nothing)
parseChord "Bb7" `shouldBe` Right (ChordSymbol As Dom7 Nothing)
parseChord "F#m7" `shouldBe` Right (ChordSymbol Fs Min7 Nothing)
parseChord "Ebmaj7" `shouldBe` Right (ChordSymbol Ds Maj7 Nothing)
parseChord "Gdim7" `shouldBe` Right (ChordSymbol G Dim7 Nothing)
parseChord "C+" `shouldBe` Right (ChordSymbol C Aug Nothing)
parseChord "Caug" `shouldBe` Right (ChordSymbol C Aug Nothing)
parseChord "Cm7b5" `shouldBe` Right (ChordSymbol C HalfDim7 Nothing)
parseChord "Csus4" `shouldBe` Right (ChordSymbol C Sus4 Nothing)
parseChord "CmMaj7" `shouldBe` Right (ChordSymbol C MinMaj7 Nothing)
parseChord "C6" `shouldBe` Right (ChordSymbol C Maj6 Nothing)
parseChord "Cm6" `shouldBe` Right (ChordSymbol C Min6 Nothing)

-- inversion tests: explicit inversions
parseChord "1G7" `shouldBe` Right (ChordSymbol G Dom7 (Just 1))
parseChord "2Eb" `shouldBe` Right (ChordSymbol Ds Major (Just 2))
parseChord "-1G7" `shouldBe` Right (ChordSymbol G Dom7 (Just (-1)))
parseChord "0C" `shouldBe` Right (ChordSymbol C Major (Just 0))

-- parseChords test
parseChords "Bb7 2Eb Fm7" `shouldBe`
  Right [ ChordSymbol As Dom7 Nothing
        , ChordSymbol Ds Major (Just 2)
        , ChordSymbol F Min7 Nothing
        ]
```

- [ ] **Step 6: Run tests to verify all pass**

Run: `nix develop -c cabal test 2>&1 | tail -20`

Expected: `41 examples, 0 failures`

- [ ] **Step 7: Commit**

```bash
git add src/ChordPlay/MusicTheory.hs src/ChordPlay/Parser.hs src/ChordPlay/Repl.hs test/ParserSpec.hs
git commit -m "refactor: migrate csInversion from Int to Maybe Int

Distinguishes 'no inversion specified' (Nothing) from 'explicit root
position' (Just 0). Prerequisite for smooth voice leading."
```

---

### Task 2: Add `chordPitchClasses` helper + tests

**Files:**
- Modify: `src/ChordPlay/MusicTheory.hs` (function + export)
- Modify: `test/MusicTheorySpec.hs`

- [ ] **Step 1: Write the failing tests**

Add to `test/MusicTheorySpec.hs`, inside the top-level `describe "MusicTheory"`:

```haskell
  describe "chordPitchClasses" $ do
    it "C Major has [C, E, G, C] (root doubled)" $
      chordPitchClasses C Major `shouldBe` [C, E, G, C]
    it "C Dom7 has [C, E, G, As] (no duplicates)" $
      chordPitchClasses C Dom7 `shouldBe` [C, E, G, As]
    it "A Minor has [A, C, E, A] (root doubled)" $
      chordPitchClasses A Minor `shouldBe` [A, C, E, A]
    it "Bb Dom7 has [As, D, F, Gs]" $
      chordPitchClasses As Dom7 `shouldBe` [As, D, F, Gs]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `nix develop -c cabal test 2>&1 | tail -5`

Expected: compilation error — `chordPitchClasses` not in scope.

- [ ] **Step 3: Implement `chordPitchClasses`**

Add to `src/ChordPlay/MusicTheory.hs` after the `chordIntervals` function:

```haskell
chordPitchClasses :: PitchClass -> ChordType -> [PitchClass]
chordPitchClasses root ct =
  map (\i -> pitchClassFromInt (fromEnum root + i)) (chordIntervals ct)
```

Add `chordPitchClasses` to the module export list.

- [ ] **Step 4: Run tests to verify they pass**

Run: `nix develop -c cabal test 2>&1 | tail -5`

Expected: all tests pass, including 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/ChordPlay/MusicTheory.hs test/MusicTheorySpec.hs
git commit -m "feat: add chordPitchClasses helper

Extracts the 4 pitch classes from a chord symbol. May contain
duplicates (e.g., Major [0,4,7,12] → [C,E,G,C])."
```

---

### Task 3: Add `nearestPitch` helper + tests

**Files:**
- Modify: `src/ChordPlay/MusicTheory.hs` (function + export)
- Modify: `test/MusicTheorySpec.hs`

- [ ] **Step 1: Write the failing tests**

Add to `test/MusicTheorySpec.hs`:

```haskell
  describe "nearestPitch" $ do
    it "C nearest to MIDI 60 (C4) returns C4" $
      nearestPitch C 60 `shouldBe` Pitch C 4
    it "C nearest to MIDI 61 (Cs4) returns C4 (closer than C5=72)" $
      nearestPitch C 61 `shouldBe` Pitch C 4
    it "C nearest to MIDI 59 returns C4 (closer than C3=48)" $
      nearestPitch C 59 `shouldBe` Pitch C 4
    it "A nearest to MIDI 48 returns A2 (45, dist 3, vs A3=57)" $
      nearestPitch A 48 `shouldBe` Pitch A 2
    it "equidistant tie breaks to lower octave" $
      -- Fs nearest to MIDI 60: Fs3=54 (dist 6), Fs4=66 (dist 6) → Fs3
      nearestPitch Fs 60 `shouldBe` Pitch Fs 3
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `nix develop -c cabal test 2>&1 | tail -5`

Expected: compilation error — `nearestPitch` not in scope.

- [ ] **Step 3: Implement `nearestPitch`**

Add to `src/ChordPlay/MusicTheory.hs`:

```haskell
nearestPitch :: PitchClass -> Int -> Pitch
nearestPitch pc targetMidi =
  let pcInt = fromEnum pc
      octFloat = (fromIntegral targetMidi - fromIntegral pcInt) / 12.0 - 1.0 :: Double
      octLow = floor octFloat :: Int
      octHigh = ceiling octFloat :: Int
      midiLow = (octLow + 1) * 12 + pcInt
      midiHigh = (octHigh + 1) * 12 + pcInt
  in if abs (midiLow - targetMidi) <= abs (midiHigh - targetMidi)
     then Pitch pc octLow
     else Pitch pc octHigh
```

The `<=` provides tie-breaking to the lower octave.

Add `nearestPitch` to the module export list.

- [ ] **Step 4: Run tests to verify they pass**

Run: `nix develop -c cabal test 2>&1 | tail -5`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ChordPlay/MusicTheory.hs test/MusicTheorySpec.hs
git commit -m "feat: add nearestPitch helper

Given a pitch class and target MIDI number, returns the Pitch in the
closest octave. Ties break to the lower octave."
```

---

### Task 4: Add `SmoothMode` + `smoothVoice` core algorithm + tests

**Files:**
- Modify: `src/ChordPlay/MusicTheory.hs` (type + function + exports + imports)
- Modify: `test/MusicTheorySpec.hs`

- [ ] **Step 1: Write the failing tests**

Add to `test/MusicTheorySpec.hs`:

```haskell
  describe "smoothVoice" $ do
    it "identical chord produces no movement" $
      -- C Major → C Major: prev = [C3, E3, G3, C4], next PCs = [C, E, G, C]
      let prev = [Pitch C 3, Pitch E 3, Pitch G 3, Pitch C 4]
          nextPCs = chordPitchClasses C Major
          result = smoothVoice SmoothEqual prev nextPCs
      in map pitchToMidi result `shouldBe` [48, 52, 55, 60]

    it "chromatic walk moves each voice 1 half-step" $
      -- C Major → Db Major: each voice moves up 1
      let prev = [Pitch C 3, Pitch E 3, Pitch G 3, Pitch C 4]
          nextPCs = chordPitchClasses Cs Major
          result = smoothVoice SmoothEqual prev nextPCs
      in map pitchToMidi result `shouldBe` [49, 53, 56, 61]

    it "keeps common tones in place (C → Am)" $
      -- C Major [C3,E3,G3,C4] → Am [A,C,E,A]
      -- Best: [C3,E3,A3,A3] (C and E stay, cost 5)
      let prev = [Pitch C 3, Pitch E 3, Pitch G 3, Pitch C 4]
          nextPCs = chordPitchClasses A Minor
          result = smoothVoice SmoothEqual prev nextPCs
          resultMidis = map pitchToMidi result
          totalMovement = sum $ zipWith (\a b -> abs (a - b)) [48,52,55,60] resultMidis
      in totalMovement `shouldSatisfy` (<= 8)

    it "produces exactly 4 notes" $
      let prev = [Pitch C 3, Pitch E 3, Pitch G 3, Pitch C 4]
          nextPCs = chordPitchClasses G Dom7
          result = smoothVoice SmoothEqual prev nextPCs
      in length result `shouldBe` 4

    it "SmoothBass does not crash" $
      let prev = [Pitch C 3, Pitch E 3, Pitch G 3, Pitch C 4]
          nextPCs = chordPitchClasses A Minor
          result = smoothVoice SmoothBass prev nextPCs
      in length result `shouldBe` 4
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `nix develop -c cabal test 2>&1 | tail -5`

Expected: compilation error — `SmoothMode`/`smoothVoice` not in scope.

- [ ] **Step 3: Add `SmoothMode` type**

Add to `src/ChordPlay/MusicTheory.hs`, after the `ChordSymbol` definition:

```haskell
data SmoothMode = SmoothEqual | SmoothBass
  deriving (Eq, Show)
```

Add `SmoothMode(..)` to the module export list.

- [ ] **Step 4: Implement `smoothVoice`**

Add `import Data.List (permutations, sortOn)` at the top of `MusicTheory.hs`, then add the function:

```haskell
smoothVoice :: SmoothMode -> [Pitch] -> [PitchClass] -> [Pitch]
smoothVoice mode prevPitches nextPCs =
  let sorted = sortOn pitchToMidi prevPitches
      prevMidis = map pitchToMidi sorted
      weights = case mode of
        SmoothEqual -> [1, 1, 1, 1]
        SmoothBass  -> [2, 1, 1, 1]
      perms = permutations nextPCs
      score perm =
        let placed = zipWith nearestPitch perm prevMidis
            placedMidis = map pitchToMidi placed
            movements = zipWith (\p n -> abs (p - n)) prevMidis placedMidis
            totalCost = sum $ zipWith (*) weights movements
            maxMove = maximum movements
        in (totalCost, maxMove, placed)
      results = map score perms
      (_, _, best) = head $ sortOn (\(c, m, _) -> (c, m)) results
  in best
```

Add `smoothVoice` to the module export list.

- [ ] **Step 5: Run tests to verify they pass**

Run: `nix develop -c cabal test 2>&1 | tail -10`

Expected: all tests pass. If the "common tones" test fails, inspect the actual result — the algorithm should find a permutation with total movement ≤ 8.

- [ ] **Step 6: Commit**

```bash
git add src/ChordPlay/MusicTheory.hs test/MusicTheorySpec.hs
git commit -m "feat: add SmoothMode type and smoothVoice algorithm

Greedy pairwise voice leading: enumerates all 24 permutations of
pitch-class-to-voice assignment, finds nearest octave per voice,
picks the assignment with minimum weighted half-step cost."
```

---

### Task 5: Add `voiceChordSequence` + tests

**Files:**
- Modify: `src/ChordPlay/MusicTheory.hs` (function + export + import)
- Modify: `test/MusicTheorySpec.hs`

- [ ] **Step 1: Write the failing tests**

Add `import Data.Maybe (fromMaybe)` to MusicTheorySpec.hs if not already present. Add to `test/MusicTheorySpec.hs`:

```haskell
  describe "voiceChordSequence" $ do
    it "empty list returns empty list" $
      voiceChordSequence Nothing [] `shouldBe` []

    it "Nothing mode matches independent voicing" $
      let chords = [ ChordSymbol C Major Nothing
                   , ChordSymbol A Minor Nothing
                   , ChordSymbol F Major Nothing
                   ]
          independent = map (\(ChordSymbol r q i) -> voiceChord r q (fromMaybe 0 i)) chords
      in voiceChordSequence Nothing chords `shouldBe` independent

    it "single chord same as independent voicing" $
      let chord = ChordSymbol C Major Nothing
      in voiceChordSequence (Just SmoothEqual) [chord]
           `shouldBe` [voiceChord C Major 0]

    it "explicit inversion mid-sequence is respected" $
      let chords = [ ChordSymbol C Major Nothing      -- root position
                   , ChordSymbol A Minor (Just 2)     -- forced 2nd inversion
                   , ChordSymbol F Major Nothing       -- smooth from prev
                   ]
          result = voiceChordSequence (Just SmoothEqual) chords
      in do
        length result `shouldBe` 3
        -- Second chord must match voiceChord A Minor 2 exactly
        (result !! 1) `shouldBe` voiceChord A Minor 2

    it "smooth mode produces less total movement than independent" $
      let chords = [ ChordSymbol C Major Nothing
                   , ChordSymbol Cs Major Nothing  -- chromatic walk
                   ]
          smoothResult = voiceChordSequence (Just SmoothEqual) chords
          indepResult = voiceChordSequence Nothing chords
          movement voicings = sum
            [ abs (pitchToMidi a - pitchToMidi b)
            | (v1, v2) <- zip voicings (tail voicings)
            , (a, b) <- zip v1 v2
            ]
      in movement smoothResult `shouldSatisfy` (<= movement indepResult)

    it "all chords have explicit inversions — smooth has no effect" $
      let chords = [ ChordSymbol C Major (Just 0)
                   , ChordSymbol G Dom7 (Just 1)
                   ]
      in voiceChordSequence (Just SmoothEqual) chords
           `shouldBe` voiceChordSequence Nothing chords
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `nix develop -c cabal test 2>&1 | tail -5`

Expected: compilation error — `voiceChordSequence` not in scope.

- [ ] **Step 3: Implement `voiceChordSequence`**

Add `import Data.Maybe (fromMaybe)` to `MusicTheory.hs` imports, then add:

```haskell
voiceChordSequence :: Maybe SmoothMode -> [ChordSymbol] -> [[Pitch]]
voiceChordSequence _ [] = []
voiceChordSequence Nothing chords =
  map (\(ChordSymbol r q i) -> voiceChord r q (fromMaybe 0 i)) chords
voiceChordSequence (Just mode) (c:cs) =
  let firstVoicing = voiceChord (csRoot c) (csQuality c) (fromMaybe 0 (csInversion c))
  in firstVoicing : go firstVoicing cs
  where
    go _ [] = []
    go prev (chord:rest) =
      let voicing = case csInversion chord of
            Just n  -> voiceChord (csRoot chord) (csQuality chord) n
            Nothing -> smoothVoice mode prev
                         (chordPitchClasses (csRoot chord) (csQuality chord))
      in voicing : go voicing rest
```

Add `voiceChordSequence` to the module export list.

- [ ] **Step 4: Run tests to verify they pass**

Run: `nix develop -c cabal test 2>&1 | tail -10`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ChordPlay/MusicTheory.hs test/MusicTheorySpec.hs
git commit -m "feat: add voiceChordSequence

Applies smooth voice leading across a chord sequence. Nothing mode
gives independent voicing (backward compatible). Just mode applies
smoothVoice between consecutive chords, respecting explicit inversions."
```

---

### Task 6: Wire up Repl.hs (smooth state + commands + voiceChordSequence)

**Files:**
- Modify: `src/ChordPlay/Repl.hs`

- [ ] **Step 1: Add smooth mode to ReplState**

Update the `ReplState` definition and its initial construction:

```haskell
data ReplState = ReplState
  { rsArpeggio :: Bool
  , rsSmooth   :: Maybe SmoothMode
  , rsHistory  :: [ChordSymbol]
  }
```

- [ ] **Step 2: Update `repl` signature and initialization**

```haskell
repl :: Maybe SmoothMode -> IO ()
repl smooth = do
  hSetBuffering stdout LineBuffering
  putStrLn "ChordPlay — type chords to hear them, :help for commands"
  stateRef <- newIORef (ReplState False smooth [])
  replLoop stateRef
```

- [ ] **Step 3: Update `playLine` to use `voiceChordSequence`**

```haskell
playLine :: String -> IORef ReplState -> IO ()
playLine input stateRef = do
  case parseChords input of
    Left err -> putStrLn $ "Parse error: " ++ err
    Right chords -> do
      st <- readIORef stateRef
      let arp = rsArpeggio st
          noteGroups = voiceChordSequence (rsSmooth st) chords
      playChords noteGroups 1.0 arp
      modifyIORef stateRef (\s -> s { rsHistory = reverse chords ++ rsHistory s })
```

Remove the now-unused `chordToNotes` function.

- [ ] **Step 4: Update `runBatch` and `runEditMode` signatures**

```haskell
runBatch :: FilePath -> Bool -> Maybe SmoothMode -> IO ()
runBatch path isArp smooth = do
  exists <- doesFileExist path
  if not exists
    then putStrLn $ "File not found: " ++ path
    else do
      contents <- readFile path
      case parseChords contents of
        Left err -> putStrLn $ "Parse error: " ++ err
        Right chords -> do
          let noteGroups = voiceChordSequence smooth chords
          playChords noteGroups 1.0 isArp

runEditMode :: FilePath -> Bool -> Maybe SmoothMode -> IO ()
runEditMode path isArp smooth = do
  editor <- lookupEnv "EDITOR"
  case editor of
    Nothing -> putStrLn "EDITOR not set"
    Just ed -> do
      callProcess ed [path]
      runBatch path isArp smooth
```

- [ ] **Step 5: Add `:smooth`, `:smooth-bass`, `:nosmooth` command handlers**

In the `replLoop` case expression, add before the catch-all `_` branch:

```haskell
        ":smooth" -> do
          modifyIORef stateRef (\s -> s { rsSmooth = Just SmoothEqual })
          putStrLn "Smooth voice leading ON (equal weight)"
          replLoop stateRef
        ":smooth-bass" -> do
          modifyIORef stateRef (\s -> s { rsSmooth = Just SmoothBass })
          putStrLn "Smooth voice leading ON (bass weighted)"
          replLoop stateRef
        ":nosmooth" -> do
          modifyIORef stateRef (\s -> s { rsSmooth = Nothing })
          putStrLn "Smooth voice leading OFF"
          replLoop stateRef
```

- [ ] **Step 6: Update `printHelp` to include new commands**

Add after the `:block` line:

```haskell
  , "  :smooth        Enable smooth voice leading (equal weight)"
  , "  :smooth-bass   Enable smooth voice leading (bass weighted)"
  , "  :nosmooth      Disable smooth voice leading"
```

And in the chord syntax section, add:

```haskell
  , "  Note: without explicit inversion, :smooth mode auto-voices"
```

- [ ] **Step 7: Build to verify compilation**

Run: `nix develop -c cabal build 2>&1 | tail -5`

Expected: build succeeds (Main.hs will fail separately — that's Task 7).

Actually, Main.hs calls `repl`, `runBatch`, `runEditMode` with the old signatures, so it will fail here. We need to fix Main.hs in the same build. Move to Task 7 immediately.

- [ ] **Step 8: Do NOT commit yet** — Main.hs must be updated first (Task 7) for compilation to succeed.

---

### Task 7: Refactor Main.hs flag parsing

**Files:**
- Modify: `app/Main.hs`

- [ ] **Step 1: Rewrite Main.hs with flag-partition parsing**

Replace the entire contents of `app/Main.hs`:

```haskell
module Main where

import System.Environment (getArgs)
import Data.List (isPrefixOf, partition)
import ChordPlay.MusicTheory (SmoothMode(..))
import ChordPlay.Repl

main :: IO ()
main = do
  args <- getArgs
  let (flags, rest) = partition ("-" `isPrefixOf`) args
      arp        = "--arp" `elem` flags
      edit       = "--edit" `elem` flags
      smooth     = "--smooth" `elem` flags
      smoothBass = "--smooth-bass" `elem` flags
      known      = ["--arp", "--edit", "--smooth", "--smooth-bass"]
      bad        = filter (`notElem` known) flags
      sm | smooth && smoothBass = Nothing  -- conflict sentinel
         | smooth               = Just (Just SmoothEqual)
         | smoothBass           = Just (Just SmoothBass)
         | otherwise            = Just Nothing
  if not (null bad) then printUsage
  else case sm of
    Nothing -> do
      putStrLn "Error: --smooth and --smooth-bass are mutually exclusive"
      printUsage
    Just smoothMode -> case (edit, rest) of
      (False, [])     -> repl smoothMode
      (False, [path]) -> runBatch path arp smoothMode
      (True,  [path]) -> runEditMode path arp smoothMode
      _               -> printUsage

printUsage :: IO ()
printUsage = putStrLn "Usage: chordplay [--smooth|--smooth-bass] [--arp] [--edit] [file.txt]"
```

- [ ] **Step 2: Build and run tests**

Run: `nix develop -c cabal test 2>&1 | tail -20`

Expected: all tests pass, build succeeds.

- [ ] **Step 3: Commit Tasks 6 + 7 together**

```bash
git add src/ChordPlay/Repl.hs app/Main.hs
git commit -m "feat: wire up smooth voice leading in REPL and CLI

- Add :smooth, :smooth-bass, :nosmooth REPL commands
- Thread Maybe SmoothMode through repl, runBatch, runEditMode
- playLine uses voiceChordSequence instead of per-chord mapping
- Refactor Main.hs to flag-partition parsing
- --smooth and --smooth-bass are mutually exclusive"
```

---

### Task 8: Final integration test

**Files:**
- Modify: `test/MusicTheorySpec.hs`

- [ ] **Step 1: Add integration test with barbershop progression**

```haskell
    it "barbershop progression has smooth movement" $
      -- D A7 A9 D D7 Ab7 G6 Gm6 D F#7
      let chords = [ ChordSymbol D Major Nothing
                   , ChordSymbol A Dom7 Nothing
                   , ChordSymbol A Dom9 Nothing
                   , ChordSymbol D Major Nothing
                   , ChordSymbol D Dom7 Nothing
                   , ChordSymbol Gs Dom7 Nothing
                   , ChordSymbol G Maj6 Nothing
                   , ChordSymbol G Min6 Nothing
                   , ChordSymbol D Major Nothing
                   , ChordSymbol Fs Dom7 Nothing
                   ]
          smoothResult = voiceChordSequence (Just SmoothEqual) chords
          indepResult = voiceChordSequence Nothing chords
          totalMovement voicings = sum
            [ abs (pitchToMidi a - pitchToMidi b)
            | (v1, v2) <- zip voicings (tail voicings)
            , (a, b) <- zip v1 v2
            ]
      in do
        length smoothResult `shouldBe` 10
        all (\v -> length v == 4) smoothResult `shouldBe` True
        totalMovement smoothResult `shouldSatisfy` (< totalMovement indepResult)
```

- [ ] **Step 2: Run tests**

Run: `nix develop -c cabal test 2>&1 | tail -10`

Expected: all tests pass. The smooth voicing should have strictly less total movement than independent voicing for this progression.

- [ ] **Step 3: Commit**

```bash
git add test/MusicTheorySpec.hs
git commit -m "test: add barbershop progression integration test

Verifies smooth voice leading produces less total movement than
independent voicing for D A7 A9 D D7 Ab7 G6 Gm6 D F#7."
```

---

## Summary

| Task | Description | Files | Test count |
|------|-------------|-------|------------|
| 1 | Migrate `csInversion` to `Maybe Int` | MusicTheory, Parser, Repl, ParserSpec | 41 (updated) |
| 2 | `chordPitchClasses` helper | MusicTheory, MusicTheorySpec | +4 |
| 3 | `nearestPitch` helper | MusicTheory, MusicTheorySpec | +5 |
| 4 | `SmoothMode` + `smoothVoice` | MusicTheory, MusicTheorySpec | +5 |
| 5 | `voiceChordSequence` | MusicTheory, MusicTheorySpec | +6 |
| 6-7 | Repl + Main integration | Repl, Main | (build only) |
| 8 | Integration test | MusicTheorySpec | +1 |

**Total: ~62 tests after completion.**
