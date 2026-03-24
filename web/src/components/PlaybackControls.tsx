interface PlaybackControlsProps {
  isPlaying: boolean;
  tempo: number;
  currentChordIndex: number;
  totalChords: number;
  onPlay: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  onTempoChange: (tempo: number) => void;
}

export default function PlaybackControls({
  isPlaying,
  tempo,
  currentChordIndex,
  totalChords,
  onPlay,
  onStop,
  onPrev,
  onNext,
  onReset,
  onTempoChange,
}: PlaybackControlsProps) {
  return (
    <div className="playback-controls">
      <div className="transport-buttons">
        <button 
          className="control-btn" 
          onClick={onReset}
          disabled={totalChords === 0}
          title="Reset to beginning"
        >
          ⏮⏮
        </button>
        <button 
          className="control-btn" 
          onClick={onPrev}
          disabled={totalChords === 0}
          title="Previous chord (←)"
        >
          ⏮
        </button>
        <button 
          className={`play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={isPlaying ? onStop : onPlay}
          disabled={totalChords === 0}
          title={isPlaying ? 'Stop' : 'Play from current chord'}
        >
          {isPlaying ? '■' : '▶'}
        </button>
        <button 
          className="control-btn" 
          onClick={onNext}
          disabled={totalChords === 0}
          title="Next chord (→)"
        >
          ⏭
        </button>
      </div>
      
      <div className="tempo-control">
        <label htmlFor="tempo-slider">Tempo</label>
        <input
          id="tempo-slider"
          type="range"
          min="0.3"
          max="3.0"
          step="0.1"
          value={tempo}
          onChange={(e) => onTempoChange(parseFloat(e.target.value))}
          className="tempo-slider"
        />
        <span className="tempo-value">{tempo.toFixed(1)}s</span>
      </div>
      
      <div className="chord-counter">
        {totalChords > 0 ? (
          <>Chord {currentChordIndex + 1} of {totalChords}</>
        ) : (
          <>No chords</>
        )}
      </div>
    </div>
  );
}
