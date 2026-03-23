module Main where

import System.Environment (getArgs)
import Data.List (isPrefixOf, partition)
import ChordPlay.MusicTheory (SmoothMode(..))
import ChordPlay.Repl

main :: IO ()
main = do
  args <- getArgs
  let (flags, rest) = partition ("-" `isPrefixOf`) args
      arp        = "--arp" `elem` flags
      edit       = "--edit" `elem` flags
      smooth     = "--smooth" `elem` flags
      smoothBass = "--smooth-bass" `elem` flags
      known      = ["--arp", "--edit", "--smooth", "--smooth-bass"]
      bad        = filter (`notElem` known) flags
      sm | smooth && smoothBass = Nothing
         | smooth               = Just (Just SmoothEqual)
         | smoothBass           = Just (Just SmoothBass)
         | otherwise            = Just Nothing
  if not (null bad) then printUsage
  else case sm of
    Nothing -> do
      putStrLn "Error: --smooth and --smooth-bass are mutually exclusive"
      printUsage
    Just smoothMode -> case (edit, rest) of
      (False, [])     -> repl smoothMode
      (False, [path]) -> runBatch path arp smoothMode
      (True,  [path]) -> runEditMode path arp smoothMode
      _               -> printUsage

printUsage :: IO ()
printUsage = putStrLn "Usage: chordplay [--smooth|--smooth-bass] [--arp] [--edit] [file.txt]"
