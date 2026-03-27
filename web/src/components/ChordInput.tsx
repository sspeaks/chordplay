import { useCallback, useMemo, useRef, useState } from 'react';
import type { ParseResult, ChordSymbol } from '../types';
import { tokenizeChordInput } from '../engine/parser';
import { chordDisplayName } from '../engine/chordSpelling';

interface ChordInputProps {
  value: string;
  onChange: (value: string) => void;
  currentChordIndex: number;
  isPlaying: boolean;
  parseResults: ParseResult<ChordSymbol>[];
}

export default function ChordInput({
  value,
  onChange,
  currentChordIndex,
  isPlaying,
  parseResults,
}: ChordInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const showOverlay = isPlaying || !isFocused;

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (displayRef.current) {
      displayRef.current.scrollTop = e.currentTarget.scrollTop;
      displayRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, []);

  const displayCallbackRef = useCallback((node: HTMLDivElement | null) => {
    (displayRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (node && textareaRef.current) {
      node.scrollTop = textareaRef.current.scrollTop;
      node.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const segments = useMemo(() => {
    const tokens = tokenizeChordInput(value);
    let chordIdx = 0;

    return tokens.map(token => {
      if (/^\s+$/.test(token)) {
        return { text: token, isChord: false, isValid: true, isWarning: false, validIndex: -1, tooltip: undefined as string | undefined };
      }
      const result = parseResults[chordIdx];
      const isValid = result?.ok ?? false;
      const chord = isValid ? (result as { ok: true; value: ChordSymbol }).value : null;
      const isWarning = !!(chord?.warning);
      const hasExplicit = !!(chord?.explicitVoicing);
      const tooltip = hasExplicit ? chordDisplayName(chord!) : undefined;
      const validIndex = isValid
        ? parseResults.slice(0, chordIdx + 1).filter(r => r.ok).length - 1
        : -1;
      chordIdx++;
      return { text: token, isChord: true, isValid, isWarning, validIndex, tooltip };
    });
  }, [value, parseResults]);

  return (
    <div className={`chord-input-container${showOverlay ? ' playing' : ''}`}>
      <textarea
        ref={textareaRef}
        className="chord-input-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Enter chord symbols (e.g., Cmaj7 Am7 Dm7 G7)"
        spellCheck={false}
        readOnly={isPlaying}
      />
      {showOverlay && (
        <div className="chord-input-display" ref={displayCallbackRef} aria-hidden="true">
          {segments.map((seg, i) => {
            if (!seg.isChord) return <span key={i}>{seg.text}</span>;
            const isActive = seg.validIndex === currentChordIndex;
            const cls = [
              'chord-token',
              isActive ? 'chord-active' : '',
              seg.isWarning ? 'chord-warning' : '',
              !seg.isValid ? 'chord-invalid' : '',
            ].filter(Boolean).join(' ');
            return <span key={i} className={cls} title={seg.tooltip}>{seg.text}</span>;
          })}
        </div>
      )}
    </div>
  );
}
