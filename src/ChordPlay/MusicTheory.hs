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
  , nub'
  ) where

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

data ChordSymbol = ChordSymbol
  { csRoot      :: PitchClass
  , csQuality   :: ChordType
  , csInversion :: Int
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
chordIntervals Maj6    = [-12, -8, -3, 7]  -- root, 3, 6, 5 — root dropped octave, 5th separated from 6th
chordIntervals Min6    = [-12, -9, -3, 7]  -- root, m3, 6, 5 — same voicing
chordIntervals Dom9    = [-5, -2, 2, 4]   -- rootless 9th: 5, b7, 9, 3 (5th in bass)

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

nub' :: [Pitch] -> [Pitch]
nub' [] = []
nub' (x:xs) = x : nub' (filter (/= x) xs)
