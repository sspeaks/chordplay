import { useMemo } from 'react';
import { parseChordSequence } from '../engine/parser';

interface ChordInputProps {
  value: string;
  onChange: (value: string) => void;
  currentChordIndex: number;
}

export default function ChordInput({
  value,
  onChange,
  currentChordIndex,
}: ChordInputProps) {
  const segments = useMemo(() => {
    // Split preserving whitespace as separate segments
    const parts = value.split(/(\s+)/);
    const parseResults = parseChordSequence(value);
    let chordIdx = 0;

    return parts.map(part => {
      if (/^\s*$/.test(part)) {
        return { text: part, isChord: false, isValid: true, validIndex: -1 };
      }
      const result = parseResults[chordIdx];
      const isValid = result?.ok ?? false;
      // Map this token index to its position among valid chords
      const validIndex = isValid
        ? parseResults.slice(0, chordIdx + 1).filter(r => r.ok).length - 1
        : -1;
      chordIdx++;
      return { text: part, isChord: true, isValid, validIndex };
    });
  }, [value]);

  return (
    <div className="chord-input-container">
      <textarea
        className="chord-input-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter chord symbols (e.g., D A7 G Gm D)"
        spellCheck={false}
      />
      <div className="chord-input-display" aria-hidden="true">
        {segments.map((seg, i) => {
          if (!seg.isChord) return <span key={i}>{seg.text}</span>;
          const isActive = seg.validIndex === currentChordIndex;
          const cls = [
            'chord-token',
            isActive ? 'chord-active' : '',
            !seg.isValid ? 'chord-invalid' : '',
          ].filter(Boolean).join(' ');
          return <span key={i} className={cls}>{seg.text}</span>;
        })}
      </div>
    </div>
  );
}
