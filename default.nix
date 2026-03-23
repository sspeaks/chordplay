{ pkgs, ... }:
let
  src = builtins.path { path = ./.; name = "source"; };
  chordplay = pkgs.haskellPackages.callCabal2nix "chordplay" src { };
in
pkgs.symlinkJoin {
  name = "chordplay";
  paths = [ chordplay ];
  buildInputs = [ pkgs.makeWrapper ];
  postBuild = ''
    wrapProgram $out/bin/chordplay \
      --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.pulseaudio ]}
  '';
}