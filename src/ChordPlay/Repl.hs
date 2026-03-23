module ChordPlay.Repl
  ( repl
  , runBatch
  , runEditMode
  ) where

import System.IO
import System.Environment (lookupEnv)
import System.Process (callProcess)
import System.Directory (doesFileExist)
import Data.IORef
import ChordPlay.MusicTheory
import ChordPlay.Parser
import ChordPlay.Playback

data ReplState = ReplState
  { rsArpeggio :: Bool
  , rsHistory  :: [ChordSymbol]
  }

repl :: IO ()
repl = do
  hSetBuffering stdout LineBuffering
  putStrLn "ChordPlay — type chords to hear them, :help for commands"
  stateRef <- newIORef (ReplState False [])
  replLoop stateRef

replLoop :: IORef ReplState -> IO ()
replLoop stateRef = do
  putStr "♪ " >> hFlush stdout
  eof <- isEOF
  if eof
    then putStrLn "" >> pure ()
    else do
      line <- getLine
      case line of
        ""       -> replLoop stateRef
        ":quit"  -> pure ()
        ":q"     -> pure ()
        ":help"  -> printHelp >> replLoop stateRef
        ":arp"   -> do
          modifyIORef stateRef (\s -> s { rsArpeggio = True })
          putStrLn "Arpeggio mode ON"
          replLoop stateRef
        ":block" -> do
          modifyIORef stateRef (\s -> s { rsArpeggio = False })
          putStrLn "Block mode ON"
          replLoop stateRef
        ":list"  -> do
          st <- readIORef stateRef
          mapM_ (putStrLn . showChordSymbol) (reverse $ rsHistory st)
          replLoop stateRef
        ":clear" -> do
          modifyIORef stateRef (\s -> s { rsHistory = [] })
          putStrLn "Session cleared"
          replLoop stateRef
        _
          | take 6 line == ":load " -> do
              let path = drop 6 line
              loadAndPlay path stateRef
              replLoop stateRef
          | take 6 line == ":save " -> do
              let path = drop 6 line
              st <- readIORef stateRef
              writeFile path (unwords $ map showChordSymbol $ reverse $ rsHistory st)
              putStrLn $ "Saved to " ++ path
              replLoop stateRef
          | otherwise -> do
              playLine line stateRef
              replLoop stateRef

playLine :: String -> IORef ReplState -> IO ()
playLine input stateRef = do
  case parseChords input of
    Left err -> putStrLn $ "Parse error: " ++ err
    Right chords -> do
      st <- readIORef stateRef
      let arp = rsArpeggio st
          noteGroups = map chordToNotes chords
      playChords noteGroups 1.0 arp
      modifyIORef stateRef (\s -> s { rsHistory = reverse chords ++ rsHistory s })

chordToNotes :: ChordSymbol -> [Pitch]
chordToNotes (ChordSymbol root qual inv) = voiceChord root qual inv

loadAndPlay :: FilePath -> IORef ReplState -> IO ()
loadAndPlay path stateRef = do
  exists <- doesFileExist path
  if not exists
    then putStrLn $ "File not found: " ++ path
    else do
      contents <- readFile path
      playLine contents stateRef

runBatch :: FilePath -> Bool -> IO ()
runBatch path isArp = do
  exists <- doesFileExist path
  if not exists
    then putStrLn $ "File not found: " ++ path
    else do
      contents <- readFile path
      case parseChords contents of
        Left err -> putStrLn $ "Parse error: " ++ err
        Right chords -> do
          let noteGroups = map chordToNotes chords
          playChords noteGroups 1.0 isArp

runEditMode :: FilePath -> Bool -> IO ()
runEditMode path isArp = do
  editor <- lookupEnv "EDITOR"
  case editor of
    Nothing -> putStrLn "EDITOR not set"
    Just ed -> do
      callProcess ed [path]
      runBatch path isArp

showChordSymbol :: ChordSymbol -> String
showChordSymbol (ChordSymbol root qual inv) =
  let invStr = if inv == 0 then "" else show inv
      rootStr = showPitchClass root
      qualStr = showQuality qual
  in invStr ++ rootStr ++ qualStr

showPitchClass :: PitchClass -> String
showPitchClass C  = "C"
showPitchClass Cs = "C#"
showPitchClass D  = "D"
showPitchClass Ds = "Eb"
showPitchClass E  = "E"
showPitchClass F  = "F"
showPitchClass Fs = "F#"
showPitchClass G  = "G"
showPitchClass Gs = "Ab"
showPitchClass A  = "A"
showPitchClass As = "Bb"
showPitchClass B  = "B"

showQuality :: ChordType -> String
showQuality Major   = ""
showQuality Minor   = "m"
showQuality Dom7    = "7"
showQuality Maj7    = "maj7"
showQuality Min7    = "m7"
showQuality Dim     = "dim"
showQuality Dim7    = "dim7"
showQuality Aug     = "aug"
showQuality HalfDim7 = "m7b5"
showQuality Sus4    = "sus4"
showQuality Sus2    = "sus2"
showQuality MinMaj7 = "mMaj7"
showQuality Maj6    = "6"
showQuality Min6    = "m6"
showQuality Dom9    = "9"

printHelp :: IO ()
printHelp = putStrLn $ unlines
  [ "Commands:"
  , "  <chords>       Play chord(s), e.g.: Bb7 2Eb Fm7"
  , "  :load <file>   Load and play a chord file"
  , "  :save <file>   Save session chords to file"
  , "  :arp           Switch to arpeggio mode"
  , "  :block         Switch to block chord mode"
  , "  :list          Show chords in current session"
  , "  :clear         Clear session"
  , "  :help          Show this help"
  , "  :quit          Exit (or Ctrl-D)"
  , ""
  , "Chord syntax: [inversion]<root><quality>"
  , "  Roots:      C C# Db D D# Eb E F F# Gb G G# Ab A A# Bb B"
  , "  Qualities:  (none)=maj, m, 7, maj7, m7, dim, dim7, aug, +"
  , "              m7b5, sus4, sus2, mMaj7, 6, m6"
  , "  Inversions: 0-3 (positive), -1 to -3 (negative)"
  , "  Examples:   C  Am7  Bb7  2Eb  -1G7  F#dim7"
  ]
