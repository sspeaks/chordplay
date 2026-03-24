interface SyntaxReferenceProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROOTS = [
  { display: 'C', code: 'C' },
  { display: 'C♯', code: 'Cs' },
  { display: 'D♭', code: 'Cs' },
  { display: 'D', code: 'D' },
  { display: 'E♭', code: 'Ds' },
  { display: 'E', code: 'E' },
  { display: 'F', code: 'F' },
  { display: 'F♯', code: 'Fs' },
  { display: 'G♭', code: 'Fs' },
  { display: 'G', code: 'G' },
  { display: 'A♭', code: 'Gs' },
  { display: 'A', code: 'A' },
  { display: 'B♭', code: 'As' },
  { display: 'B', code: 'B' },
];

const QUALITIES = [
  { display: 'Major', code: '' },
  { display: 'Dom 9 (rootless)', code: '9' },
  { display: 'Minor', code: 'm' },
  { display: 'Maj 6', code: '6' },
  { display: 'Dom 7', code: '7' },
  { display: 'Min 6', code: 'm6' },
  { display: 'Maj 7', code: 'M7' },
  { display: 'Dim', code: 'dim' },
  { display: 'Min 7', code: 'm7' },
  { display: 'Dim 7', code: 'dim7' },
  { display: 'Half-Dim 7', code: 'm7b5' },
  { display: 'Aug', code: 'aug' },
  { display: 'Min-Maj 7', code: 'mM7' },
  { display: 'Sus 4', code: 'sus4' },
  { display: 'Sus 2', code: 'sus2' },
];

export default function SyntaxReference({ isOpen, onClose }: SyntaxReferenceProps) {
  return (
    <div className={`syntax-reference ${isOpen ? 'open' : ''}`}>
      <div className="syntax-header">
        <h2>Chord Syntax Reference</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      
      <div className="syntax-content">
        <section className="format-section">
          <h3>Format</h3>
          <div className="format-example">
            <span className="fmt-inversion">[inversion]</span>
            <span className="fmt-root">root</span>
            <span className="fmt-quality">quality</span>
          </div>
          <p className="format-desc">
            Inversion is optional (defaults to automatic in smooth mode).
            Root is required. Quality defaults to Major if omitted.
          </p>
        </section>
        
        <section className="roots-section">
          <h3>Roots</h3>
          <div className="root-chips">
            {ROOTS.map((root, idx) => (
              <span key={idx} className="chip root-chip">
                {root.display} <code>{root.code}</code>
              </span>
            ))}
          </div>
        </section>
        
        <section className="qualities-section">
          <h3>Qualities</h3>
          <div className="quality-grid">
            {QUALITIES.map((qual, idx) => (
              <div key={idx} className="quality-item">
                <span className="quality-display">{qual.display}</span>
                <code className="quality-code">{qual.code || '(none)'}</code>
              </div>
            ))}
          </div>
        </section>
        
        <section className="inversions-section">
          <h3>Inversions</h3>
          <div className="inversion-info">
            <p><strong>0</strong> = Root position</p>
            <p><strong>1</strong> = 1st inversion (↑ 3rd to bass)</p>
            <p><strong>2</strong> = 2nd inversion (↑ 5th to bass)</p>
            <p><strong>3</strong> = 3rd inversion (↑ 7th to bass, if present)</p>
            <p><em>Omit for automatic voice leading in smooth modes</em></p>
          </div>
        </section>
      </div>
    </div>
  );
}
