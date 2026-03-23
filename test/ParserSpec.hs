module ParserSpec (spec) where

import Test.Hspec
import ChordPlay.Parser
import ChordPlay.MusicTheory

spec :: Spec
spec = describe "Parser" $ do
  describe "parseChord" $ do
    it "parses simple major chord 'C'" $
      parseChord "C" `shouldBe` Right (ChordSymbol C Major 0)
    it "parses 'Cmaj' as major" $
      parseChord "Cmaj" `shouldBe` Right (ChordSymbol C Major 0)
    it "parses 'Am' as A minor" $
      parseChord "Am" `shouldBe` Right (ChordSymbol A Minor 0)
    it "parses 'Bb7' as Bb dominant 7th" $
      parseChord "Bb7" `shouldBe` Right (ChordSymbol As Dom7 0)
    it "parses 'F#m7' as F# minor 7th" $
      parseChord "F#m7" `shouldBe` Right (ChordSymbol Fs Min7 0)
    it "parses 'Ebmaj7' as Eb major 7th" $
      parseChord "Ebmaj7" `shouldBe` Right (ChordSymbol Ds Maj7 0)
    it "parses 'Gdim7' as G diminished 7th" $
      parseChord "Gdim7" `shouldBe` Right (ChordSymbol G Dim7 0)
    it "parses 'C+' as C augmented" $
      parseChord "C+" `shouldBe` Right (ChordSymbol C Aug 0)
    it "parses 'Caug' as C augmented" $
      parseChord "Caug" `shouldBe` Right (ChordSymbol C Aug 0)
    it "parses 'Cm7b5' as half-diminished" $
      parseChord "Cm7b5" `shouldBe` Right (ChordSymbol C HalfDim7 0)
    it "parses 'Csus4'" $
      parseChord "Csus4" `shouldBe` Right (ChordSymbol C Sus4 0)
    it "parses 'CmMaj7' as minor-major 7th" $
      parseChord "CmMaj7" `shouldBe` Right (ChordSymbol C MinMaj7 0)
    it "parses 'C6' as major 6th" $
      parseChord "C6" `shouldBe` Right (ChordSymbol C Maj6 0)
    it "parses 'Cm6' as minor 6th" $
      parseChord "Cm6" `shouldBe` Right (ChordSymbol C Min6 0)

  describe "inversions" $ do
    it "parses '1G7' as 1st inversion G7" $
      parseChord "1G7" `shouldBe` Right (ChordSymbol G Dom7 1)
    it "parses '2Eb' as 2nd inversion Eb major" $
      parseChord "2Eb" `shouldBe` Right (ChordSymbol Ds Major 2)
    it "parses '-1G7' as negative 1st inversion" $
      parseChord "-1G7" `shouldBe` Right (ChordSymbol G Dom7 (-1))
    it "parses '0C' as root position" $
      parseChord "0C" `shouldBe` Right (ChordSymbol C Major 0)

  describe "parseChords (space-separated)" $ do
    it "parses 'Bb7 2Eb Fm7'" $
      parseChords "Bb7 2Eb Fm7" `shouldBe`
        Right [ ChordSymbol As Dom7 0
              , ChordSymbol Ds Major 2
              , ChordSymbol F Min7 0
              ]

  describe "error cases" $ do
    it "rejects invalid root 'X'" $
      parseChord "X" `shouldSatisfy` isLeft
    it "rejects empty string" $
      parseChord "" `shouldSatisfy` isLeft

isLeft :: Either a b -> Bool
isLeft (Left _) = True
isLeft _ = False
