import { VoiceLeading, PlayStyle, Tuning, NotationMode, KeySignature, PitchClass, KeyQuality } from '../types';
import { midiToNoteName } from '../engine/musicTheory';

interface ToolbarProps {
  voiceLeading: VoiceLeading;
  playStyle: PlayStyle;
  tuning: Tuning;
  notationMode: NotationMode;
  selectedKey: KeySignature;
  onVoiceLeadingChange: (mode: VoiceLeading) => void;
  onPlayStyleChange: (style: PlayStyle) => void;
  onTuningChange: (tuning: Tuning) => void;
  onNotationModeChange: (mode: NotationMode) => void;
  onKeyChange: (key: KeySignature) => void;
  onToggleSyntaxHelp: () => void;
  onExportWav: () => void;
  exportDisabled: boolean;
  isExporting: boolean;
  gravityCenter: number;
  targetSpread: number;
  onGravityCenterChange: (value: number) => void;
  onTargetSpreadChange: (value: number) => void;
}

interface ToggleGroupProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labels?: Record<T, string>;
}

function ToggleGroup<T extends string>({ 
  label, 
  options, 
  value, 
  onChange,
  labels 
}: ToggleGroupProps<T>) {
  return (
    <div className="toggle-group">
      <span className="group-label">{label}</span>
      <div className="toggle-buttons">
        {options.map(opt => (
          <button
            key={opt}
            className={`toggle-btn ${value === opt ? 'active' : ''}`}
            onClick={() => onChange(opt)}
          >
            {labels?.[opt] || opt}
          </button>
        ))}
      </div>
    </div>
  );
}

const KEY_DISPLAY_NAMES: Record<PitchClass, string> = {
  C: 'C', Cs: 'C♯/D♭', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'F♯/G♭', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};

const KEY_OPTIONS: PitchClass[] = [
  'C', 'G', 'D', 'A', 'E', 'B', 'Fs', 'Cs', 'F', 'As', 'Ds', 'Gs',
];

function KeySelector({ selectedKey, onKeyChange }: {
  selectedKey: KeySignature;
  onKeyChange: (key: KeySignature) => void;
}) {
  const keyValue = `${selectedKey.root}-${selectedKey.quality}`;

  return (
    <div className="toggle-group">
      <span className="group-label">Key</span>
      <select
        className="key-selector"
        value={keyValue}
        onChange={(e) => {
          const [root, quality] = e.target.value.split('-') as [PitchClass, KeyQuality];
          onKeyChange({ root, quality });
        }}
      >
        <optgroup label="Major">
          {KEY_OPTIONS.map(pc => (
            <option key={`${pc}-major`} value={`${pc}-major`}>
              {KEY_DISPLAY_NAMES[pc]} major
            </option>
          ))}
        </optgroup>
        <optgroup label="Minor">
          {KEY_OPTIONS.map(pc => (
            <option key={`${pc}-minor`} value={`${pc}-minor`}>
              {KEY_DISPLAY_NAMES[pc]} minor
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}

export default function Toolbar({
  voiceLeading,
  playStyle,
  tuning,
  notationMode,
  selectedKey,
  onVoiceLeadingChange,
  onPlayStyleChange,
  onTuningChange,
  onNotationModeChange,
  onKeyChange,
  onToggleSyntaxHelp,
  onExportWav,
  exportDisabled,
  isExporting,
  gravityCenter,
  targetSpread,
  onGravityCenterChange,
  onTargetSpreadChange,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <ToggleGroup
        label="Notation"
        options={['standard', 'roman'] as const}
        value={notationMode}
        onChange={onNotationModeChange}
        labels={{ standard: 'Standard', roman: 'Roman' }}
      />

      {notationMode === 'roman' && (
        <KeySelector selectedKey={selectedKey} onKeyChange={onKeyChange} />
      )}

      <ToggleGroup
        label="Voice Leading"
        options={['off', 'smooth', 'bass'] as const}
        value={voiceLeading}
        onChange={onVoiceLeadingChange}
        labels={{ off: 'Off', smooth: 'Smooth', bass: 'Bass-weighted' }}
      />

      {(voiceLeading === 'smooth' || voiceLeading === 'bass') && (
        <details className="voice-leading-advanced">
          <summary>Advanced</summary>
          <div className="voice-leading-options">
            <label className="slider-label">
              <span className="slider-name">Gravity</span>
              <input
                type="range"
                min={36}
                max={72}
                value={gravityCenter}
                onChange={e => onGravityCenterChange(Number(e.target.value))}
                className="vl-slider"
              />
              <span className="slider-value">{midiToNoteName(gravityCenter)}</span>
            </label>
            <label className="slider-label">
              <span className="slider-name">Spread</span>
              <input
                type="range"
                min={12}
                max={36}
                value={targetSpread}
                onChange={e => onTargetSpreadChange(Number(e.target.value))}
                className="vl-slider"
              />
              <span className="slider-value">{(targetSpread / 12).toFixed(1)} oct</span>
            </label>
          </div>
        </details>
      )}
      
      <ToggleGroup
        label="Style"
        options={['block', 'arpeggio'] as const}
        value={playStyle}
        onChange={onPlayStyleChange}
        labels={{ block: 'Block', arpeggio: 'Arpeggio' }}
      />
      
      <ToggleGroup
        label="Tuning"
        options={['just', 'equal'] as const}
        value={tuning}
        onChange={onTuningChange}
        labels={{ just: 'Just', equal: 'Equal' }}
      />
      
      <button className="syntax-help-btn" onClick={onToggleSyntaxHelp}>
        Syntax Help
      </button>
      
      <button
        className="syntax-help-btn"
        onClick={onExportWav}
        disabled={exportDisabled || isExporting}
        title="Export chord sequence as WAV file"
      >
        {isExporting ? 'Exporting…' : 'Export WAV'}
      </button>
    </div>
  );
}
