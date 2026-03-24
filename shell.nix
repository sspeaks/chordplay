{ pkgs ? import <nixpkgs> { }, ... }:
let
  src = builtins.path { path = ./.; name = "source"; };
  chordplay = pkgs.haskellPackages.callCabal2nix "chordplay" src { };
in
pkgs.haskellPackages.shellFor {
  packages = hpkgs: [ chordplay ];
  nativeBuildInputs = with pkgs.haskellPackages; [
    haskell-language-server
    cabal-install
  ] ++ [ pkgs.pulseaudio pkgs.nodejs ];
  shellHook = ''
    export PATH="$PWD/web/node_modules/.bin:$PATH"
  '';
}
