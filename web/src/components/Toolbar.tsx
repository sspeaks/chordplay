import { VoiceLeading, PlayStyle, Tuning } from '../types';

interface ToolbarProps {
  voiceLeading: VoiceLeading;
  playStyle: PlayStyle;
  tuning: Tuning;
  onVoiceLeadingChange: (mode: VoiceLeading) => void;
  onPlayStyleChange: (style: PlayStyle) => void;
  onTuningChange: (tuning: Tuning) => void;
  onToggleSyntaxHelp: () => void;
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

export default function Toolbar({
  voiceLeading,
  playStyle,
  tuning,
  onVoiceLeadingChange,
  onPlayStyleChange,
  onTuningChange,
  onToggleSyntaxHelp,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <ToggleGroup
        label="Voice Leading"
        options={['off', 'smooth', 'bass'] as const}
        value={voiceLeading}
        onChange={onVoiceLeadingChange}
        labels={{ off: 'Off', smooth: 'Smooth', bass: 'Bass-weighted' }}
      />
      
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
    </div>
  );
}
