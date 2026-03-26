import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { VoiceLeading, PlayStyle, Tuning, ChordSymbol, Pitch, PitchClass, NotationMode, KeySignature, VoiceLeadingOptions } from './types';
import { parseChordSequence } from './engine/parser';
import { parseRomanSequence } from './engine/romanParser';
import { chordTextToRoman, romanTextToStandard } from './engine/romanConverter';
import { voiceChordSequence, smoothVoice } from './engine/voiceLeading';
import { voiceChord, chordPitchClasses } from './engine/musicTheory';
import { DEFAULTS, encodeUrlState, decodeUrlState, AppState } from './engine/urlState';
import { ChordPlayer, renderSequenceOffline } from './engine/audio';
import { encodeWav } from './engine/wav';
import { inferKey } from './engine/keyInference';
import { insertChordAfterIndex } from './engine/chordSuggestions';
import Toolbar from './components/Toolbar';
import ChordInput from './components/ChordInput';
import PlaybackControls from './components/PlaybackControls';
import NoteCards from './components/NoteCards';
import TuningComparison from './components/TuningComparison';
import SyntaxReference from './components/SyntaxReference';
import KeyBadge from './components/KeyBadge';
import ChordSuggestions from './components/ChordSuggestions';

const initialUrlState = decodeUrlState(window.location.hash);

