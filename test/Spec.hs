import Test.Hspec
import qualified MusicTheorySpec
import qualified ParserSpec
import qualified AudioSpec

main :: IO ()
main = hspec $ do
  MusicTheorySpec.spec
  ParserSpec.spec
  AudioSpec.spec