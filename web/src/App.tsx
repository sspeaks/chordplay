import { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceLeading, PlayStyle, Tuning, ChordSymbol, Pitch, PitchClass } from './types';
import { parseChordSequence } from './engine/parser';
import { voiceChordSequence } from './engine/voiceLeading';
import { ChordPlayer } from './engine/audio';
import Toolbar from './components/Toolbar';
import ChordInput from './components/ChordInput';
import PlaybackControls from './components/PlaybackControls';
import NoteCards from './components/NoteCards';
import TuningComparison from './components/TuningComparison';
import SyntaxReference from './components/SyntaxReference';

export default function App() {
  const [chordText, setChordText] = useState('D A7 A9 D D7 Ab7 G6 Gm6 D F#7');
  const [voiceLeading, setVoiceLeading] = useState<VoiceLeading>('off');
  const [playStyle, setPlayStyle] = useState<PlayStyle>('block');
  const [tuning, setTuning] = useState<Tuning>('just');
  const [tempo, setTempo] = useState(1.2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  const [syntaxHelpOpen, setSyntaxHelpOpen] = useState(false);
  
  const playerRef = useRef<ChordPlayer | null>(null);
  const playingRef = useRef(false);
  
  const parseResults = parseChordSequence(chordText);
  const validChords: ChordSymbol[] = parseResults
    .filter(r => r.ok)
    .map(r => (r as { ok: true; value: ChordSymbol }).value);
  
  const smoothMode = voiceLeading === 'smooth' ? 'equal' : voiceLeading === 'bass' ? 'bass' : null;
  const voicings = validChords.length > 0 
    ? voiceChordSequence(smoothMode, validChords) 
    : [];
  
  const currentVoicing = voicings[currentChordIndex] || null;
  const currentChord = validChords[currentChordIndex] || null;
  
  // Transform voicings into format expected by ChordPlayer
  const playableChords = voicings.map((pitches, idx) => ({
    root: validChords[idx]!.root,
    pitches,
  }));
  
  const handlePlay = () => {
    if (validChords.length === 0) return;
    
    setIsPlaying(true);
    playingRef.current = true;
    
    const player = new ChordPlayer();
    playerRef.current = player;
    
    // Start from currently selected chord
    const startIdx = currentChordIndex;
    const chordsToPlay = playableChords.slice(startIdx);
    
    player.playSequence(
      chordsToPlay,
      tempo,
      tuning,
      playStyle,
      (index) => {
        if (playingRef.current) {
          setCurrentChordIndex(startIdx + index);
        }
      }
    ).then(() => {
      if (playingRef.current) {
        setIsPlaying(false);
        playingRef.current = false;
      }
    });
  };
  
  const handleStop = () => {
    playingRef.current = false;
    setIsPlaying(false);
    if (playerRef.current) {
      playerRef.current.stopCurrent();
      playerRef.current = null;
    }
  };
  
  const playSingleChord = (index: number) => {
    if (index < 0 || index >= validChords.length) return;
    if (!playerRef.current) playerRef.current = new ChordPlayer();
    const chord = validChords[index]!;
    const pitches = voicings[index]!;
    playerRef.current.playChord(chord.root, pitches, tempo, tuning, playStyle);
  };

  const handlePrev = useCallback(() => {
    if (currentChordIndex > 0) {
      const newIdx = currentChordIndex - 1;
      setCurrentChordIndex(newIdx);
      playSingleChord(newIdx);
    }
  }, [currentChordIndex]);
  
  const handleNext = useCallback(() => {
    if (currentChordIndex < validChords.length - 1) {
      const newIdx = currentChordIndex + 1;
      setCurrentChordIndex(newIdx);
      playSingleChord(newIdx);
    }
  }, [currentChordIndex, validChords.length]);

  const handleReset = () => {
    setCurrentChordIndex(0);
    playSingleChord(0);
  };

  // Arrow key navigation (when textarea not focused)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePrev, handleNext]);
  
  const currentRoot: PitchClass | null = currentChord?.root || null;
  const currentPitches: [Pitch, Pitch, Pitch, Pitch] | null = 
    (currentVoicing && currentVoicing.length === 4) 
      ? [currentVoicing[0]!, currentVoicing[1]!, currentVoicing[2]!, currentVoicing[3]!] 
      : null;
  const chordName = currentChord 
    ? `${currentChord.root} ${currentChord.quality}${currentChord.inversion !== null ? ` (inv ${currentChord.inversion})` : ''}` 
    : '';
  
  return (
    <div className="app">
      <header className="app-header">
        <h1>♩ ChordPlay</h1>
        <p className="subtitle">Barbershop Harmony Explorer</p>
      </header>
      
      <Toolbar
        voiceLeading={voiceLeading}
        playStyle={playStyle}
        tuning={tuning}
        onVoiceLeadingChange={setVoiceLeading}
        onPlayStyleChange={setPlayStyle}
        onTuningChange={setTuning}
        onToggleSyntaxHelp={() => setSyntaxHelpOpen(!syntaxHelpOpen)}
      />
      
      <ChordInput
        value={chordText}
        onChange={setChordText}
        currentChordIndex={currentChordIndex}
      />
      
      <PlaybackControls
        isPlaying={isPlaying}
        tempo={tempo}
        currentChordIndex={currentChordIndex}
        totalChords={validChords.length}
        onPlay={handlePlay}
        onStop={handleStop}
        onPrev={handlePrev}
        onNext={handleNext}
        onReset={handleReset}
        onTempoChange={setTempo}
      />
      
      <NoteCards
        pitches={currentPitches}
        root={currentRoot}
        tuning={tuning}
      />
      
      <TuningComparison
        root={currentRoot}
        pitches={currentPitches}
        chordName={chordName}
      />
      
      <SyntaxReference
        isOpen={syntaxHelpOpen}
        onClose={() => setSyntaxHelpOpen(false)}
      />
    </div>
  );
}