module ChordPlay.Audio
  ( generateSamples
  , renderChord
  , renderSilence
  , sampleRate
  ) where

import Data.Int (Int16)
import qualified Data.ByteString.Lazy as BL
import qualified Data.ByteString.Builder as B
import ChordPlay.MusicTheory

sampleRate :: Int
sampleRate = 44100

-- ADSR envelope parameters (in seconds)
attackTime, decayTime, releaseTime :: Double
attackTime  = 0.020
decayTime   = 0.100
releaseTime = 0.200

sustainLevel :: Double
sustainLevel = 0.70

-- Harmonic amplitudes for warm organ-like tone
harmonics :: [(Int, Double)]
harmonics = [(1, 1.0), (2, 0.5), (3, 0.25), (4, 0.125)]

-- Generate raw sample values for a set of pitches
generateSamples :: [Pitch] -> Double -> Bool -> [Double]
generateSamples [] _ _ = []
generateSamples pitches duration isArp =
  let totalSamples = round (fromIntegral sampleRate * duration) :: Int
      freqs = map pitchFrequency pitches
      offsets = if isArp
        then [fromIntegral (i * arpStaggerSamples) | i <- [0 .. length pitches - 1]]
        else replicate (length pitches) 0.0
      arpStaggerSamples = round (0.080 * fromIntegral sampleRate :: Double) :: Int
  in [ mixAtSample freqs offsets duration t | t <- [0 .. totalSamples - 1] ]

mixAtSample :: [Double] -> [Double] -> Double -> Int -> Double
mixAtSample freqs offsets duration sampleIdx =
  let noteValues = zipWith (noteAtTime duration sampleIdx) freqs offsets
      mixed = sum noteValues
      n = fromIntegral (length freqs)
  in mixed / n

noteAtTime :: Double -> Int -> Double -> Double -> Double
noteAtTime duration sampleIdx freq offset =
  let adjustedIdx = fromIntegral sampleIdx - offset
  in if adjustedIdx < 0
     then 0.0
     else
       let t = adjustedIdx / fromIntegral sampleRate
           env = envelope duration t
           wave = waveform freq t
       in env * wave

envelope :: Double -> Double -> Double
envelope duration t
  | t < attackTime = t / attackTime
  | t < attackTime + decayTime =
      let decayProgress = (t - attackTime) / decayTime
      in 1.0 - (1.0 - sustainLevel) * decayProgress
  | t < duration - releaseTime = sustainLevel
  | t < duration =
      let releaseProgress = (t - (duration - releaseTime)) / releaseTime
      in sustainLevel * (1.0 - releaseProgress)
  | otherwise = 0.0

waveform :: Double -> Double -> Double
waveform freq t =
  sum [ amp * sin (2 * pi * fromIntegral h * freq * t) | (h, amp) <- harmonics ]

-- Render a chord to 16-bit signed LE PCM ByteString
renderChord :: [Pitch] -> Double -> Bool -> BL.ByteString
renderChord [] _ _ = BL.empty
renderChord _ duration _ | duration <= 0 = BL.empty
renderChord pitches duration isArp =
  let samples = generateSamples pitches duration isArp
      peak = if null samples then 0 else maximum (map abs samples)
      scale = if peak > 0 then 32000.0 / peak else 1.0
      clampedSamples = map (\s -> fromIntegral (round (s * scale) :: Int) :: Int16) samples
  in B.toLazyByteString $ foldMap B.int16LE clampedSamples

-- Render silence as zero samples
renderSilence :: Double -> BL.ByteString
renderSilence seconds =
  let n = round (fromIntegral sampleRate * seconds) :: Int
  in B.toLazyByteString $ mconcat $ replicate n (B.int16LE 0)
