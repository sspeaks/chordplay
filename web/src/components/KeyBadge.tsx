import { useState, useRef, useEffect } from 'react';
import type { KeySignature, PitchClass } from '../types';

const KEY_DISPLAY_NAMES: Record<PitchClass, string> = {
  C: 'C', Cs: 'C♯/D♭', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'F♯/G♭', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};

const KEY_OPTIONS: PitchClass[] = [
  'C', 'G', 'D', 'A', 'E', 'B', 'Fs', 'Cs', 'F', 'As', 'Ds', 'Gs',
];

interface KeyBadgeProps {
  selectedKey: KeySignature;
  isAutoInferred: boolean;
  onKeyChange: (key: KeySignature) => void;
  onResetToAuto: () => void;
}

export default function KeyBadge({
  selectedKey,
  isAutoInferred,
  onKeyChange,
  onResetToAuto,
}: KeyBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const displayName = `${KEY_DISPLAY_NAMES[selectedKey.root]} ${selectedKey.quality}`;

  return (
    <div className="key-badge-container" ref={dropdownRef}>
      <button
        className={`key-badge ${isAutoInferred ? 'auto' : 'manual'}`}
        onClick={() => setIsOpen(!isOpen)}
        title={isAutoInferred ? 'Auto-detected key (click to override)' : 'Manually set key (click to change)'}
      >
        <span className="key-badge-label">Key:</span>
        <span className="key-badge-value">{displayName}</span>
        {isAutoInferred && <span className="key-badge-auto">auto</span>}
      </button>

      {isOpen && (
        <div className="key-badge-dropdown">
          {!isAutoInferred && (
            <button
              className="key-badge-reset"
              onClick={() => { onResetToAuto(); setIsOpen(false); }}
            >
              ↻ Auto-detect
            </button>
          )}
          <div className="key-badge-section">
            <div className="key-badge-section-label">Major</div>
            {KEY_OPTIONS.map(pc => (
              <button
                key={`${pc}-major`}
                className={`key-badge-option ${selectedKey.root === pc && selectedKey.quality === 'major' ? 'active' : ''}`}
                onClick={() => { onKeyChange({ root: pc, quality: 'major' }); setIsOpen(false); }}
              >
                {KEY_DISPLAY_NAMES[pc]}
              </button>
            ))}
          </div>
          <div className="key-badge-section">
            <div className="key-badge-section-label">Minor</div>
            {KEY_OPTIONS.map(pc => (
              <button
                key={`${pc}-minor`}
                className={`key-badge-option ${selectedKey.root === pc && selectedKey.quality === 'minor' ? 'active' : ''}`}
                onClick={() => { onKeyChange({ root: pc, quality: 'minor' }); setIsOpen(false); }}
              >
                {KEY_DISPLAY_NAMES[pc]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}