import { Pitch, PitchClass, Tuning, VOICE_PARTS } from '../types';
import { pitchToMidi, justFrequencies, equalFrequencies } from '../engine/musicTheory';

interface NoteCardsProps {
  pitches: [Pitch, Pitch, Pitch, Pitch] | null;
  root: PitchClass | null;
  tuning: Tuning;
}

const VOICE_COLORS = {
  Bass: '#2a9d8f',
  Bari: '#7a5fca',
  Tenor: '#4a6fa5',
  Lead: '#e07a5f',
};

const DISPLAY_NAMES: Record<PitchClass, string> = {
  C: 'C', Cs: 'C♯', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'F♯', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};

const INTERVAL_NAMES = [
  'Unison', 'Min 2nd', 'Maj 2nd', 'Min 3rd', 'Maj 3rd', 'P 4th',
  'Tritone', 'P 5th', 'Min 6th', 'Maj 6th', 'Min 7th', 'Maj 7th',
];

const JUST_RATIOS = [
  '1/1', '16/15', '9/8', '6/5', '5/4', '4/3',
  '45/32', '3/2', '8/5', '5/3', '9/5', '15/8',
];

export default function NoteCards({ pitches, root, tuning }: NoteCardsProps) {
  if (!pitches || !root) {
    return (
      <div className="note-cards">
        {VOICE_PARTS.map(voice => (
          <div key={voice} className="note-card" style={{ borderColor: VOICE_COLORS[voice] }}>
            <div className="note-name" style={{ color: VOICE_COLORS[voice] }}>—</div>
            <div className="voice-part">{voice}</div>
            <div className="note-freq">—</div>
            <div className="note-interval">—</div>
          </div>
        ))}
      </div>
    );
  }
  
  const rootMidi = pitchToMidi({ pitchClass: root, octave: 4 });
  const frequencies = tuning === 'just' 
    ? justFrequencies(root, pitches)
    : equalFrequencies(pitches);
  
  return (
    <div className="note-cards">
      {pitches.map((pitch, idx) => {
        const voice = VOICE_PARTS[idx]!;
        const midi = pitchToMidi(pitch);
        const freq = frequencies[idx]!;
        const interval = (midi - rootMidi + 1200) % 12;
        const intervalName = INTERVAL_NAMES[interval];
        const ratio = JUST_RATIOS[interval];
        
        return (
          <div key={voice} className="note-card" style={{ borderColor: VOICE_COLORS[voice] }}>
            <div className="note-name" style={{ color: VOICE_COLORS[voice] }}>
              {DISPLAY_NAMES[pitch.pitchClass]}{pitch.octave}
            </div>
            <div className="voice-part">{voice}</div>
            <div className="note-freq">{freq.toFixed(2)} Hz</div>
            <div className="note-interval">{intervalName} · {ratio}</div>
          </div>
        );
      })}
    </div>
  );
}
