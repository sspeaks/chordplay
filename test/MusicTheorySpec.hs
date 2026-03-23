module MusicTheorySpec (spec) where

import Test.Hspec
import ChordPlay.MusicTheory

spec :: Spec
spec = describe "MusicTheory" $ do
  describe "pitchToMidi" $ do
    it "A4 is MIDI 69" $
      pitchToMidi (Pitch A 4) `shouldBe` 69
    it "C3 is MIDI 48" $
      pitchToMidi (Pitch C 3) `shouldBe` 48
    it "C4 (middle C) is MIDI 60" $
      pitchToMidi (Pitch C 4) `shouldBe` 60

  describe "pitchFrequency" $ do
    it "A4 is 440 Hz" $
      pitchFrequency (Pitch A 4) `shouldBe` 440.0
    it "A5 is 880 Hz" $
      abs (pitchFrequency (Pitch A 5) - 880.0) `shouldSatisfy` (< 0.01)

  describe "chordIntervals" $ do
    it "Major triad + octave is [0,4,7,12]" $
      chordIntervals Major `shouldBe` [0, 4, 7, 12]
    it "Dominant 7th is [0,4,7,10]" $
      chordIntervals Dom7 `shouldBe` [0, 4, 7, 10]
    it "Minor 7th is [0,3,7,10]" $
      chordIntervals Min7 `shouldBe` [0, 3, 7, 10]
    it "Diminished 7th is [0,3,6,9]" $
      chordIntervals Dim7 `shouldBe` [0, 3, 6, 9]
    it "Half-diminished is [0,3,6,10]" $
      chordIntervals HalfDim7 `shouldBe` [0, 3, 6, 10]

  describe "voiceChord" $ do
    it "all chord types produce exactly 4 notes" $
      mapM_ (\ct -> length (voiceChord C ct 0) `shouldBe` 4) [minBound..maxBound]
    it "root position C major starts at C3" $
      head (voiceChord C Major 0) `shouldBe` Pitch C 3
    it "root position C7 has 4 distinct pitches" $
      let notes = voiceChord C Dom7 0
      in length notes `shouldBe` length (nub' notes)
    it "1st inversion rotates bottom note up" $
      let inv1 = voiceChord G Dom7 1    -- B3 D4 F4 G4
      in head inv1 `shouldBe` Pitch B 3
    it "inversion outside -3..3 returns error" $
      voiceChordSafe C Major 4 `shouldBe` Left "Inversion must be between -3 and 3"

  describe "chordPitchClasses" $ do
    it "C Major has [C, E, G, C] (root doubled)" $
      chordPitchClasses C Major `shouldBe` [C, E, G, C]
    it "C Dom7 has [C, E, G, As] (no duplicates)" $
      chordPitchClasses C Dom7 `shouldBe` [C, E, G, As]
    it "A Minor has [A, C, E, A] (root doubled)" $
      chordPitchClasses A Minor `shouldBe` [A, C, E, A]
    it "Bb Dom7 has [As, D, F, Gs]" $
      chordPitchClasses As Dom7 `shouldBe` [As, D, F, Gs]

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