export default function App() {
  const [chordText, setChordText] = useState(initialUrlState.chordText ?? DEFAULTS.chordText);
  const [voiceLeading, setVoiceLeading] = useState<VoiceLeading>(initialUrlState.voiceLeading ?? DEFAULTS.voiceLeading);
  const [playStyle, setPlayStyle] = useState<PlayStyle>(initialUrlState.playStyle ?? DEFAULTS.playStyle);
  const [tuning, setTuning] = useState<Tuning>(initialUrlState.tuning ?? DEFAULTS.tuning);
  const [tempo, setTempo] = useState(initialUrlState.tempo ?? DEFAULTS.tempo);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  const [syntaxHelpOpen, setSyntaxHelpOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [notationMode, setNotationMode] = useState<NotationMode>(initialUrlState.notationMode ?? DEFAULTS.notationMode);
  const [selectedKey, setSelectedKey] = useState<KeySignature>(initialUrlState.selectedKey ?? DEFAULTS.selectedKey);
  const [gravityCenter, setGravityCenter] = useState(initialUrlState.gravityCenter ?? DEFAULTS.gravityCenter);
  const [targetSpread, setTargetSpread] = useState(initialUrlState.targetSpread ?? DEFAULTS.targetSpread);
  const [keyManuallySet, setKeyManuallySet] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const state: AppState = { chordText, tuning, voiceLeading, playStyle, tempo, notationMode, selectedKey, gravityCenter, targetSpread };
      const hash = encodeUrlState(state);
      history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname);
    }, 300);
    return () => clearTimeout(timer);
  }, [chordText, tuning, voiceLeading, playStyle, tempo, notationMode, selectedKey, gravityCenter, targetSpread]);
  
  const playerRef = useRef<ChordPlayer | null>(null);
  const playingRef = useRef(false);
  
  const parseResults = notationMode === 'standard'
    ? parseChordSequence(chordText)
    : parseRomanSequence(chordText, selectedKey);
  const validChords: ChordSymbol[] = parseResults
    .filter(r => r.ok)
    .map(r => (r as { ok: true; value: ChordSymbol }).value);
  
  // Auto-infer key when 2+ valid chords exist and key hasn't been manually set
  const inferredKey = useMemo(() => {
    if (validChords.length >= 2) {
      return inferKey(validChords);
    }
    return null;
  }, [validChords]);

  useEffect(() => {
    if (!keyManuallySet && inferredKey) {
      setSelectedKey(inferredKey);
    }
  }, [inferredKey, keyManuallySet]);
  
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
    
    // Reuse existing player to avoid leaking AudioContexts.
    // iOS Safari limits the total number of contexts (~4-6).
    if (playerRef.current) {
      playerRef.current.stopCurrent();
    } else {
      playerRef.current = new ChordPlayer();
    }
    const player = playerRef.current;
    
    // Resume AudioContext synchronously inside the user gesture —
    // iOS Safari requires this; an awaited resume() may never resolve.
    player.warmUp();
    
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
    playerRef.current?.stopCurrent();
  };
  
  const playSingleChord = (index: number) => {
    if (index < 0 || index >= validChords.length) return;
    if (!playerRef.current) playerRef.current = new ChordPlayer();
    playerRef.current.warmUp();
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
    setKeyManuallySet(true);
  }, [notationMode, chordText, selectedKey]);

  // Keyboard shortcuts (when textarea not focused)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
      if (e.key === ' ') { e.preventDefault(); playSingleChord(currentChordIndex); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePrev, handleNext, currentChordIndex]);

  const handlePreviewChord = useCallback((chord: ChordSymbol) => {
    if (!playerRef.current) playerRef.current = new ChordPlayer();
    playerRef.current.warmUp();
    const pitches = currentVoicing
      ? smoothVoice(
          smoothMode ?? 'equal',
          currentVoicing,
          chordPitchClasses(chord.root, chord.quality),
          voiceLeadingOptions,
        )
      : voiceChord(chord.root, chord.quality, 0);
    playerRef.current.playChord(chord.root, pitches, tempo, tuning, playStyle);
  }, [currentVoicing, smoothMode, voiceLeadingOptions, tempo, tuning, playStyle]);

  const handleInsertChord = useCallback((chordText_: string) => {
    const textToInsert = notationMode === 'roman'
      ? chordTextToRoman(chordText_, selectedKey)
      : chordText_;
    const newText = insertChordAfterIndex(chordText, currentChordIndex, textToInsert, parseResults);
    setChordText(newText);
    setCurrentChordIndex(currentChordIndex + 1);
  }, [chordText, currentChordIndex, parseResults, notationMode, selectedKey]);
  
  const currentRoot: PitchClass | null = currentChord?.root || null;
  const currentPitches: [Pitch, Pitch, Pitch, Pitch] | null = 
    (currentVoicing && currentVoicing.length === 4) 
      ? [currentVoicing[0]!, currentVoicing[1]!, currentVoicing[2]!, currentVoicing[3]!] 
      : null;
  const chordName = currentChord 
    ? `${currentChord.root} ${currentChord.quality}${currentChord.inversion !== null ? ` (inv ${currentChord.inversion})` : ''}` 
    : '';
  
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const showDebug = new URLSearchParams(window.location.search).has('debug');

  // Capture console.log/warn/error lines matching [audio]
  useEffect(() => {
    if (!showDebug) return;
    const orig = { log: console.log, warn: console.warn, error: console.error };
    const capture = (level: string, origFn: typeof console.log) =>
      (...args: any[]) => {
        origFn.apply(console, args);
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        if (msg.includes('[audio]')) {
          setDebugLog(prev => [...prev.slice(-19), `${level} ${msg}`]);
        }
      };
    console.log = capture('LOG', orig.log);
    console.warn = capture('WARN', orig.warn);
    console.error = capture('ERR', orig.error);
    return () => { Object.assign(console, orig); };
  }, [showDebug]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>♩ ChordPlay</h1>
        <p className="subtitle">Barbershop Harmony Explorer</p>
      </header>
      
      {showDebug && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '40vh',
          overflow: 'auto', background: '#111', color: '#0f0', fontSize: '11px',
          fontFamily: 'monospace', padding: '6px', zIndex: 9999, borderTop: '2px solid #0f0',
        }}>
          <strong>🔊 Audio Debug</strong>
          <button onClick={() => setDebugLog([])} style={{ marginLeft: 8, fontSize: 10 }}>Clear</button>
          {debugLog.length === 0 && <div style={{ color: '#888' }}>Tap Play to see audio state…</div>}
          {debugLog.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      
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
      
      <div className="chord-input-wrapper">
        <ChordInput
          value={chordText}
          onChange={setChordText}
          currentChordIndex={currentChordIndex}
          isPlaying={isPlaying}
          parseResults={parseResults}
        />
        <KeyBadge
          selectedKey={selectedKey}
          isAutoInferred={!keyManuallySet}
          onKeyChange={handleKeyChange}
          onResetToAuto={() => setKeyManuallySet(false)}
        />
      </div>

      <ChordSuggestions
        currentChord={currentChord}
        selectedKey={selectedKey}
        isPlaying={isPlaying}
        isOpen={suggestionsOpen}
        onToggle={() => setSuggestionsOpen(!suggestionsOpen)}
        onPreview={handlePreviewChord}
        onInsert={handleInsertChord}
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