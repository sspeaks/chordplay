import { Pitch, PitchClass, Tuning, PITCH_CLASSES } from '../types';
import { pitchToMidi, justFrequencies, equalFrequencies, hasMinorQuality, justRatioLabel } from '../engine/musicTheory';

interface NoteCardsProps {
  pitches: [Pitch, Pitch, Pitch, Pitch] | null;
  root: PitchClass | null;
  tuning: Tuning;
}

const VOICE_COLORS = ['#2a9d8f', '#7a5fca', '#4a6fa5', '#e07a5f'];

const DISPLAY_NAMES: Record<PitchClass, string> = {
  C: 'C', Cs: 'C♯', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'F♯', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};

const INTERVAL_NAMES = [
  'Unison', 'Min 2nd', 'Maj 2nd', 'Min 3rd', 'Maj 3rd', 'P 4th',
  'Tritone', 'P 5th', 'Min 6th', 'Maj 6th', 'Min 7th', 'Maj 7th',
];

export default function NoteCards({ pitches, root, tuning }: NoteCardsProps) {
  if (!pitches || !root) {
    return (
      <div className="note-cards empty">
        <p>Enter chords and press Play to see voicing details</p>
      </div>
    );
  }
  
  const rootMidi = pitchToMidi({ pitchClass: root, octave: 4 });
  const midis = pitches.map(pitchToMidi);
  const bassMidi = Math.min(...midis);
  const rootPc = PITCH_CLASSES.indexOf(root);
  const rootMidiAbs = bassMidi - (((bassMidi - rootPc) % 12) + 12) % 12;
  const chordIntervals = midis.map(m => m - rootMidiAbs);
  const useClassical = hasMinorQuality(chordIntervals);
  const frequencies = tuning === 'just' 
    ? justFrequencies(root, pitches)
    : equalFrequencies(pitches);
  
  return (
    <div className="note-cards">
      {pitches.map((pitch, idx) => {
        const color = VOICE_COLORS[idx % VOICE_COLORS.length]!;
        const midi = pitchToMidi(pitch);
        const freq = frequencies[idx]!;
        const interval = (midi - rootMidi + 1200) % 12;
        const intervalName = INTERVAL_NAMES[interval];
        const ratio = justRatioLabel(interval, useClassical);
        
        return (
          <div key={idx} className="note-card" style={{ borderColor: color }}>
            <div className="note-name" style={{ color }}>
              {DISPLAY_NAMES[pitch.pitchClass]}{pitch.octave}
            </div>
            <div className="note-freq">{freq.toFixed(2)} Hz</div>
            <div className="note-interval">{intervalName} · {ratio}</div>
          </div>
        );
      })}
    </div>
  );
}
