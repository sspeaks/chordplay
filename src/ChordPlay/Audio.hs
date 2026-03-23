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

-- Harmonic amplitudes approximating a male singing voice ("ah" vowel)
-- Strong 2nd/3rd harmonics for warmth, gradual rolloff for presence
harmonics :: [(Int, Double)]
harmonics = [(1, 1.0), (2, 0.8), (3, 0.6), (4, 0.3), (5, 0.2), (6, 0.1), (7, 0.08), (8, 0.05)]

-- Just intonation ratios for each semitone interval from the root.
-- These are the pure frequency ratios that produce "ringing" barbershop chords.
justRatio :: Int -> Double
justRatio 0  = 1/1       -- unison
justRatio 1  = 16/15     -- minor 2nd
justRatio 2  = 9/8       -- major 2nd
justRatio 3  = 6/5       -- minor 3rd
justRatio 4  = 5/4       -- major 3rd
justRatio 5  = 4/3       -- perfect 4th
justRatio 6  = 7/5       -- tritone (septimal)
justRatio 7  = 3/2       -- perfect 5th
justRatio 8  = 8/5       -- minor 6th
justRatio 9  = 5/3       -- major 6th
justRatio 10 = 7/4       -- minor 7th (septimal — the barbershop 7th)
justRatio 11 = 15/8      -- major 7th
justRatio n  = 2.0 * justRatio (n - 12)  -- extend to higher octaves

-- Compute just-intoned frequencies for a chord.
-- Root frequency from equal temperament, other notes tuned relative to root.
justFrequencies :: [Pitch] -> [Double]
justFrequencies [] = []
justFrequencies (root:rest) =
  let rootFreq = pitchFrequency root
      rootMidi = pitchToMidi root
  in rootFreq : map (\p -> rootFreq * justRatio (pitchToMidi p - rootMidi)) rest

-- Generate raw sample values for a set of pitches
generateSamples :: [Pitch] -> Double -> Bool -> [Double]
generateSamples [] _ _ = []
generateSamples pitches duration isArp =
  let totalSamples = round (fromIntegral sampleRate * duration) :: Int
      freqs = justFrequencies pitches
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
