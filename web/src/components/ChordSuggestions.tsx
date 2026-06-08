import { useMemo } from 'react';
import type { KeySignature, QualityChordSymbol } from '../types';
import { generateSuggestions } from '../engine/chordSuggestions';
import { chordDisplayName } from '../engine/chordSpelling';

interface ChordSuggestionsProps {
  currentChord: QualityChordSymbol | null;
  selectedKey: KeySignature;
  isPlaying: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onPreview: (chord: QualityChordSymbol) => void;
  onInsert: (text: string) => void;
}

export default function ChordSuggestions({
  currentChord,
  selectedKey,
  isPlaying,
  isOpen,
  onToggle,
  onPreview,
  onInsert,
}: ChordSuggestionsProps) {
  const suggestions = useMemo(() => {
    if (!currentChord) return [];
    return generateSuggestions(currentChord, selectedKey);
  }, [currentChord, selectedKey]);

  if (!currentChord) return null;

  const currentLabel = chordDisplayName(currentChord);

  return (
    <div className={`suggestions-panel ${isOpen ? 'open' : 'collapsed'} ${isPlaying ? 'disabled' : ''}`}>
      <button className="suggestions-header" onClick={onToggle}>
        <span className="suggestions-title">
          Suggestions after
          <span className="suggestions-current">{currentLabel}</span>
        </span>
        <span className="suggestions-toggle">{isOpen ? '▼' : '▶'}</span>
      </button>

      {isOpen && (
        <div className="suggestions-chips">
          {suggestions.map((s) => (
            <div key={`${s.chord.root}-${s.chord.quality}`} className="suggestion-chip">
              <button
                className="chip-play"
                onClick={() => !isPlaying && onPreview(s.chord)}
                disabled={isPlaying}
                title={`Preview ${s.text}`}
              >
                <span className="chip-play-icon">▶</span>
                {s.text}
              </button>
              <button
                className="chip-add"
                onClick={() => !isPlaying && onInsert(s.text)}
                disabled={isPlaying}
                title={`Insert ${s.text} after current chord`}
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}