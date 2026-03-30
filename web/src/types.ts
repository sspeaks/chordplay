// Chromatic pitch classes — matches Haskell's PitchClass enum order
export const PITCH_CLASSES = ['C','Cs','D','Ds','E','F','Fs','G','Gs','A','As','B'] as const;
export type PitchClass = typeof PITCH_CLASSES[number];

export const CHORD_TYPES = [
  'Major','Minor','Dom7','Maj7','Min7',
  'Dim','Dim7','Aug','HalfDim7',
  'Sus4','Sus2','MinMaj7','Maj6','Min6',
  'Dom9no1','Dom9no3','Dom9no5','Dom9no7',
  'Maj9no1','Maj9no3','Maj9no5','Maj9no7',
  'Min9no1','Min9no3','Min9no5','Min9no7',
  'Dom13',
] as const;
export type ChordType = typeof CHORD_TYPES[number];

export type SmoothMode = 'equal' | 'bass';

export interface Pitch {
  readonly pitchClass: PitchClass;
  readonly octave: number;
}

export interface ChordSymbol {
  readonly root: PitchClass;
  readonly quality: ChordType;
  readonly inversion: number | null;  // null = auto-voice in smooth mode
  readonly bass?: PitchClass;                // slash chord bass note (e.g., C/E → bass: 'E')
  readonly explicitVoicing?: PitchClass[];  // bypass voice leading, play these notes in order
  readonly warning?: boolean;               // true if notes didn't match any known chord type
}

export type Tuning = 'just' | 'equal';
export type PlayStyle = 'block' | 'arpeggio';
export type VoiceLeading = 'off' | 'smooth' | 'bass';

// Result type for parser
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// Voice part labels for visualization
export const VOICE_PARTS = ['Bass', 'Bari', 'Tenor', 'Lead'] as const;
export type VoicePart = typeof VOICE_PARTS[number];

export type NotationMode = 'standard' | 'roman';
export type KeyQuality = 'major' | 'minor';

export interface KeySignature {
  readonly root: PitchClass;
  readonly quality: KeyQuality;
}

export interface VoiceLeadingOptions {
  readonly gravityCenter?: number;   // MIDI note number (default: 60 = C4)
  readonly targetSpread?: number;    // semitones (default: 18 = 1.5 octaves)
}