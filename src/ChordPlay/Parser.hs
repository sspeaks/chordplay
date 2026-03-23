module ChordPlay.Parser
  ( parseChord
  , parseChords
  ) where

import Text.Parsec
import Text.Parsec.String (Parser)
import ChordPlay.MusicTheory

parseChord :: String -> Either String ChordSymbol
parseChord input = case parse (chordP <* eof) "chord" input of
  Left err -> Left (show err)
  Right cs -> Right cs

parseChords :: String -> Either String [ChordSymbol]
parseChords input = case parse chordsP "chords" input of
  Left err -> Left (show err)
  Right cs -> Right cs

chordsP :: Parser [ChordSymbol]
chordsP = spaces *> sepEndBy1 chordP spaces <* eof

chordP :: Parser ChordSymbol
chordP = do
  inv <- inversionP
  root <- rootP
  qual <- qualityP
  pure (ChordSymbol root qual inv)

inversionP :: Parser (Maybe Int)
inversionP = optionMaybe $ do
  sign <- option 1 (char '-' >> pure (-1))
  d <- digit
  pure (sign * (read [d] :: Int))

rootP :: Parser PitchClass
rootP = do
  letter <- oneOf "ABCDEFG"
  accidental <- optionMaybe (oneOf "#b")
  case (letter, accidental) of
    ('C', Nothing)  -> pure C
    ('C', Just '#') -> pure Cs
    ('D', Just 'b') -> pure Cs
    ('D', Nothing)  -> pure D
    ('D', Just '#') -> pure Ds
    ('E', Just 'b') -> pure Ds
    ('E', Nothing)  -> pure E
    ('F', Nothing)  -> pure F
    ('F', Just '#') -> pure Fs
    ('G', Just 'b') -> pure Fs
    ('G', Nothing)  -> pure G
    ('G', Just '#') -> pure Gs
    ('A', Just 'b') -> pure Gs
    ('A', Nothing)  -> pure A
    ('A', Just '#') -> pure As
    ('B', Just 'b') -> pure As
    ('B', Nothing)  -> pure B
    _ -> fail $ "Invalid note: " ++ [letter] ++ maybe "" (:[]) accidental

qualityP :: Parser ChordType
qualityP = choice
  [ try (string "mMaj7") >> pure MinMaj7
  , try (string "maj7")  >> pure Maj7
  , try (string "maj")   >> pure Major
  , try (string "dim7b5") >> pure HalfDim7
  , try (string "dim7")  >> pure Dim7
  , try (string "dim")   >> pure Dim
  , try (string "m7b5")  >> pure HalfDim7
  , try (string "m7")    >> pure Min7
  , try (string "m6")    >> pure Min6
  , try (string "min")   >> pure Minor
  , try (string "m")     >> pure Minor
  , try (string "aug")   >> pure Aug
  , try (string "+")     >> pure Aug
  , try (string "sus4")  >> pure Sus4
  , try (string "sus2")  >> pure Sus2
  , try (string "9")     >> pure Dom9
  , try (string "7")     >> pure Dom7
  , try (string "6")     >> pure Maj6
  , pure Major
  ]
