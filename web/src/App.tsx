import { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceLeading, PlayStyle, Tuning, ChordSymbol, Pitch, PitchClass, NotationMode, KeySignature, VoiceLeadingOptions } from './types';
import { parseChordSequence } from './engine/parser';
import { parseRomanSequence } from './engine/romanParser';
import { chordTextToRoman, romanTextToStandard } from './engine/romanConverter';
import { voiceChordSequence, DEFAULT_GRAVITY_CENTER, DEFAULT_TARGET_SPREAD } from './engine/voiceLeading';
import { ChordPlayer, renderSequenceOffline } from './engine/audio';
import { encodeWav } from './engine/wav';
import Toolbar from './components/Toolbar';
import ChordInput from './components/ChordInput';
import PlaybackControls from './components/PlaybackControls';
import NoteCards from './components/NoteCards';
import TuningComparison from './components/TuningComparison';
import SyntaxReference from './components/SyntaxReference';

export default function App() {
  const [chordText, setChordText] = useState('Cmaj7 Am7 Dm7 G7 Em7 A7 Dm7 G7 Cmaj7 C7 Fmaj7 Fm6 Cmaj7 Am7 Dm7 G7 Cmaj7');
  const [voiceLeading, setVoiceLeading] = useState<VoiceLeading>('smooth');
  const [playStyle, setPlayStyle] = useState<PlayStyle>('block');
  const [tuning, setTuning] = useState<Tuning>('just');
  const [tempo, setTempo] = useState(1.2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  const [syntaxHelpOpen, setSyntaxHelpOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [notationMode, setNotationMode] = useState<NotationMode>('standard');
  const [selectedKey, setSelectedKey] = useState<KeySignature>({ root: 'C', quality: 'major' });
  const [gravityCenter, setGravityCenter] = useState(DEFAULT_GRAVITY_CENTER);
  const [targetSpread, setTargetSpread] = useState(DEFAULT_TARGET_SPREAD);
  
  const playerRef = useRef<ChordPlayer | null>(null);
  const playingRef = useRef(false);
  
  const parseResults = notationMode === 'standard'
    ? parseChordSequence(chordText)
    : parseRomanSequence(chordText, selectedKey);
  const validChords: ChordSymbol[] = parseResults
    .filter(r => r.ok)
    .map(r => (r as { ok: true; value: ChordSymbol }).value);
  
  const smoothMode = voiceLeading === 'smooth' ? 'equal' : voiceLeading === 'bass' ? 'bass' : null;
  const voiceLeadingOptions: VoiceLeadingOptions = { gravityCenter, targetSpread };
  const voicings = validChords.length > 0 
    ? voiceChordSequence(smoothMode, validChords, voiceLeadingOptions) 
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

  const handleExportWav = async () => {
    if (playableChords.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const buffer = await renderSequenceOffline(playableChords, tempo, tuning, playStyle);
      const blob = encodeWav(buffer);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chordplay.wav';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleNotationModeChange = useCallback((newMode: NotationMode) => {
    if (newMode === notationMode) return;
    if (newMode === 'roman') {
      setChordText(chordTextToRoman(chordText, selectedKey));
    } else {
      setChordText(romanTextToStandard(chordText, selectedKey));
    }
    setNotationMode(newMode);
  }, [notationMode, chordText, selectedKey]);

  const handleKeyChange = useCallback((newKey: KeySignature) => {
    if (notationMode === 'roman') {
      const standard = romanTextToStandard(chordText, selectedKey);
      setChordText(chordTextToRoman(standard, newKey));
    }
    setSelectedKey(newKey);
  }, [notationMode, chordText, selectedKey]);

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
        notationMode={notationMode}
        selectedKey={selectedKey}
        gravityCenter={gravityCenter}
        targetSpread={targetSpread}
        onVoiceLeadingChange={setVoiceLeading}
        onPlayStyleChange={setPlayStyle}
        onTuningChange={setTuning}
        onNotationModeChange={handleNotationModeChange}
        onKeyChange={handleKeyChange}
        onGravityCenterChange={setGravityCenter}
        onTargetSpreadChange={setTargetSpread}
        onToggleSyntaxHelp={() => setSyntaxHelpOpen(!syntaxHelpOpen)}
        onExportWav={handleExportWav}
        exportDisabled={validChords.length === 0}
        isExporting={isExporting}
      />
      
      <ChordInput
        value={chordText}
        onChange={setChordText}
        currentChordIndex={currentChordIndex}
        isPlaying={isPlaying}
        parseResults={parseResults}
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