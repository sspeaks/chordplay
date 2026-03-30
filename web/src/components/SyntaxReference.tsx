interface SyntaxReferenceProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROOTS = [
  { display: 'C', code: 'C' },
  { display: 'C♯', code: 'C#' },
  { display: 'D♭', code: 'Db' },
  { display: 'D', code: 'D' },
  { display: 'E♭', code: 'Eb' },
  { display: 'E', code: 'E' },
  { display: 'F', code: 'F' },
  { display: 'F♯', code: 'F#' },
  { display: 'G♭', code: 'Gb' },
  { display: 'G', code: 'G' },
  { display: 'A♭', code: 'Ab' },
  { display: 'A', code: 'A' },
  { display: 'B♭', code: 'Bb' },
  { display: 'B', code: 'B' },
];

const QUALITIES = [
  { display: 'Major', code: '' },
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
  { display: 'Dom 13', code: '13' },
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

        <section className="ninth-chords-section">
          <h3>9th Chords</h3>
          <p className="format-desc">
            9th chords have 5 notes but only 4 voices, so you must omit one note
            with <code>-1</code>, <code>-3</code>, <code>-5</code>, or <code>-7</code>.
          </p>
          <div className="quality-grid">
            <div className="quality-item">
              <span className="quality-display">Dom 9</span>
              <code className="quality-code">9-N</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">Maj 9</span>
              <code className="quality-code">maj9-N</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">Min 9</span>
              <code className="quality-code">m9-N</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">Add 9</span>
              <code className="quality-code">add9</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">Min Add 9</span>
              <code className="quality-code">madd9</code>
            </div>
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

        <section className="slash-section">
          <h3>Slash (Over) Chords</h3>
          <p className="format-desc">
            Add <code>/note</code> after any chord to specify the bass note.
            The bass is pinned to the lowest voice.
          </p>
          <div className="format-example">
            <span className="fmt-root">chord</span>
            <span className="fmt-quality">/bass</span>
          </div>
          <div className="quality-grid">
            <div className="quality-item">
              <span className="quality-display">C over E</span>
              <code className="quality-code">C/E</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">Am7 over G</span>
              <code className="quality-code">Am7/G</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">C over B♭</span>
              <code className="quality-code">C/Bb</code>
            </div>
          </div>
        </section>

        <section className="spelled-section">
          <h3>Spelled Chords</h3>
          <p className="format-desc">
            Enter 4 notes in parentheses to spell a chord directly.
            The chord type is identified automatically.
          </p>
          <div className="format-example">
            <span className="fmt-root">(Note Note Note Note)</span>
          </div>
          <div className="quality-grid">
            <div className="quality-item">
              <span className="quality-display">F dom7</span>
              <code className="quality-code">(F A C Eb)</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">C maj7</span>
              <code className="quality-code">(C E G B)</code>
            </div>
            <div className="quality-item">
              <span className="quality-display">D min7</span>
              <code className="quality-code">(D F A C)</code>
            </div>
          </div>
          <p className="format-desc">
            Notes are played in the order given (first = lowest pitch).
            Accidentals: <code>#</code> for sharp, <code>b</code> for flat.
          </p>
        </section>
      </div>
    </div>
  );
}
