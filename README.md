# ChordPlay

A browser-based tool for exploring barbershop quartet harmony. Enter chord sequences, hear them played with real-time Web Audio synthesis, and visualize four-part voicings with intelligent voice leading.

**No backend required** — everything runs client-side.

## What It Does

- **Enter chord sequences** using standard notation (`D A7 Bm G`) or Roman numerals (`I V7 vi IV`)
- **Play chords** with harmonic overtone synthesis tuned for barbershop
- **Compare tuning systems**: Just Intonation vs. Equal Temperament side-by-side
- **Visualize voicings**: See all 4 voices (Bass, Baritone, Tenor, Lead) with frequencies and intervals
- **Export to WAV**: Download rendered sequences as audio files
- **Navigate** with arrow keys or transport controls

## Quick Start

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

## Build & Test

```bash
npm run build          # tsc + vite production build → dist/
npm test               # vitest (189 tests across 9 files)
npm run test:watch     # vitest watch mode
npm run preview        # preview production build locally
```

A Nix flake is provided for reproducible environments:

```bash
nix develop            # drops you into a shell with Node.js + tooling
```

## Chord Syntax

| Element | Examples |
|---|---|
| **Roots** | `C D E F G A B` — sharps/flats: `C# Db F# Gb` |
| **Qualities** | Major (default), `m`, `7`, `maj7`, `m7`, `dim`, `dim7`, `aug`, `m7b5`, `sus4`, `sus2`, `mmaj7`, `6`, `m6`, `9` |
| **Inversions** | `1D` (1st inversion D), `2G7` (2nd inversion G7) |
| **Roman numerals** | `I IV V7 vi ii7 viidim` with key selector |

Example: `D A7 A9 D D7 Ab7 G6 Gm6 D F#7`

## How It Works

1. **Parser** validates chord input in real-time with color-coded error highlighting
2. **Voice leading optimizer** assigns notes to 4 voices, minimizing movement between chords via permutation search with a weighted cost function (gravity, spread, clustering)
3. **Audio engine** synthesizes each note as 8 harmonics with ADSR envelopes — harmonic 7 is boosted to reinforce the barbershop septimal 7th
4. **Play styles**: block (simultaneous) or arpeggio (80ms voice offset)

### Tuning

Just Intonation is the default — barbershop harmony relies on pure frequency ratios (5/4 for major thirds, 7/4 for dominant 7ths, etc.). Equal Temperament is available for comparison, with cent deviations shown.

## Project Structure

```
web/src/
├── App.tsx                    # Root component & state management
├── types.ts                   # PitchClass, ChordSymbol, Pitch, etc.
├── engine/                    # Pure TypeScript — no React dependencies
│   ├── musicTheory.ts         # Pitch/MIDI conversion, intervals, just intonation
│   ├── parser.ts              # Chord symbol parser
│   ├── voiceLeading.ts        # Smooth voice leading optimizer
│   ├── romanNumerals.ts       # Scale degree ↔ pitch class conversion
│   ├── romanParser.ts         # Roman numeral chord parser
│   ├── romanConverter.ts      # Standard ↔ Roman notation conversion
│   ├── audio.ts               # Web Audio API synthesis & ChordPlayer
│   ├── wav.ts                 # 16-bit PCM WAV encoding
│   └── formants.ts            # Formant filter analysis
├── components/                # React UI
│   ├── ChordInput.tsx         # Textarea with syntax highlighting overlay
│   ├── PlaybackControls.tsx   # Transport buttons, tempo slider
│   ├── NoteCards.tsx           # 4 voice visualization cards
│   ├── Toolbar.tsx            # Voice leading, play style, tuning toggles
│   ├── TuningComparison.tsx   # Just vs. Equal frequency table
│   └── SyntaxReference.tsx    # Collapsible chord syntax guide
├── research/                  # Experimental formant synthesis tools
└── styles/
    └── index.css              # Dark theme
```

The engine is intentionally decoupled from React — all music theory, parsing, and audio logic is pure TypeScript with comprehensive tests and no UI dependencies.

## Tech Stack

- **React** 18 + **TypeScript** (strict mode)
- **Vite** 6 (dev server & bundler)
- **Vitest** (test runner)
- **Web Audio API** (synthesis & playback)

## Deployment

Builds to static HTML/CSS/JS — deploy anywhere:

```bash
npm run build    # outputs to dist/
```

Upload `dist/` to GitHub Pages, Netlify, Vercel, etc. No server required.

## Origins

ChordPlay started as a Haskell CLI proof-of-concept that synthesized PCM audio piped to PulseAudio. The web frontend reimplements the same music theory model using TypeScript and the Web Audio API, and is where all active development happens.
