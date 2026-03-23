module AudioSpec (spec) where

import Test.Hspec
import ChordPlay.Audio
import ChordPlay.MusicTheory
import qualified Data.ByteString.Lazy as BL

spec :: Spec
spec = describe "Audio" $ do
  describe "generateSamples" $ do
    it "produces correct number of samples for 1.5s at 44100 Hz" $
      let samples = generateSamples [Pitch A 4] 1.5 False
      in length samples `shouldBe` 66150  -- 44100 * 1.5

  describe "renderChord" $ do
    it "produces non-empty PCM ByteString" $
      let pcm = renderChord [Pitch C 3, Pitch E 3, Pitch G 3, Pitch C 4] 1.5 False
      in BL.length pcm `shouldSatisfy` (> 0)
    it "PCM length matches 16-bit mono at 44100 Hz for 1.5s" $
      let pcm = renderChord [Pitch A 4] 1.5 False
          expectedBytes = 44100 * 1.5 * 2  -- 2 bytes per 16-bit sample
      in BL.length pcm `shouldBe` round expectedBytes

  describe "arpeggio mode" $ do
    it "produces same length as block mode" $
      let notes = [Pitch C 3, Pitch E 3, Pitch G 3, Pitch C 4]
          block = renderChord notes 1.5 False
          arp   = renderChord notes 1.5 True
      in BL.length arp `shouldBe` BL.length block

  describe "silence" $ do
    it "produces correct length for 300ms" $
      let sil = renderSilence 0.3
          expectedBytes = round (44100 * 0.3 * 2 :: Double)
      in BL.length sil `shouldBe` expectedBytes
