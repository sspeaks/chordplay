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
  const tokens = value.split(/\s+/).filter(s => s.length > 0);
  const parseResults = parseChordSequence(value);
  
  const validIndices = new Set<number>();
  parseResults.forEach((result, idx) => {
    if (result.ok) validIndices.add(idx);
  });
  
  return (
    <div className="chord-input-container">
      <textarea
        className="chord-input-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter chord symbols (e.g., D A7 G Gm D)"
        spellCheck={false}
      />
      <div className="chord-input-display">
        {tokens.map((token, idx) => {
          const isValid = validIndices.has(idx);
          const isActive = isValid && 
            parseResults.slice(0, idx + 1).filter(r => r.ok).length - 1 === currentChordIndex;
          
          return (
            <span
              key={idx}
              className={`chord-token ${isActive ? 'chord-active' : ''} ${!isValid ? 'chord-invalid' : ''}`}
            >
              {token}
            </span>
          );
        })}
      </div>
    </div>
  );
}
