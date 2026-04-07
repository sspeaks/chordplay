# ChordPlay iPad — Design Specification

## Overview

ChordPlay iPad is a native Swift/SwiftUI iPad application that overlays interactive chord annotations on imported sheet music PDFs. Users write chord names with Apple Pencil above the staff; the app recognizes the handwriting, displays tappable chord badges, and plays the chords using 4-part barbershop-style voicings with smooth voice leading and equal temperament tuning.

**Goal:** Personal tool first, App Store eventually.
**Platform:** iPad only, native Swift/SwiftUI.
**Stretch goal:** Optical Music Recognition (auto-detect chords from notation) — out of scope for v1.

## Architecture

### View Layer (SwiftUI)

Three layers stacked on screen, plus a transport bar:

1. **PDFPageView** — Uses PDFKit to render the imported sheet music. Provides zoom, scroll, and page navigation out of the box.

2. **PencilCanvas** — A transparent PencilKit (`PKCanvasView`) overlay positioned on top of the PDF. Captures Apple Pencil strokes. Synchronized with the PDF view's scroll/zoom transform so ink stays aligned with the sheet music.

3. **ChordBadgeLayer** — Displays recognized chord symbols as tappable badges positioned above the corresponding ink. Badges highlight during playback. Long-press opens an edit popover. Badges for low-confidence or unrecognized chords show a visual indicator.

4. **TransportBar** — Fixed at the bottom of the screen. Contains play/stop, skip forward/back, tempo (BPM) control, and a chord position indicator ("Chord 3 / 12").

### Engine Layer (Pure Swift, No UI Dependencies)

All music logic is pure Swift with no UIKit/SwiftUI imports, enabling comprehensive unit testing:

- **HandwritingRecognizer** — Wraps Apple's Vision framework (`VNRecognizeTextRequest`). Receives grouped strokes rendered as an image, returns candidate strings with confidence scores.

- **ChordParser** — Port of the web app's `parser.ts`. Parses chord symbol strings ("Am7", "D7", "Gmaj7") into structured `ChordSymbol` values (root, quality, optional bass note). Supports the same syntax as the web app: roots with sharps/flats, major/minor/dominant/diminished/augmented/suspended qualities, inversions, slash chords.

- **VoiceLeadingOptimizer** — Port of the web app's `voiceLeading.ts`. Assigns chord tones to 4 voices (Bass, Baritone, Tenor, Lead) using a weighted cost function that minimizes movement between consecutive chords. Produces tight close-harmony voicings in barbershop style.

- **AudioSynthesizer** — Uses `AVAudioEngine` with `AVAudioSourceNode` for real-time sample generation. Each voice is synthesized as a sum of 8 harmonics with decreasing amplitude. Harmonic 7 is boosted for barbershop character. ADSR envelopes (attack 20ms, decay 50ms, sustain 0.7, release 200ms). Equal temperament tuning.

- **AnnotationStore** — SwiftData persistence layer mapping PDFs to their chord annotations.

### Data Flow

```
Pencil stroke → (0.8s debounce) → Stroke grouping → Vision OCR →
  Candidate strings → ChordParser (try each) → first successful parse →
    ChordBadge displayed → user taps → VoiceLeadingOptimizer →
      AudioSynthesizer → speaker output
```

## Pencil → Chord Recognition Pipeline

### Step 1: Stroke Capture

PencilKit captures strokes as `PKStroke` objects with timing, pressure, and position data. Ink renders immediately — the user sees their handwriting in real time.

### Step 2: Stroke Grouping (Debounced)

After a **0.8-second pause** in writing, nearby strokes are grouped into a "chord region" based on spatial proximity. This handles multi-stroke characters (writing "7" after "Am") and gives the user time to finish before recognition fires.

### Step 3: Vision Handwriting Recognition

The stroke region is rendered to a `CGImage` and passed to `VNRecognizeTextRequest`. Vision returns multiple candidate strings with confidence scores (typically 3-10 candidates).

### Step 4: Parser-Validated Selection

Each Vision candidate is fed through `ChordParser`. The first candidate that parses successfully is accepted. This is the key insight: Vision doesn't need to perfectly read music notation — it just needs to produce a candidate that looks enough like a chord symbol for the parser to accept.

Example:
- "Am7" (0.92 confidence) → parser succeeds ✓ — **accepted**
- "Arn7" (0.71) → parser fails ✗
- "Amy" (0.65) → parser fails ✗

### Step 5: Badge or Correction

**Recognized:** A chord badge appears above the ink. The original handwriting fades to subtle gray. The badge is tappable for playback.

**Unrecognized (no parseable candidate):** Ink stays orange. Tapping opens a correction popover showing:
- Top Vision candidates for reference
- Fuzzy chord suggestions based on edit distance against known chord symbols (e.g., "Arn7" → suggests "Am7", "A7", "Amaj7")
- A text field for manual chord entry

**Low confidence (best accepted candidate < 0.5):** Badge appears with a "?" indicator inviting the user to confirm or correct.

### Handling Tricky Notation

- **Sharps & Flats:** Users write "F#" or "Bb". If Vision misreads these, the correction popover suggests close matches ("Did you mean F#? F#m? F#7?").
- **Symbols (°, ø, △):** Users can write text equivalents ("dim" instead of "°", "m7b5" instead of "ø"). The parser accepts both.
- **Scribble-to-Delete:** PencilKit supports this natively. Scribbling over a chord erases it and its badge.

