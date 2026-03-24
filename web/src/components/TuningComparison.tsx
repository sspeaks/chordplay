import { Pitch, PitchClass } from '../types';
import { justFrequencies, equalFrequencies } from '../engine/musicTheory';

interface TuningComparisonProps {
  root: PitchClass | null;
  pitches: [Pitch, Pitch, Pitch, Pitch] | null;
  chordName: string;
}

const DISPLAY_NAMES: Record<PitchClass, string> = {
  C: 'C', Cs: 'C♯', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'F♯', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};

export default function TuningComparison({ root, pitches, chordName }: TuningComparisonProps) {
  if (!root || !pitches) return null;
  
  const justFreqs = justFrequencies(root, pitches);
  const equalFreqs = equalFrequencies(pitches);
  
  const noteData = pitches.map((pitch, idx) => {
    const justFreq = justFreqs[idx]!;
    const equalFreq = equalFreqs[idx]!;
    const cents = 1200 * Math.log2(equalFreq / justFreq);
    
    return {
      name: `${DISPLAY_NAMES[pitch.pitchClass]}${pitch.octave}`,
      justFreq,
      equalFreq,
      cents,
    };
  });
  
  return (
    <div className="tuning-comparison">
      <div className="tuning-header">
        <h3>Tuning Comparison: {chordName}</h3>
      </div>
      
      <div className="tuning-columns">
        <div className="tuning-col">
          <div className="tuning-col-label just">Just Intonation</div>
          {noteData.map((note, idx) => (
            <div key={idx} className="tuning-row">
              <span className="note-name">{note.name}</span>
              <span className="freq-value">{note.justFreq.toFixed(2)} Hz</span>
            </div>
          ))}
        </div>
        
        <div className="tuning-col">
          <div className="tuning-col-label equal">Equal Temperament</div>
          {noteData.map((note, idx) => (
            <div key={idx} className="tuning-row">
              <span className="freq-value">{note.equalFreq.toFixed(2)} Hz</span>
              <span className={`cents ${Math.abs(note.cents) < 0.5 ? 'cents-zero' : ''}`}>
                {note.cents >= 0 ? '+' : ''}{note.cents.toFixed(1)}¢
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
