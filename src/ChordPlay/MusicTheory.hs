module ChordPlay.MusicTheory
  ( PitchClass(..)
  , Pitch(..)
  , ChordType(..)
  , ChordSymbol(..)
  , pitchToMidi
  , pitchFrequency
  , chordIntervals
  , voiceChord
  , voiceChordSafe
  , pitchClassFromInt
  , chordPitchClasses
  , nearestPitch
  , nub'
  , SmoothMode(..)
  , smoothVoice
  , voiceChordSequence
  ) where

import Data.List (permutations, sortOn)
import Data.Maybe (fromMaybe)

data PitchClass = C | Cs | D | Ds | E | F | Fs | G | Gs | A | As | B
  deriving (Eq, Ord, Show, Enum, Bounded)

data Pitch = Pitch PitchClass Int
  deriving (Eq, Show)

instance Ord Pitch where
  compare a b = compare (pitchToMidi a) (pitchToMidi b)

data ChordType
  = Major | Minor | Dom7 | Maj7 | Min7
  | Dim | Dim7 | Aug | HalfDim7
  | Sus4 | Sus2 | MinMaj7 | Maj6 | Min6
  | Dom9
  deriving (Eq, Show, Enum, Bounded)

data SmoothMode = SmoothEqual | SmoothBass
  deriving (Eq, Show)

data ChordSymbol = ChordSymbol
  { csRoot      :: PitchClass
  , csQuality   :: ChordType
  , csInversion :: Maybe Int
  } deriving (Eq, Show)

pitchClassToInt :: PitchClass -> Int
pitchClassToInt = fromEnum

pitchClassFromInt :: Int -> PitchClass
pitchClassFromInt n = toEnum (n `mod` 12)

pitchToMidi :: Pitch -> Int
pitchToMidi (Pitch pc oct) = (oct + 1) * 12 + pitchClassToInt pc

pitchFrequency :: Pitch -> Double
pitchFrequency p =
  let midi = pitchToMidi p
  in 440.0 * (2.0 ** (fromIntegral (midi - 69) / 12.0))

chordIntervals :: ChordType -> [Int]
chordIntervals Major   = [0, 4, 7, 12]
chordIntervals Minor   = [0, 3, 7, 12]
chordIntervals Dom7    = [0, 4, 7, 10]
chordIntervals Maj7    = [0, 4, 7, 11]
chordIntervals Min7    = [0, 3, 7, 10]
chordIntervals Dim     = [0, 3, 6, 12]
chordIntervals Dim7    = [0, 3, 6, 9]
chordIntervals Aug     = [0, 4, 8, 12]
chordIntervals HalfDim7 = [0, 3, 6, 10]
chordIntervals Sus4    = [0, 5, 7, 12]
chordIntervals Sus2    = [0, 2, 7, 12]
chordIntervals MinMaj7 = [0, 3, 7, 11]
chordIntervals Maj6    = [0, 4, 7, 9]
chordIntervals Min6    = [0, 3, 7, 9]
chordIntervals Dom9    = [-5, 2, 4, 10]   -- rootless 9th: 5, 9, 3, b7 (5th in bass, bari-lead cross)

chordPitchClasses :: PitchClass -> ChordType -> [PitchClass]
chordPitchClasses root ct =
  map (\i -> pitchClassFromInt (fromEnum root + i)) (chordIntervals ct)

voiceChord :: PitchClass -> ChordType -> Int -> [Pitch]
voiceChord root ct inv =
  let baseMidi = pitchToMidi (Pitch root 3)
      intervals = chordIntervals ct
      basePitches = map (\i -> midiToPitch (baseMidi + i)) intervals
      clampedInv = max (-3) (min 3 inv)
  in applyInversion clampedInv basePitches

voiceChordSafe :: PitchClass -> ChordType -> Int -> Either String [Pitch]
voiceChordSafe root ct inv
  | inv < -3 || inv > 3 = Left "Inversion must be between -3 and 3"
  | otherwise = Right (voiceChord root ct inv)

midiToPitch :: Int -> Pitch
midiToPitch midi =
  let pc = pitchClassFromInt (midi `mod` 12)
      oct = midi `div` 12 - 1
  in Pitch pc oct

applyInversion :: Int -> [Pitch] -> [Pitch]
applyInversion 0 ps = ps
applyInversion n ps
  | n > 0 = applyInversion (n - 1) (rotateUp ps)
  | otherwise = applyInversion (n + 1) (rotateDown ps)

rotateUp :: [Pitch] -> [Pitch]
rotateUp [] = []
rotateUp (Pitch pc oct : rest) = rest ++ [Pitch pc (oct + 1)]

rotateDown :: [Pitch] -> [Pitch]
rotateDown [] = []
rotateDown ps =
  let (Pitch pc oct) = last ps
  in Pitch pc (oct - 1) : init ps

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

nub' :: [Pitch] -> [Pitch]
nub' [] = []
nub' (x:xs) = x : nub' (filter (/= x) xs)

-- Precondition: prevPitches and nextPCs are both 4-element lists.
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
