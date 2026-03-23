module Main where

import System.Environment (getArgs)
import ChordPlay.Repl

main :: IO ()
main = do
  args <- getArgs
  case args of
    []                    -> repl
    ["--arp", path]       -> runBatch path True
    ["--edit", path]      -> runEditMode path False
    ["--edit", "--arp", p] -> runEditMode p True
    ["--arp", "--edit", p] -> runEditMode p True
    [path]                -> runBatch path False
    _                     -> putStrLn "Usage: chordplay [--arp] [--edit] [file.txt]"