## Audio Synthesis & Playback

### Synthesis

Identical approach to the web app, ported to `AVAudioEngine`:

- 4 voices, each synthesized as additive sine waves (8 harmonics)
- Harmonic amplitudes decrease as 1/n, with harmonic 7 boosted
- ADSR envelope per voice: attack 20ms, decay 50ms, sustain 0.7, release 200ms
- Equal temperament tuning (12-TET, A4 = 440 Hz)

### Playback Modes

**Tap-to-Play:** Tap any chord badge to hear it immediately. The chord sustains while the finger is down and releases on lift. Useful for studying individual chords.

**Sequential Playback:** Press Play in the transport bar. Chords advance automatically at the set tempo (BPM). Voice leading smooths transitions between consecutive chords. The active chord badge highlights and the view auto-scrolls to keep it visible. Skip forward/back buttons jump to the next/previous chord.

### Transport Bar

Fixed at the bottom of the screen:
- Play/Stop toggle
- Skip forward/back
- Tempo control (BPM, adjustable via slider or direct input)
- Chord position indicator ("Chord 3 / 12")

## Data Model

### SwiftData Entities

**SheetMusicDocument**
- `id`: UUID
- `title`: String (user-editable display name)
- `pdfData`: Data (imported PDF bytes — stored directly, no external file references)
- `pageCount`: Int
- `createdAt`: Date
- `updatedAt`: Date
- `pages`: [PageAnnotation] (one-to-many)

**PageAnnotation**
- `id`: UUID
- `pageIndex`: Int (which PDF page, 0-based)
- `inkData`: Data (PKDrawing serialized — PencilKit provides native Data encoding)
- `chords`: [ChordAnnotation] (one-to-many)

**ChordAnnotation**
- `id`: UUID
- `chordText`: String ("Am7", "D7", etc.)
- `position`: CGPoint (normalized 0..1 on the page — survives zoom/resize)
- `sequenceIndex`: Int (playback order; auto-assigned by spatial position left→right, top→bottom; user can reorder)
- `confidence`: Float (Vision recognition confidence of the accepted candidate)
- `isConfirmed`: Bool (user explicitly validated this chord)
- `strokeIDs`: [UUID] (links to PencilKit strokes — enables scribble-to-delete)

### Key Design Decisions

- PDF bytes stored in SwiftData — no external file references that could break.
- Positions normalized to 0..1 — survive zoom and device rotation.
- `sequenceIndex` determines playback order, auto-assigned by reading order (left-to-right, top-to-bottom) but user-reorderable.
- PencilKit ink stored per-page as serialized `PKDrawing`.
- `strokeIDs` link chord badges to specific PencilKit strokes, enabling scribble-to-delete.

## App Flow

**Library Screen:** A grid of imported sheet music documents. Each shows a thumbnail, title, and chord count. An "Import" button opens a document picker (Files app). Tapping a document opens it in the Sheet View.

**Sheet View:** The main workspace. PDF renders full-screen with the PencilKit overlay and chord badges. The transport bar sits at the bottom. Page navigation via swipe or page indicator. The toolbar provides undo/redo and an eraser toggle.

**Correction Popover:** Appears when tapping an unrecognized chord region or long-pressing an existing badge. Shows Vision candidates, fuzzy chord suggestions, and a text field for manual entry.

## Error Handling

**Handwriting recognition failures:** No parseable candidate → ink stays orange with tap-to-correct. Low confidence → badge with "?" indicator. Ambiguous results → accept top match, long-press to see alternatives.

**PDF handling:** Corrupt/unreadable PDF → error alert at import, not added to library. Very large PDFs → lazy page loading, only render visible pages. Both landscape and portrait orientations supported.

**Audio edge cases:** First/single chord with no voice-leading context → default close voicing in middle register. Very fast tempo → chords crossfade rather than hard-cut. App backgrounding → stop audio immediately (no background audio entitlement).

**Data safety:** SwiftData auto-saves, so annotations survive crashes. PencilKit provides built-in undo/redo for strokes and corrections.

## Testing Strategy

**Engine unit tests (XCTest):** Port the web app's 189 tests to Swift. Covers chord parser, voice leading optimizer, music theory (pitch/interval math), and audio math (frequency calculation, ADSR). These are the highest-value, easiest-to-write tests.

**Recognition pipeline tests:** Unit test the "try candidates through parser" logic with mock Vision outputs. Test stroke grouping with known spatial inputs.

**UI tests:** Manual testing on iPad for PencilKit interactions (difficult to automate). XCUITest for Library → Sheet View navigation and transport controls.

## Scope Summary

### In Scope (v1)
- PDF import from Files app
- Apple Pencil chord writing with Vision recognition
- Parser-validated handwriting → chord badges
- Correction flow for unrecognized chords
- Tap-to-play individual chords
- Sequential playback with tempo control
- 4-part barbershop voicings with voice leading
- Equal temperament tuning
- SwiftData persistence of annotations
- Library screen with document management

### Out of Scope (v1)
- Optical Music Recognition (auto-detect chords from notation)
- iPhone support
- Camera-based PDF scanning (can add later via VisionKit)
- Export/share annotations
- iCloud sync
- Multiple tuning systems (just intonation, etc.)
- Roman numeral input mode
