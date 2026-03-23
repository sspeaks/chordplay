module ChordPlay.Playback
  ( playChord
  , playChords
  ) where

import qualified Data.ByteString.Lazy as BL
import System.Process
import System.IO
import Control.Exception (IOException, catch)
import ChordPlay.MusicTheory
import ChordPlay.Audio

playPcm :: BL.ByteString -> IO ()
playPcm pcmData = do
  let cmd = "paplay"
      args = ["--raw", "--format=s16le", "--rate=44100", "--channels=1"]
  (Just hin, _, _, ph) <- createProcess (proc cmd args)
    { std_in = CreatePipe, std_out = NoStream, std_err = NoStream }
  BL.hPut hin pcmData `catch` \(_ :: IOException) -> pure ()
  hClose hin
  _ <- waitForProcess ph
  pure ()

playChord :: [Pitch] -> Double -> Bool -> IO ()
playChord pitches duration isArp = do
  let pcm = renderChord pitches duration isArp
  playPcm pcm `catch` \(e :: IOException) ->
    putStrLn $ "Audio playback failed: " ++ show e
      ++ "\nMake sure PulseAudio is running (WSLg)."

playChords :: [[Pitch]] -> Double -> Bool -> IO ()
playChords [] _ _ = pure ()
playChords [c] dur isArp = playChord c dur isArp
playChords (c:cs) dur isArp = do
  playChord c dur isArp
  let silence = renderSilence 0.1
  playPcm silence
  playChords cs dur isArp
