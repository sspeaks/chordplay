# ChordPlay iPad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native Swift/SwiftUI iPad app that overlays interactive chord annotations on imported sheet music PDFs — users write chord names with Apple Pencil, the app recognizes handwriting and plays 4-part barbershop voicings.

**Architecture:** Three-layer view (PDFKit rendering → PencilKit ink overlay → chord badge layer) backed by a pure-Swift music engine (parser, voice leading, audio synthesis) ported from the existing TypeScript web app. Handwriting recognition via Apple's Vision framework with parser-as-validator. SwiftData for persistence.

**Tech Stack:** Swift 5.10+, SwiftUI, PDFKit, PencilKit, Vision, AVAudioEngine, SwiftData, XCTest. iPad-only. Minimum deployment target: iPadOS 17.0.

**Design Spec:** `docs/superpowers/specs/2026-04-07-chordplay-ipad-design.md` (in this same repo)

**Existing TypeScript Engine (reference):** The web app in `web/src/engine/` contains the music theory implementation being ported. Key files: `types.ts`, `parser.ts`, `musicTheory.ts`, `voiceLeading.ts`, `audio.ts`. The web app has 189 tests across these files.

---

## Context for the Implementing Agent

You are building a **new Xcode project from scratch** — there is no existing Swift code. The music engine is a port of the TypeScript engine in `web/src/engine/`. The web app's test suite serves as a porting checklist.

**Key domain knowledge:**
- **Pitch classes:** 12 chromatic notes: C, C♯, D, D♯, E, F, F♯, G, G♯, A, A♯, B. Internally stored as `C, Cs, D, Ds, E, F, Fs, G, Gs, A, As, B`.
- **MIDI:** Middle C (C4) = MIDI 60. Formula: `(octave + 1) * 12 + pitchClassIndex`
- **Equal temperament:** `frequency = 440.0 * pow(2.0, (midi - 69.0) / 12.0)` where A4 = MIDI 69 = 440 Hz
- **4-part voicing:** Bass, Baritone, Tenor, Lead — always 4 voices, close harmony
- **Voice leading:** Minimize total voice movement between consecutive chords using a cost function that penalizes large jumps, chromatic clusters, unisons, and deviations from target spread/gravity
- **9th chords:** Have 5 notes but only 4 voices, so the parser requires specifying which note to omit (e.g., `C9-5` = dominant 9th omitting the 5th)

**Build & test commands (in Xcode):**
```bash
# From the Xcode project directory:
xcodebuild -scheme ChordPlayiPad -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)' build
xcodebuild -scheme ChordPlayiPad -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)' test
# Or use Cmd+B (build) and Cmd+U (test) in Xcode
```

---

## File Structure

```
ChordPlayiPad/
├── ChordPlayiPadApp.swift                  # App entry point + SwiftData container
├── Engine/                                  # Pure Swift — NO UIKit/SwiftUI imports
│   ├── Types.swift                          # PitchClass, ChordType, Pitch, ChordSymbol, ParseResult
│   ├── MusicTheory.swift                    # Pitch↔MIDI, frequencies, intervals, chord voicing
│   ├── ChordParser.swift                    # Chord string → ChordSymbol parsing
│   ├── VoiceLeading.swift                   # Smooth voice leading optimizer
│   └── AudioSynthesizer.swift               # AVAudioEngine real-time synthesis
├── Recognition/                             # Handwriting → chord pipeline
│   ├── StrokeGrouper.swift                  # Group PencilKit strokes by proximity + debounce
│   └── HandwritingRecognizer.swift          # Vision OCR + parser validation
├── Models/                                  # SwiftData persistence
│   ├── SheetMusicDocument.swift
│   ├── PageAnnotation.swift
│   └── ChordAnnotation.swift
├── ViewModels/                              # State management
│   ├── LibraryViewModel.swift               # Document list state
│   ├── SheetViewModel.swift                 # Sheet view orchestration
│   └── PlaybackManager.swift                # Audio playback state machine
├── Views/                                   # SwiftUI views
│   ├── LibraryView.swift                    # Document grid + import
│   ├── SheetView.swift                      # Main workspace compositor
│   ├── PDFPageView.swift                    # UIViewRepresentable for PDFKit
│   ├── PencilCanvasView.swift               # UIViewRepresentable for PencilKit
│   ├── ChordBadgeOverlay.swift              # Positioned chord badges
│   ├── TransportBar.swift                   # Playback controls
│   └── CorrectionPopover.swift              # Chord correction UI
└── ChordPlayiPadTests/                      # XCTest target
    ├── TypesTests.swift
    ├── MusicTheoryTests.swift
    ├── ChordParserTests.swift
    ├── VoiceLeadingTests.swift
    ├── AudioSynthesizerTests.swift
    ├── StrokeGrouperTests.swift
    └── HandwritingRecognizerTests.swift
```

**Design principle:** The `Engine/` directory has ZERO UI imports. Every file in Engine/ uses only Foundation. This enables fast, reliable unit testing.

---

## Task 1: Create Xcode Project

**Files:**
- Create: Xcode project `ChordPlayiPad` with all directories above

- [ ] **Step 1: Create the Xcode project**

Open Xcode → File → New → Project → App
- Product Name: `ChordPlayiPad`
- Team: (your personal team)
- Organization Identifier: `com.chordplay`
- Interface: SwiftUI
- Language: Swift
- Storage: SwiftData
- Uncheck "Include Tests" (we'll add manually for control)
- Set deployment target: iPadOS 17.0
- Under General → Supported Destinations: remove iPhone, keep iPad only

- [ ] **Step 2: Create directory structure**

In Xcode, create groups (folders) matching the file structure above:
```
Engine/
Recognition/
Models/
ViewModels/
Views/
```

- [ ] **Step 3: Add test target**

File → New → Target → Unit Testing Bundle
- Product Name: `ChordPlayiPadTests`
- Target to be Tested: `ChordPlayiPad`
- Delete the auto-generated test file

- [ ] **Step 4: Verify build**

Press Cmd+B. Expect: Build Succeeded.

- [ ] **Step 5: Initial commit**

```bash
cd ChordPlayiPad
git init
echo '.DS_Store\n*.xcuserdata\nDerivedData/' > .gitignore
git add .
git commit -m "chore: initial Xcode project setup for ChordPlay iPad"
```

---

## Task 2: Core Types (Types.swift)

**Files:**
- Create: `Engine/Types.swift`
- Test: `ChordPlayiPadTests/TypesTests.swift`

- [ ] **Step 1: Write TypesTests.swift**

```swift
import Testing
@testable import ChordPlayiPad

struct TypesTests {
    // MARK: - PitchClass

    @Test func pitchClassAllCasesHas12() {
        #expect(PitchClass.allCases.count == 12)
    }

    @Test func pitchClassRawValues() {
        #expect(PitchClass.c.rawValue == 0)
        #expect(PitchClass.cs.rawValue == 1)
        #expect(PitchClass.b.rawValue == 11)
    }

    @Test func pitchClassFromIntWraps() {
        #expect(PitchClass.fromInt(0) == .c)
        #expect(PitchClass.fromInt(11) == .b)
        #expect(PitchClass.fromInt(12) == .c)
        #expect(PitchClass.fromInt(-1) == .b)
    }

    // MARK: - ChordType

    @Test func chordTypeAllCasesHas27() {
        #expect(ChordType.allCases.count == 27)
    }

    // MARK: - Pitch

    @Test func pitchToMidi() {
        #expect(Pitch(pitchClass: .a, octave: 4).midi == 69)
        #expect(Pitch(pitchClass: .c, octave: 4).midi == 60)
        #expect(Pitch(pitchClass: .c, octave: 3).midi == 48)
    }

    @Test func midiToPitch() {
        let p = Pitch(midi: 69)
        #expect(p.pitchClass == .a)
        #expect(p.octave == 4)

        let c4 = Pitch(midi: 60)
        #expect(c4.pitchClass == .c)
        #expect(c4.octave == 4)
    }

    // MARK: - ParseResult

    @Test func parseResultSuccess() {
        let r: ParseResult<Int> = .ok(42)
        if case .ok(let v) = r {
            #expect(v == 42)
        } else {
            Issue.record("Expected .ok")
        }
    }

    @Test func parseResultFailure() {
        let r: ParseResult<Int> = .error("bad")
        if case .error(let msg) = r {
            #expect(msg == "bad")
        } else {
            Issue.record("Expected .error")
        }
    }
}
```

- [ ] **Step 2: Run tests — expect compile error (Types not defined yet)**

Run: Cmd+U
Expected: Compile error — `PitchClass`, `Pitch`, etc. not found

- [ ] **Step 3: Implement Types.swift**

```swift
import Foundation

// MARK: - PitchClass

enum PitchClass: Int, CaseIterable, Codable, Hashable, Sendable {
    case c = 0, cs, d, ds, e, f, fs, g, gs, a, as_, b

    static func fromInt(_ n: Int) -> PitchClass {
        let mod = ((n % 12) + 12) % 12
        return PitchClass(rawValue: mod)!
    }
}

// MARK: - ChordType

enum ChordType: String, CaseIterable, Codable, Hashable, Sendable {
    case major, minor, dom7, maj7, min7
    case dim, dim7, aug, halfDim7
    case sus4, sus2, minMaj7, maj6, min6
    case dom9no1, dom9no3, dom9no5, dom9no7
    case maj9no1, maj9no3, maj9no5, maj9no7
    case min9no1, min9no3, min9no5, min9no7
    case dom13
}

// MARK: - Pitch

struct Pitch: Equatable, Hashable, Sendable {
    let pitchClass: PitchClass
    let octave: Int

    var midi: Int {
        (octave + 1) * 12 + pitchClass.rawValue
    }

    init(pitchClass: PitchClass, octave: Int) {
        self.pitchClass = pitchClass
        self.octave = octave
    }

    init(midi: Int) {
        self.pitchClass = PitchClass.fromInt(midi)
        self.octave = midi / 12 - 1
    }
}

// MARK: - ChordSymbol

struct ChordSymbol: Equatable, Sendable {
    let root: PitchClass
    let quality: ChordType
    let inversion: Int?
    let bass: PitchClass?
    let explicitVoicing: [PitchClass]?
    let warning: Bool

    init(
        root: PitchClass,
        quality: ChordType,
        inversion: Int? = nil,
        bass: PitchClass? = nil,
        explicitVoicing: [PitchClass]? = nil,
        warning: Bool = false
    ) {
        self.root = root
        self.quality = quality
        self.inversion = inversion
        self.bass = bass
        self.explicitVoicing = explicitVoicing
        self.warning = warning
    }
}

// MARK: - ParseResult

enum ParseResult<T> {
    case ok(T)
    case error(String)

    var isOk: Bool {
        if case .ok = self { return true }
        return false
    }

    var value: T? {
        if case .ok(let v) = self { return v }
        return nil
    }

    var errorMessage: String? {
        if case .error(let msg) = self { return msg }
        return nil
    }
}

// MARK: - Voice Leading Options

struct VoiceLeadingOptions: Sendable {
    let gravityCenter: Int
    let targetSpread: Int

    init(gravityCenter: Int = 57, targetSpread: Int = 12) {
        self.gravityCenter = gravityCenter
        self.targetSpread = targetSpread
    }
}

// MARK: - Enums for configuration

enum SmoothMode: String, Sendable {
    case equal
    case bass
}

enum PlayStyle: String, Sendable {
    case block
    case arpeggio
}
```

- [ ] **Step 4: Run tests — expect all pass**

Run: Cmd+U
Expected: All TypesTests pass

- [ ] **Step 5: Commit**

```bash
git add Engine/Types.swift ChordPlayiPadTests/TypesTests.swift
git commit -m "feat: add core types — PitchClass, ChordType, Pitch, ChordSymbol, ParseResult"
```

---

## Task 3: Music Theory — Pitch Conversion & Intervals (MusicTheory.swift)

**Files:**
- Create: `Engine/MusicTheory.swift`
- Test: `ChordPlayiPadTests/MusicTheoryTests.swift`

This is the largest engine file. It ports `musicTheory.ts` — pitch/MIDI conversion, chord intervals, frequency calculation, and display helpers.

- [ ] **Step 1: Write MusicTheoryTests.swift**

```swift
import Testing
@testable import ChordPlayiPad

struct MusicTheoryTests {
    // MARK: - Pitch frequency

    @Test func a4Is440Hz() {
        let freq = pitchFrequency(Pitch(pitchClass: .a, octave: 4))
        #expect(abs(freq - 440.0) < 1.0)
    }

    @Test func a5Is880Hz() {
        let freq = pitchFrequency(Pitch(pitchClass: .a, octave: 5))
        #expect(abs(freq - 880.0) < 1.0)
    }

    // MARK: - Chord intervals

    @Test func majorIntervals() {
        #expect(chordIntervals(.major) == [0, 4, 7, 12])
    }

    @Test func dom7Intervals() {
        #expect(chordIntervals(.dom7) == [0, 4, 7, 10])
    }

    @Test func min7Intervals() {
        #expect(chordIntervals(.min7) == [0, 3, 7, 10])
    }

    @Test func dim7Intervals() {
        #expect(chordIntervals(.dim7) == [0, 3, 6, 9])
    }

    @Test func halfDim7Intervals() {
        #expect(chordIntervals(.halfDim7) == [0, 3, 6, 10])
    }

    @Test func dom9Variants() {
        #expect(chordIntervals(.dom9no1) == [4, 7, 10, 14])
        #expect(chordIntervals(.dom9no3) == [0, 7, 10, 14])
        #expect(chordIntervals(.dom9no5) == [0, 4, 10, 14])
        #expect(chordIntervals(.dom9no7) == [0, 4, 7, 14])
    }

    @Test func maj9Variants() {
        #expect(chordIntervals(.maj9no1) == [4, 7, 11, 14])
        #expect(chordIntervals(.maj9no3) == [0, 7, 11, 14])
        #expect(chordIntervals(.maj9no5) == [0, 4, 11, 14])
        #expect(chordIntervals(.maj9no7) == [0, 4, 7, 14])
    }

    @Test func min9Variants() {
        #expect(chordIntervals(.min9no1) == [3, 7, 10, 14])
        #expect(chordIntervals(.min9no3) == [0, 7, 10, 14])
        #expect(chordIntervals(.min9no5) == [0, 3, 10, 14])
        #expect(chordIntervals(.min9no7) == [0, 3, 7, 14])
    }

    @Test func dom13WaescheVoicing() {
        #expect(chordIntervals(.dom13) == [0, 10, 16, 21])
    }

    // MARK: - chordPitchClasses

    @Test func cMajorPitchClasses() {
        #expect(chordPitchClasses(root: .c, quality: .major) == [.c, .e, .g, .c])
    }

    @Test func dDom7PitchClasses() {
        #expect(chordPitchClasses(root: .d, quality: .dom7) == [.d, .fs, .a, .c])
    }

    @Test func cDom13PitchClasses() {
        #expect(chordPitchClasses(root: .c, quality: .dom13) == [.c, .as_, .e, .a])
    }

    @Test func asDom13PitchClasses() {
        #expect(chordPitchClasses(root: .as_, quality: .dom13) == [.as_, .gs, .d, .g])
    }

    // MARK: - voiceChord

    @Test func cMajorRootPositionHas4Notes() {
        let pitches = voiceChord(root: .c, quality: .major, inversion: 0)
        #expect(pitches.count == 4)
    }

    @Test func cMajorRootStartsOnC3() {
        let pitches = voiceChord(root: .c, quality: .major, inversion: 0)
        #expect(pitches[0].pitchClass == .c)
        #expect(pitches[0].octave == 3)
    }

    @Test func inversionClampedAt3() {
        let inv3 = voiceChord(root: .c, quality: .major, inversion: 3)
        let inv4 = voiceChord(root: .c, quality: .major, inversion: 4)
        #expect(inv3 == inv4)
    }

    @Test func firstInversionRotatesUp() {
        let root = voiceChord(root: .c, quality: .major, inversion: 0)
        let first = voiceChord(root: .c, quality: .major, inversion: 1)
        #expect(first[0].midi > root[0].midi)
    }

    // MARK: - nearestPitch

    @Test func nearestCToMidi61IsC4() {
        let p = nearestPitch(pitchClass: .c, targetMidi: 61)
        #expect(p.midi == 60)
    }

    @Test func tiesGoLow() {
        let p = nearestPitch(pitchClass: .c, targetMidi: 66)
        #expect(p.midi == 60) // equidistant between 60 and 72, prefer low
    }

    // MARK: - equalFrequencies

    @Test func equalFreqA4() {
        let freqs = equalFrequencies([Pitch(pitchClass: .a, octave: 4)])
        #expect(abs(freqs[0] - 440.0) < 1.0)
    }

    // MARK: - nearestPitch (from midiToPitch)

    @Test func midi69IsA4() {
        let p = Pitch(midi: 69)
        #expect(p.pitchClass == .a)
        #expect(p.octave == 4)
    }

    @Test func midi60IsC4() {
        let p = Pitch(midi: 60)
        #expect(p.pitchClass == .c)
        #expect(p.octave == 4)
    }

    // MARK: - slashChordPitchClasses

    @Test func slashBassIsChordTone() {
        // C/E → bass E, root doubled in upper
        let pcs = slashChordPitchClasses(root: .c, quality: .major, bass: .e)
        #expect(pcs[0] == .e)
        #expect(pcs.count == 4)
    }

    @Test func slashBassNotChordToneTriad() {
        // C/Bb → Bb bass, full triad above
        let pcs = slashChordPitchClasses(root: .c, quality: .major, bass: .as_)
        #expect(pcs[0] == .as_)
        #expect(pcs.count == 4)
    }

    @Test func slashBassNotChordTone4Note() {
        // C7/A → omits P5
        let pcs = slashChordPitchClasses(root: .c, quality: .dom7, bass: .a)
        #expect(pcs[0] == .a)
        #expect(pcs.count == 4)
    }

    @Test func slashBassIsRoot() {
        // C/C → root position
        let pcs = slashChordPitchClasses(root: .c, quality: .major, bass: .c)
        #expect(pcs[0] == .c)
        #expect(pcs.count == 4)
    }
}
```

- [ ] **Step 2: Run tests — expect compile error**

Run: Cmd+U
Expected: Functions `pitchFrequency`, `chordIntervals`, etc. not found

- [ ] **Step 3: Implement MusicTheory.swift**

```swift
import Foundation

// MARK: - Intervals lookup

private let intervals: [ChordType: [Int]] = [
    .major:    [0, 4, 7, 12],
    .minor:    [0, 3, 7, 12],
    .dom7:     [0, 4, 7, 10],
    .maj7:     [0, 4, 7, 11],
    .min7:     [0, 3, 7, 10],
    .dim:      [0, 3, 6, 12],
    .dim7:     [0, 3, 6, 9],
    .aug:      [0, 4, 8, 12],
    .halfDim7: [0, 3, 6, 10],
    .sus4:     [0, 5, 7, 12],
    .sus2:     [0, 2, 7, 12],
    .minMaj7:  [0, 3, 7, 11],
    .maj6:     [0, 4, 7, 9],
    .min6:     [0, 3, 7, 9],
    .dom9no1:  [4, 7, 10, 14],
    .dom9no3:  [0, 7, 10, 14],
    .dom9no5:  [0, 4, 10, 14],
    .dom9no7:  [0, 4, 7, 14],
    .maj9no1:  [4, 7, 11, 14],
    .maj9no3:  [0, 7, 11, 14],
    .maj9no5:  [0, 4, 11, 14],
    .maj9no7:  [0, 4, 7, 14],
    .min9no1:  [3, 7, 10, 14],
    .min9no3:  [0, 7, 10, 14],
    .min9no5:  [0, 3, 10, 14],
    .min9no7:  [0, 3, 7, 14],
    .dom13:    [0, 10, 16, 21],
]

// MARK: - Public functions

func pitchFrequency(_ pitch: Pitch) -> Double {
    440.0 * pow(2.0, Double(pitch.midi - 69) / 12.0)
}

func chordIntervals(_ chordType: ChordType) -> [Int] {
    intervals[chordType]!
}

func chordPitchClasses(root: PitchClass, quality: ChordType) -> [PitchClass] {
    chordIntervals(quality).map { interval in
        PitchClass.fromInt(root.rawValue + interval)
    }
}

func nearestPitch(pitchClass pc: PitchClass, targetMidi: Int) -> Pitch {
    let pcInt = pc.rawValue
    let octLow = Int(floor(Double(targetMidi - pcInt) / 12.0)) - 1
    let octHigh = octLow + 1

    let midiLow = (octLow + 1) * 12 + pcInt
    let midiHigh = (octHigh + 1) * 12 + pcInt

    let distLow = abs(midiLow - targetMidi)
    let distHigh = abs(midiHigh - targetMidi)

    if distLow <= distHigh {
        return Pitch(pitchClass: pc, octave: octLow)
    } else {
        return Pitch(pitchClass: pc, octave: octHigh)
    }
}

func voiceChord(root: PitchClass, quality: ChordType, inversion: Int) -> [Pitch] {
    let ivs = chordIntervals(quality)
    let rootInt = root.rawValue
    let startOctave = 3 // C3 base

    var pitches = ivs.map { interval -> Pitch in
        let midi = (startOctave + 1) * 12 + rootInt + interval
        return Pitch(midi: midi)
    }

    let clampedInv = max(-3, min(3, inversion))

    if clampedInv > 0 {
        for _ in 0..<clampedInv {
            var p = pitches.removeFirst()
            p = Pitch(pitchClass: p.pitchClass, octave: p.octave + 1)
            pitches.append(p)
        }
    } else if clampedInv < 0 {
        for _ in 0..<(-clampedInv) {
            var p = pitches.removeLast()
            p = Pitch(pitchClass: p.pitchClass, octave: p.octave - 1)
            pitches.insert(p, at: 0)
        }
    }

    return pitches
}

func equalFrequencies(_ pitches: [Pitch]) -> [Double] {
    pitches.map { pitchFrequency($0) }
}

func slashChordPitchClasses(root: PitchClass, quality: ChordType, bass: PitchClass) -> [PitchClass] {
    let ivs = chordIntervals(quality)
    let rootInt = root.rawValue

    // Get unique pitch classes (dedup octave doublings)
    var seen = Set<PitchClass>()
    var uniquePCs: [PitchClass] = []
    for interval in ivs {
        let pc = PitchClass.fromInt(rootInt + interval)
        if !seen.contains(pc) {
            seen.insert(pc)
            uniquePCs.append(pc)
        }
    }

    let bassIsChordTone = uniquePCs.contains(bass)

    if bassIsChordTone {
        // Remove bass from upper voices
        var upper = uniquePCs.filter { $0 != bass }
        // Ensure 3 upper voices — double root if needed
        while upper.count < 3 {
            upper.append(root)
        }
        return [bass] + Array(upper.prefix(3))
    } else {
        if uniquePCs.count <= 3 {
            return [bass] + uniquePCs
        }
        // 4+ unique PCs: try to omit the perfect 5th (interval 7)
        let p5pc = PitchClass.fromInt(rootInt + 7)
        var upper = uniquePCs
        if let idx = upper.firstIndex(of: p5pc) {
            upper.remove(at: idx)
        }
        // Keep max 3 upper voices
        if upper.count > 3 {
            upper = Array(upper.dropLast(upper.count - 3))
        }
        return [bass] + upper
    }
}

/// Resolve a note letter + accidental string to a PitchClass.
/// e.g. ("C", nil) → .c, ("F", "#") → .fs, ("B", "b") → .as_
func resolveRoot(letter: Character, accidental: Character?) -> PitchClass? {
    let natural: PitchClass?
    switch letter {
    case "C": natural = .c
    case "D": natural = .d
    case "E": natural = .e
    case "F": natural = .f
    case "G": natural = .g
    case "A": natural = .a
    case "B": natural = .b
    default: return nil
    }

    guard let base = natural else { return nil }

    switch accidental {
    case "#": return PitchClass.fromInt(base.rawValue + 1)
    case "b": return PitchClass.fromInt(base.rawValue - 1)
    case nil: return base
    default: return nil
    }
}
```

- [ ] **Step 4: Run tests — expect all pass**

Run: Cmd+U
Expected: All MusicTheoryTests pass

- [ ] **Step 5: Commit**

```bash
git add Engine/MusicTheory.swift ChordPlayiPadTests/MusicTheoryTests.swift
git commit -m "feat: add music theory — intervals, pitch conversion, frequencies, slash chords"
```

---

## Task 4: Chord Parser (ChordParser.swift)

**Files:**
- Create: `Engine/ChordParser.swift`
- Test: `ChordPlayiPadTests/ChordParserTests.swift`

The parser converts strings like `"Am7"`, `"2Eb"`, `"C/E"` into `ChordSymbol` values. This is the most test-heavy file.

- [ ] **Step 1: Write ChordParserTests.swift**

```swift
import Testing
@testable import ChordPlayiPad

struct ChordParserTests {
    // MARK: - Basic chords

    @Test func parseCMajor() {
        let r = parseChord("C")
        #expect(r.value?.root == .c)
        #expect(r.value?.quality == .major)
        #expect(r.value?.inversion == nil)
    }

    @Test func parseAMinor() {
        let r = parseChord("Am")
        #expect(r.value?.root == .a)
        #expect(r.value?.quality == .minor)
    }

    // MARK: - 7th chords

    @Test func parseBb7() {
        let r = parseChord("Bb7")
        #expect(r.value?.root == .as_)
        #expect(r.value?.quality == .dom7)
    }

    @Test func parseFSharpM7() {
        let r = parseChord("F#m7")
        #expect(r.value?.root == .fs)
        #expect(r.value?.quality == .min7)
    }

    @Test func parseEbMaj7() {
        let r = parseChord("Ebmaj7")
        #expect(r.value?.root == .ds)
        #expect(r.value?.quality == .maj7)
    }

    // MARK: - Extended qualities

    @Test func parseDim7() {
        let r = parseChord("Gdim7")
        #expect(r.value?.root == .g)
        #expect(r.value?.quality == .dim7)
    }

    @Test func parseAugPlus() {
        let r = parseChord("C+")
        #expect(r.value?.root == .c)
        #expect(r.value?.quality == .aug)
    }

    @Test func parseAugWord() {
        let r = parseChord("Caug")
        #expect(r.value?.quality == .aug)
    }

    @Test func parseHalfDim7() {
        let r = parseChord("Cm7b5")
        #expect(r.value?.quality == .halfDim7)
    }

    @Test func parseSus4() {
        let r = parseChord("Csus4")
        #expect(r.value?.quality == .sus4)
    }

    @Test func parseMinMaj7() {
        let r = parseChord("CmMaj7")
        #expect(r.value?.quality == .minMaj7)
    }

    @Test func parseMaj6() {
        let r = parseChord("C6")
        #expect(r.value?.quality == .maj6)
    }

    @Test func parseMin6() {
        let r = parseChord("Cm6")
        #expect(r.value?.quality == .min6)
    }

    // MARK: - 9th chords

    @Test func bare9thFails() {
        #expect(parseChord("A9").isOk == false)
        #expect(parseChord("Cmaj9").isOk == false)
        #expect(parseChord("Cm9").isOk == false)
    }

    @Test func dom9Omissions() {
        #expect(parseChord("C9-1").value?.quality == .dom9no1)
        #expect(parseChord("C9-3").value?.quality == .dom9no3)
        #expect(parseChord("C9-5").value?.quality == .dom9no5)
        #expect(parseChord("C9-7").value?.quality == .dom9no7)
    }

    @Test func maj9Omissions() {
        #expect(parseChord("Cmaj9-1").value?.quality == .maj9no1)
        #expect(parseChord("Cmaj9-3").value?.quality == .maj9no3)
        #expect(parseChord("Cmaj9-5").value?.quality == .maj9no5)
        #expect(parseChord("Cmaj9-7").value?.quality == .maj9no7)
    }

    @Test func min9Omissions() {
        #expect(parseChord("Cm9-1").value?.quality == .min9no1)
        #expect(parseChord("Cm9-3").value?.quality == .min9no3)
        #expect(parseChord("Cm9-5").value?.quality == .min9no5)
        #expect(parseChord("Cm9-7").value?.quality == .min9no7)
    }

    @Test func add9Aliases() {
        #expect(parseChord("Cadd9").value?.quality == .dom9no7)
        #expect(parseChord("Cmadd9").value?.quality == .min9no7)
    }

    // MARK: - 13th chords

    @Test func parseDom13() {
        #expect(parseChord("C13").value?.quality == .dom13)
        #expect(parseChord("Bb13").value?.root == .as_)
        #expect(parseChord("Bb13").value?.quality == .dom13)
    }

    @Test func dom13WithInversion() {
        let r = parseChord("1C13")
        #expect(r.value?.quality == .dom13)
        #expect(r.value?.inversion == 1)
    }

    // MARK: - 9th with accidentals and inversions

    @Test func ninthWithFlat() {
        #expect(parseChord("Bb9-5").value?.root == .as_)
        #expect(parseChord("Bb9-5").value?.quality == .dom9no5)
    }

    @Test func ninthWithInversion() {
        let r = parseChord("1C9-1")
        #expect(r.value?.quality == .dom9no1)
        #expect(r.value?.inversion == 1)
    }

    // MARK: - Inversions

    @Test func firstInversion() {
        let r = parseChord("1G7")
        #expect(r.value?.root == .g)
        #expect(r.value?.quality == .dom7)
        #expect(r.value?.inversion == 1)
    }

    @Test func secondInversion() {
        let r = parseChord("2Eb")
        #expect(r.value?.root == .ds)
        #expect(r.value?.quality == .major)
        #expect(r.value?.inversion == 2)
    }

    @Test func negativeInversion() {
        let r = parseChord("-1G7")
        #expect(r.value?.inversion == -1)
    }

    @Test func zeroInversion() {
        let r = parseChord("0C")
        #expect(r.value?.inversion == 0)
    }

    // MARK: - Errors

    @Test func emptyStringFails() {
        #expect(parseChord("").isOk == false)
    }

    @Test func invalidRootFails() {
        #expect(parseChord("X7").isOk == false)
    }

    // MARK: - Slash chords

    @Test func slashCE() {
        let r = parseChord("C/E")
        #expect(r.value?.root == .c)
        #expect(r.value?.quality == .major)
        #expect(r.value?.bass == .e)
        #expect(r.value?.inversion == nil)
    }

    @Test func slashWithFlats() {
        let r = parseChord("C/Bb")
        #expect(r.value?.bass == .as_)
    }

    @Test func slashOverridesInversion() {
        let r = parseChord("1C/E")
        #expect(r.value?.bass == .e)
        #expect(r.value?.inversion == nil) // slash overrides inversion
    }

    @Test func complexSlash() {
        let r = parseChord("F#m7/E")
        #expect(r.value?.root == .fs)
        #expect(r.value?.quality == .min7)
        #expect(r.value?.bass == .e)
    }

    // MARK: - parseChordSequence

    @Test func sequenceParses() {
        let results = parseChordSequence("C Am7 G7")
        #expect(results.count == 3)
        #expect(results.allSatisfy { $0.isOk })
    }

    @Test func sequenceMarksErrors() {
        let results = parseChordSequence("C XYZ G")
        #expect(results.count == 3)
        #expect(results[0].isOk)
        #expect(results[1].isOk == false)
        #expect(results[2].isOk)
    }

    @Test func emptySequence() {
        #expect(parseChordSequence("").isEmpty)
    }

    @Test func sequenceWithSlashChords() {
        let results = parseChordSequence("C/E Am7/G F C13")
        #expect(results.count == 4)
        #expect(results.allSatisfy { $0.isOk })
        #expect(results[0].value?.bass == .e)
        #expect(results[3].value?.quality == .dom13)
    }
}
```

- [ ] **Step 2: Run tests — expect compile error**

Run: Cmd+U
Expected: `parseChord`, `parseChordSequence` not found

- [ ] **Step 3: Implement ChordParser.swift**

```swift
import Foundation

// MARK: - Public API

func parseChord(_ input: String) -> ParseResult<ChordSymbol> {
    let trimmed = input.trimmingCharacters(in: .whitespaces)
    guard !trimmed.isEmpty else {
        return .error("Empty chord input")
    }

    var chars = Array(trimmed)
    var index = 0

    // 1. Parse optional inversion prefix: [-]digit before a letter A-G
    var inversion: Int? = nil
    if let invResult = parseInversionPrefix(chars, index: &index) {
        inversion = invResult
    }

    // 2. Parse root note
    guard index < chars.count else { return .error("No root note found in '\(input)'") }
    let rootLetter = chars[index]
    guard "ABCDEFG".contains(rootLetter) else {
        return .error("Invalid root note '\(rootLetter)' in '\(input)'")
    }
    index += 1

    var accidental: Character? = nil
    if index < chars.count && (chars[index] == "#" || chars[index] == "b") {
        accidental = chars[index]
        index += 1
    }

    guard let root = resolveRoot(letter: rootLetter, accidental: accidental) else {
        return .error("Cannot resolve root '\(rootLetter)\(accidental.map(String.init) ?? "")' in '\(input)'")
    }

    // 3. Check for slash bass at end
    let remaining = String(chars[index...])
    var qualityStr: String
    var bass: PitchClass? = nil

    if let slashRange = remaining.range(of: "/", options: .backwards) {
        let afterSlash = String(remaining[remaining.index(after: slashRange.lowerBound)...])
        if let parsedBass = parseBassNote(afterSlash) {
            bass = parsedBass
            qualityStr = String(remaining[..<slashRange.lowerBound])
            // Slash chord overrides inversion
            inversion = nil
        } else {
            qualityStr = remaining
        }
    } else {
        qualityStr = remaining
    }

    // 4. Parse quality
    guard let quality = parseQuality(qualityStr) else {
        return .error("Unknown chord quality '\(qualityStr)' in '\(input)'")
    }

    return .ok(ChordSymbol(
        root: root,
        quality: quality,
        inversion: inversion,
        bass: bass
    ))
}

func parseChordSequence(_ input: String) -> [ParseResult<ChordSymbol>] {
    let tokens = tokenizeChordInput(input)
    return tokens
        .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        .map { parseChord($0) }
}

func tokenizeChordInput(_ input: String) -> [String] {
    guard !input.isEmpty else { return [] }

    var tokens: [String] = []
    var current = ""
    var inParen = false

    for ch in input {
        if ch == "(" {
            if !current.isEmpty { tokens.append(current); current = "" }
            inParen = true
            current.append(ch)
        } else if ch == ")" && inParen {
            current.append(ch)
            tokens.append(current)
            current = ""
            inParen = false
        } else if ch == " " && !inParen {
            if !current.isEmpty { tokens.append(current); current = "" }
            // Collect spaces as a single token
            var spaces = " "
            // (spaces handled by the caller filtering whitespace tokens)
            tokens.append(spaces)
        } else {
            current.append(ch)
        }
    }
    if !current.isEmpty { tokens.append(current) }
    return tokens
}

// MARK: - Private helpers

private func parseInversionPrefix(_ chars: [Character], index: inout Int) -> Int? {
    var i = index
    var negative = false

    if i < chars.count && chars[i] == "-" {
        negative = true
        i += 1
    }

    guard i < chars.count && chars[i].isNumber else { return nil }

    // Check if next character after digit(s) is a letter A-G
    var numStr = ""
    let digitStart = i
    while i < chars.count && chars[i].isNumber {
        numStr.append(chars[i])
        i += 1
    }

    // Must be followed by A-G to be an inversion prefix
    guard i < chars.count && "ABCDEFG".contains(chars[i]) else { return nil }

    guard let num = Int(numStr) else { return nil }
    index = i
    return negative ? -num : num
}

private func parseBassNote(_ s: String) -> PitchClass? {
    guard !s.isEmpty else { return nil }
    let chars = Array(s)
    let letter = chars[0]
    guard "ABCDEFG".contains(letter) else { return nil }
    let acc: Character? = chars.count > 1 ? chars[1] : nil
    if let acc = acc, acc != "#" && acc != "b" { return nil }
    if chars.count > 2 { return nil } // trailing junk
    return resolveRoot(letter: letter, accidental: acc)
}

private func parseQuality(_ s: String) -> ChordType? {
    // Order matters: try longest/most-specific matches first
    // 13th
    if s == "13" { return .dom13 }

    // 9th with omission: "9-N", "maj9-N", "m9-N", "add9", "madd9"
    if s == "madd9" { return .min9no7 }
    if s == "add9" { return .dom9no7 }

    if let ninthResult = parseNinthQuality(s) { return ninthResult }

    // Specific matches (longest first to avoid prefix collisions)
    switch s {
    case "mMaj7": return .minMaj7
    case "m7b5":  return .halfDim7
    case "maj7":  return .maj7
    case "min7":  return .min7
    case "dim7":  return .dim7
    case "m7":    return .min7
    case "7":     return .dom7
    case "maj":   return .major
    case "min":   return .minor
    case "m":     return .minor
    case "dim":   return .dim
    case "aug":   return .aug
    case "+":     return .aug
    case "sus4":  return .sus4
    case "sus2":  return .sus2
    case "m6":    return .min6
    case "6":     return .maj6
    case "":      return .major
    default:      return nil
    }
}

private func parseNinthQuality(_ s: String) -> ChordType? {
    // Patterns: "9-N", "maj9-N", "m9-N"
    let patterns: [(prefix: String, family: String)] = [
        ("maj9-", "maj9"),
        ("m9-",   "min9"),
        ("9-",    "dom9"),
    ]

    for (prefix, family) in patterns {
        guard s.hasPrefix(prefix) else { continue }
        let omission = String(s.dropFirst(prefix.count))
        switch (family, omission) {
        case ("dom9", "1"): return .dom9no1
        case ("dom9", "3"): return .dom9no3
        case ("dom9", "5"): return .dom9no5
        case ("dom9", "7"): return .dom9no7
        case ("maj9", "1"): return .maj9no1
        case ("maj9", "3"): return .maj9no3
        case ("maj9", "5"): return .maj9no5
        case ("maj9", "7"): return .maj9no7
        case ("min9", "1"): return .min9no1
        case ("min9", "3"): return .min9no3
        case ("min9", "5"): return .min9no5
        case ("min9", "7"): return .min9no7
        default: return nil
        }
    }

    // Bare 9th without omission = error (return nil → caller returns error)
    if s == "9" || s == "maj9" || s == "m9" { return nil }

    return nil
}
```

- [ ] **Step 4: Run tests — expect all pass**

Run: Cmd+U
Expected: All ChordParserTests pass

- [ ] **Step 5: Commit**

```bash
git add Engine/ChordParser.swift ChordPlayiPadTests/ChordParserTests.swift
git commit -m "feat: add chord parser — string to ChordSymbol with inversions, slash chords, 9ths/13ths"
```

---

## Task 5: Voice Leading (VoiceLeading.swift)

**Files:**
- Create: `Engine/VoiceLeading.swift`
- Test: `ChordPlayiPadTests/VoiceLeadingTests.swift`

The voice leading optimizer assigns pitch classes to 4 voices, minimizing movement between consecutive chords.

- [ ] **Step 1: Write VoiceLeadingTests.swift**

```swift
import Testing
@testable import ChordPlayiPad

struct VoiceLeadingTests {
    // MARK: - smoothVoice

    @Test func smoothVoiceMinimizesMovement() {
        let prev = voiceChord(root: .c, quality: .major, inversion: 0)
        let nextPCs: [PitchClass] = [.f, .a, .c, .f]
        let result = smoothVoice(mode: .equal, prevPitches: prev, nextPCs: nextPCs)
        let prevSorted = prev.sorted { $0.midi < $1.midi }
        let maxMove = zip(prevSorted, result.sorted { $0.midi < $1.midi })
            .map { abs($0.midi - $1.midi) }
            .max()!
        #expect(maxMove <= 7)
    }

    @Test func smoothVoiceRejectsUnisons() {
        let prev = voiceChord(root: .c, quality: .major, inversion: 0)
        let nextPCs: [PitchClass] = [.f, .a, .c, .f]
        let result = smoothVoice(mode: .equal, prevPitches: prev, nextPCs: nextPCs)
        let midis = result.map { $0.midi }
        #expect(Set(midis).count == 4) // all unique MIDI values
    }

    @Test func smoothVoiceAvoidsUnisonsWithGravity() {
        let prev = voiceChord(root: .d, quality: .minor, inversion: 0)
        let nextPCs: [PitchClass] = [.d, .fs, .a, .d]
        let result = smoothVoice(
            mode: .equal,
            prevPitches: prev,
            nextPCs: nextPCs,
            options: VoiceLeadingOptions(gravityCenter: 55)
        )
        let midis = result.map { $0.midi }
        #expect(Set(midis).count == 4)
    }

    // MARK: - voiceChordSequence

    @Test func emptySequence() {
        let result = voiceChordSequence(mode: nil, chords: [])
        #expect(result.isEmpty)
    }

    @Test func sequenceWithoutSmooth() {
        let chords = [
            ChordSymbol(root: .c, quality: .major),
            ChordSymbol(root: .g, quality: .major)
        ]
        let result = voiceChordSequence(mode: nil, chords: chords)
        #expect(result.count == 2)
        #expect(result[0].count == 4)
        #expect(result[1].count == 4)
    }

    @Test func smoothSequenceStaysClose() {
        let chords = [
            ChordSymbol(root: .c, quality: .major),
            ChordSymbol(root: .f, quality: .major),
            ChordSymbol(root: .g, quality: .dom7),
            ChordSymbol(root: .c, quality: .major)
        ]
        let result = voiceChordSequence(mode: .equal, chords: chords)
        #expect(result.count == 4)
        for i in 1..<result.count {
            let totalMove = zip(result[i-1], result[i]).map { abs($0.midi - $1.midi) }.reduce(0, +)
            #expect(totalMove < 24)
        }
    }

    @Test func explicitInversionOverridesSmooth() {
        let chords = [
            ChordSymbol(root: .c, quality: .major),
            ChordSymbol(root: .g, quality: .major, inversion: 2)
        ]
        let result = voiceChordSequence(mode: .equal, chords: chords)
        let expected = voiceChord(root: .g, quality: .major, inversion: 2)
        #expect(result[1] == expected)
    }

    // MARK: - assignOctaves

    @Test func assignOctavesReturns4Pitches() {
        let result = assignOctaves(pcs: [.f, .a, .c, .ds], gravityCenter: 57)
        #expect(result.count == 4)
    }

    @Test func assignOctavesAscending() {
        let result = assignOctaves(pcs: [.c, .e, .g, .b], gravityCenter: 57)
        for i in 1..<result.count {
            #expect(result[i].midi >= result[i-1].midi)
        }
    }

    // MARK: - Slash chords in sequence

    @Test func slashChordBassIsLowest() {
        let chords = [ChordSymbol(root: .c, quality: .major, bass: .e)]
        let result = voiceChordSequence(mode: nil, chords: chords)
        let sorted = result[0].sorted { $0.midi < $1.midi }
        #expect(sorted[0].pitchClass == .e)
    }

    @Test func slashChordBassLowestWithSmooth() {
        let chords = [
            ChordSymbol(root: .c, quality: .major),
            ChordSymbol(root: .c, quality: .major, bass: .e)
        ]
        let result = voiceChordSequence(mode: .equal, chords: chords)
        let sorted = result[1].sorted { $0.midi < $1.midi }
        #expect(sorted[0].pitchClass == .e)
    }

    // MARK: - Gravity and spread

    @Test func gravityPullsVoicing() {
        let prev = voiceChord(root: .c, quality: .major, inversion: 0)
        let nextPCs: [PitchClass] = [.d, .a, .fs, .d]

        let low = smoothVoice(mode: .equal, prevPitches: prev, nextPCs: nextPCs,
                              options: VoiceLeadingOptions(gravityCenter: 55))
        let high = smoothVoice(mode: .equal, prevPitches: prev, nextPCs: nextPCs,
                               options: VoiceLeadingOptions(gravityCenter: 84))

        let lowCenter = Double(low.map { $0.midi }.reduce(0, +)) / 4.0
        let highCenter = Double(high.map { $0.midi }.reduce(0, +)) / 4.0
        #expect(lowCenter < highCenter)
    }
}
```

- [ ] **Step 2: Run tests — expect compile error**

Run: Cmd+U
Expected: `smoothVoice`, `voiceChordSequence`, `assignOctaves` not found

- [ ] **Step 3: Implement VoiceLeading.swift**

```swift
import Foundation

// MARK: - Constants

private let gravityWeight: Double = 1.0
private let spreadWeight: Double = 2.0
private let defaultGravityCenter = 57  // A3
private let defaultTargetSpread = 12   // 1 octave

// MARK: - Public API

func smoothVoice(
    mode: SmoothMode,
    prevPitches: [Pitch],
    nextPCs: [PitchClass],
    options: VoiceLeadingOptions = VoiceLeadingOptions()
) -> [Pitch] {
    let prevSorted = prevPitches.sorted { $0.midi < $1.midi }
    let voiceWeights: [Double] = mode == .bass ? [2, 1, 1, 1] : [1, 1, 1, 1]

    var bestPitches = nextPCs.enumerated().map { i, pc in
        nearestPitch(pitchClass: pc, targetMidi: prevSorted[min(i, prevSorted.count - 1)].midi)
    }
    var bestCost = Double.infinity

    for perm in permutations(nextPCs) {
        let candidates = perm.enumerated().map { i, pc in
            nearestTwoPitches(pc: pc, targetMidi: prevSorted[min(i, prevSorted.count - 1)].midi,
                              gravityCenter: options.gravityCenter)
        }

        for combo in cartesian(candidates) {
            let cost = voicingCost(
                prev: prevSorted,
                next: combo,
                weights: voiceWeights,
                gravityCenter: options.gravityCenter,
                targetSpread: options.targetSpread
            )
            if cost < bestCost {
                bestCost = cost
                bestPitches = combo
            }
        }
    }
    return bestPitches
}

func voiceChordSequence(
    mode: SmoothMode?,
    chords: [ChordSymbol],
    options: VoiceLeadingOptions = VoiceLeadingOptions()
) -> [[Pitch]] {
    guard !chords.isEmpty else { return [] }

    var result: [[Pitch]] = []

    for (i, chord) in chords.enumerated() {
        if let ev = chord.explicitVoicing {
            result.append(assignOctaves(pcs: ev, gravityCenter: options.gravityCenter))
            continue
        }

        if let bass = chord.bass {
            let prev = i > 0 ? result[i-1] : nil
            result.append(voiceSlashChord(chord: chord, prevPitches: prev,
                                          mode: mode, options: options))
            continue
        }

        if i == 0 {
            let pitched = voiceChord(root: chord.root, quality: chord.quality,
                                     inversion: chord.inversion ?? 0)
            if mode != nil {
                let centroid = Double(pitched.map { $0.midi }.reduce(0, +)) / Double(pitched.count)
                let shift = Int(round(Double(options.gravityCenter) - centroid))
                let octaveShift = shift / 12
                let shifted = pitched.map { Pitch(pitchClass: $0.pitchClass, octave: $0.octave + octaveShift) }
                result.append(shifted)
            } else {
                result.append(pitched)
            }
            continue
        }

        if let inv = chord.inversion {
            result.append(voiceChord(root: chord.root, quality: chord.quality, inversion: inv))
            continue
        }

        if let mode = mode {
            let pcs = chordPitchClasses(root: chord.root, quality: chord.quality)
            result.append(smoothVoice(mode: mode, prevPitches: result[i-1],
                                      nextPCs: pcs, options: options))
        } else {
            result.append(voiceChord(root: chord.root, quality: chord.quality, inversion: 0))
        }
    }

    return result
}

func assignOctaves(pcs: [PitchClass], gravityCenter: Int) -> [Pitch] {
    var bestPitches: [Pitch] = []
    var bestDist = Int.max

    for startOct in 2...5 {
        var pitches: [Pitch] = []
        var lastMidi = (startOct + 1) * 12 + pcs[0].rawValue - 1
        for pc in pcs {
            let baseMidi = (startOct + 1) * 12 + pc.rawValue
            var midi = baseMidi
            while midi <= lastMidi { midi += 12 }
            pitches.append(Pitch(midi: midi))
            lastMidi = midi
        }
        let mean = pitches.map { $0.midi }.reduce(0, +) / pitches.count
        let dist = abs(mean - gravityCenter)
        if dist < bestDist {
            bestDist = dist
            bestPitches = pitches
        }
    }
    return bestPitches
}

// MARK: - Private helpers

private func permutations<T>(_ arr: [T]) -> [[T]] {
    guard arr.count > 1 else { return [arr] }
    var result: [[T]] = []
    for (i, elem) in arr.enumerated() {
        var rest = arr
        rest.remove(at: i)
        for perm in permutations(rest) {
            result.append([elem] + perm)
        }
    }
    return result
}

private func nearestTwoPitches(pc: PitchClass, targetMidi: Int, gravityCenter: Int) -> [Pitch] {
    let nearest = nearestPitch(pitchClass: pc, targetMidi: targetMidi)
    let nearestMidi = nearest.midi
    let otherOctave = nearestMidi > targetMidi ? nearest.octave - 1 : nearest.octave + 1
    let other = Pitch(pitchClass: pc, octave: otherOctave)

    // Only include other if it's closer to gravity center than nearest
    if abs(other.midi - gravityCenter) < abs(nearestMidi - gravityCenter) {
        return [nearest, other]
    }
    return [nearest]
}

private func cartesian(_ arrays: [[Pitch]]) -> [[Pitch]] {
    guard !arrays.isEmpty else { return [[]] }
    var result: [[Pitch]] = [[]]
    for candidates in arrays {
        var newResult: [[Pitch]] = []
        for existing in result {
            for candidate in candidates {
                newResult.append(existing + [candidate])
            }
        }
        result = newResult
    }
    return result
}

private func voicingCost(
    prev: [Pitch], next: [Pitch], weights: [Double],
    gravityCenter: Int, targetSpread: Int
) -> Double {
    let nextSorted = next.sorted { $0.midi < $1.midi }
    let midis = nextSorted.map { $0.midi }

    // Movement cost
    var movement = 0.0
    for i in 0..<min(prev.count, nextSorted.count) {
        movement += Double(abs(prev[i].midi - nextSorted[i].midi)) * weights[i]
    }

    // Cluster penalty (1-semitone gaps)
    var clusters = 0
    for i in 1..<midis.count {
        if midis[i] - midis[i-1] == 1 { clusters += 1 }
    }

    // Spread penalty
    let spread = midis.count >= 2 ? midis.last! - midis.first! : 0
    let spreadPenalty = spreadWeight * Double(abs(spread - targetSpread))

    // Gravity penalty
    let centroid = Double(midis.reduce(0, +)) / Double(midis.count)
    let gravityPenalty = gravityWeight * abs(centroid - Double(gravityCenter))

    // Unison penalty
    let unisons = midis.count - Set(midis).count
    let unisonPenalty = 1000.0 * Double(unisons)

    return movement + Double(clusters) * 12.0 + spreadPenalty + gravityPenalty + unisonPenalty
}

private func voiceSlashChord(
    chord: ChordSymbol,
    prevPitches: [Pitch]?,
    mode: SmoothMode?,
    options: VoiceLeadingOptions
) -> [Pitch] {
    guard let bass = chord.bass else {
        return voiceChord(root: chord.root, quality: chord.quality, inversion: 0)
    }

    let pcs = slashChordPitchClasses(root: chord.root, quality: chord.quality, bass: bass)
    // pcs[0] is bass, pcs[1..3] are upper voices

    if let prev = prevPitches, let mode = mode {
        // Pin bass near previous bass
        let prevSorted = prev.sorted { $0.midi < $1.midi }
        let bassNote = nearestPitch(pitchClass: pcs[0], targetMidi: prevSorted[0].midi)

        // Smooth upper voices
        let upperPCs = Array(pcs[1...])
        let upperPrev = Array(prevSorted[1...])
        var upper = smoothVoice(mode: mode, prevPitches: Array(upperPrev),
                                nextPCs: upperPCs, options: options)

        // Ensure all upper voices above bass
        upper = upper.map { p in
            var pitch = p
            while pitch.midi <= bassNote.midi {
                pitch = Pitch(pitchClass: pitch.pitchClass, octave: pitch.octave + 1)
            }
            return pitch
        }

        return [bassNote] + upper
    } else {
        // No previous context — place bass low, upper voices above
        let bassMidi = options.gravityCenter - 24
        let bassNote = nearestPitch(pitchClass: pcs[0], targetMidi: bassMidi)
        var result = [bassNote]
        var lastMidi = bassNote.midi
        for pc in pcs[1...] {
            var p = nearestPitch(pitchClass: pc, targetMidi: lastMidi + 4)
            while p.midi <= lastMidi { p = Pitch(pitchClass: p.pitchClass, octave: p.octave + 1) }
            result.append(p)
            lastMidi = p.midi
        }
        return result
    }
}
```

- [ ] **Step 4: Run tests — expect all pass**

Run: Cmd+U
Expected: All VoiceLeadingTests pass

- [ ] **Step 5: Commit**

```bash
git add Engine/VoiceLeading.swift ChordPlayiPadTests/VoiceLeadingTests.swift
git commit -m "feat: add voice leading optimizer — smooth voicing, slash chords, gravity/spread"
```

---

## Task 6: Audio Synthesizer (AudioSynthesizer.swift)

**Files:**
- Create: `Engine/AudioSynthesizer.swift`
- Test: `ChordPlayiPadTests/AudioSynthesizerTests.swift`

The audio synthesizer uses AVAudioEngine for real-time additive synthesis. The envelope and constants are testable; the AVAudioEngine integration requires a device/simulator.

- [ ] **Step 1: Write AudioSynthesizerTests.swift**

```swift
import Testing
@testable import ChordPlayiPad

struct AudioSynthesizerTests {
    // MARK: - Envelope

    @Test func envelopeStartsAtZero() {
        #expect(envelope(duration: 1.0, t: 0) < 0.01)
    }

    @Test func envelopeReachesPeakAtAttack() {
        let val = envelope(duration: 1.0, t: 0.020)
        #expect(abs(val - 1.0) < 0.05)
    }

    @Test func envelopeSettlesToSustain() {
        let val = envelope(duration: 1.0, t: 0.150)
        #expect(abs(val - 0.7) < 0.05)
    }

    @Test func envelopeSustainsInMiddle() {
        let val = envelope(duration: 1.0, t: 0.5)
        #expect(abs(val - 0.7) < 0.05)
    }

    @Test func envelopeReachesZeroAtEnd() {
        let val = envelope(duration: 1.0, t: 1.0)
        #expect(val < 0.01)
    }

    @Test func envelopeZeroAfterDuration() {
        #expect(envelope(duration: 1.0, t: 1.1) == 0.0)
    }

    // MARK: - Constants

    @Test func sampleRateIs44100() {
        #expect(AudioConstants.sampleRate == 44100)
    }

    @Test func has8Harmonics() {
        #expect(AudioConstants.harmonics.count == 8)
    }

    @Test func fundamentalAmplitudeIs1() {
        #expect(AudioConstants.harmonics[0] == (1, 1.0))
    }

    @Test func h7BoostedTo018() {
        #expect(AudioConstants.harmonics[6] == (7, 0.18))
    }
}
```

- [ ] **Step 2: Run tests — expect compile error**

Run: Cmd+U
Expected: `envelope`, `AudioConstants` not found

- [ ] **Step 3: Implement AudioSynthesizer.swift**

```swift
import AVFoundation
import Foundation

// MARK: - Constants

enum AudioConstants {
    static let sampleRate: Double = 44100
    static let attack: Double = 0.020
    static let decay: Double = 0.100
    static let sustain: Double = 0.70
    static let release: Double = 0.200
    static let gapFactor: Double = 0.080

    static let harmonics: [(harmonic: Int, amplitude: Double)] = [
        (1, 1.0), (2, 0.7), (3, 0.55), (4, 0.35),
        (5, 0.25), (6, 0.12), (7, 0.18), (8, 0.06),
    ]
}

// MARK: - Envelope (pure function, testable)

func envelope(duration: Double, t: Double) -> Double {
    let a = AudioConstants.attack
    let d = AudioConstants.decay
    let s = AudioConstants.sustain
    let r = AudioConstants.release

    guard t >= 0 else { return 0 }
    guard t < duration else { return 0 }

    if t < a {
        return t / a
    } else if t < a + d {
        return 1.0 - (1.0 - s) * (t - a) / d
    } else if t < duration - r {
        return s
    } else {
        return s * (1.0 - (t - (duration - r)) / r)
    }
}

// MARK: - AudioSynthesizer

@MainActor
final class AudioSynthesizer {
    private var engine: AVAudioEngine?
    private var sourceNode: AVAudioSourceNode?
    private var isPlaying = false

    // Current synthesis state (accessed from audio thread via atomic-like pattern)
    private var activeVoices: [(frequency: Double, startTime: Double, duration: Double)] = []
    private var renderStartHostTime: UInt64 = 0

    func start() {
        guard engine == nil else { return }
        let eng = AVAudioEngine()
        engine = eng
    }

    func playChord(frequencies: [Double], duration: Double) {
        stop()

        guard let engine = engine else { return }

        let sampleRate = AudioConstants.sampleRate
        let harmonics = AudioConstants.harmonics
        let masterGain = 0.3 / Double(frequencies.count)

        var phase = [Double](repeating: 0.0, count: frequencies.count * harmonics.count)
        var elapsed: Double = 0

        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!

        let node = AVAudioSourceNode { _, _, frameCount, bufferList -> OSStatus in
            let buffer = UnsafeMutableBufferPointer<Float>(
                start: bufferList.pointee.mBuffers.mData?.assumingMemoryBound(to: Float.self),
                count: Int(frameCount)
            )

            for frame in 0..<Int(frameCount) {
                var sample: Double = 0.0
                let t = elapsed + Double(frame) / sampleRate

                for (vIdx, freq) in frequencies.enumerated() {
                    let env = envelope(duration: duration, t: t)
                    for (hIdx, (harmonic, amplitude)) in harmonics.enumerated() {
                        let phaseIdx = vIdx * harmonics.count + hIdx
                        let phaseInc = 2.0 * .pi * freq * Double(harmonic) / sampleRate
                        phase[phaseIdx] += phaseInc
                        sample += sin(phase[phaseIdx]) * amplitude * env * masterGain
                    }
                }
                buffer[frame] = Float(sample)
            }
            elapsed += Double(frameCount) / sampleRate
            return noErr
        }

        sourceNode = node
        engine.attach(node)
        engine.connect(node, to: engine.mainMixerNode, format: format)

        do {
            try engine.start()
            isPlaying = true

            // Schedule stop after duration
            DispatchQueue.main.asyncAfter(deadline: .now() + duration + 0.05) { [weak self] in
                self?.stop()
            }
        } catch {
            print("AudioSynthesizer: failed to start engine: \(error)")
        }
    }

    func stop() {
        guard isPlaying, let engine = engine else { return }
        isPlaying = false

        if let node = sourceNode {
            engine.detach(node)
            sourceNode = nil
        }
        engine.stop()
    }

    func destroy() {
        stop()
        engine = nil
    }
}
```

- [ ] **Step 4: Run tests — expect all pass**

Run: Cmd+U
Expected: All AudioSynthesizerTests pass

- [ ] **Step 5: Commit**

```bash
git add Engine/AudioSynthesizer.swift ChordPlayiPadTests/AudioSynthesizerTests.swift
git commit -m "feat: add audio synthesizer — AVAudioEngine, additive synthesis, ADSR envelope"
```

---

## Task 7: SwiftData Models

**Files:**
- Create: `Models/SheetMusicDocument.swift`
- Create: `Models/PageAnnotation.swift`
- Create: `Models/ChordAnnotation.swift`

- [ ] **Step 1: Implement SheetMusicDocument.swift**

```swift
import Foundation
import SwiftData

@Model
final class SheetMusicDocument {
    @Attribute(.unique) var id: UUID
    var title: String
    @Attribute(.externalStorage) var pdfData: Data
    var pageCount: Int
    var createdAt: Date
    var updatedAt: Date
    @Relationship(deleteRule: .cascade) var pages: [PageAnnotation]

    init(title: String, pdfData: Data, pageCount: Int) {
        self.id = UUID()
        self.title = title
        self.pdfData = pdfData
        self.pageCount = pageCount
        self.createdAt = Date()
        self.updatedAt = Date()
        self.pages = []
    }
}
```

- [ ] **Step 2: Implement PageAnnotation.swift**

```swift
import Foundation
import SwiftData

@Model
final class PageAnnotation {
    @Attribute(.unique) var id: UUID
    var pageIndex: Int
    var inkData: Data
    @Relationship(deleteRule: .cascade) var chords: [ChordAnnotation]
    var document: SheetMusicDocument?

    init(pageIndex: Int, inkData: Data = Data()) {
        self.id = UUID()
        self.pageIndex = pageIndex
        self.inkData = inkData
        self.chords = []
    }
}
```

- [ ] **Step 3: Implement ChordAnnotation.swift**

```swift
import Foundation
import SwiftData

@Model
final class ChordAnnotation {
    @Attribute(.unique) var id: UUID
    var chordText: String
    var positionX: Double  // normalized 0..1
    var positionY: Double  // normalized 0..1
    var sequenceIndex: Int
    var confidence: Float
    var isConfirmed: Bool
    var strokeIDs: [UUID]
    var page: PageAnnotation?

    init(
        chordText: String,
        positionX: Double,
        positionY: Double,
        sequenceIndex: Int,
        confidence: Float = 1.0,
        isConfirmed: Bool = false,
        strokeIDs: [UUID] = []
    ) {
        self.id = UUID()
        self.chordText = chordText
        self.positionX = positionX
        self.positionY = positionY
        self.sequenceIndex = sequenceIndex
        self.confidence = confidence
        self.isConfirmed = isConfirmed
        self.strokeIDs = strokeIDs
    }
}
```

- [ ] **Step 4: Update App entry point**

Modify `ChordPlayiPadApp.swift`:

```swift
import SwiftUI
import SwiftData

@main
struct ChordPlayiPadApp: App {
    var body: some Scene {
        WindowGroup {
            LibraryView()
        }
        .modelContainer(for: [SheetMusicDocument.self, PageAnnotation.self, ChordAnnotation.self])
    }
}
```

- [ ] **Step 5: Build and verify**

Run: Cmd+B
Expected: Build Succeeded (LibraryView doesn't exist yet — create a placeholder)

Create a temporary `Views/LibraryView.swift`:
```swift
import SwiftUI

struct LibraryView: View {
    var body: some View {
        Text("ChordPlay iPad")
            .font(.largeTitle)
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add Models/ Views/LibraryView.swift ChordPlayiPadApp.swift
git commit -m "feat: add SwiftData models — SheetMusicDocument, PageAnnotation, ChordAnnotation"
```

---

## Task 8: Playback Manager

**Files:**
- Create: `ViewModels/PlaybackManager.swift`

This orchestrates the audio engine + voice leading for chord playback.

- [ ] **Step 1: Implement PlaybackManager.swift**

```swift
import Foundation
import Observation

@Observable
@MainActor
final class PlaybackManager {
    var isPlaying = false
    var currentChordIndex: Int? = nil
    var tempo: Double = 72 // BPM

    private let synth = AudioSynthesizer()
    private var playbackTask: Task<Void, Never>?

    init() {
        synth.start()
    }

    var chordDuration: Double {
        60.0 / tempo // seconds per beat
    }

    // MARK: - Tap-to-play single chord

    func playChord(_ symbol: ChordSymbol, previousPitches: [Pitch]?) {
        stopPlayback()

        let pitches: [Pitch]
        if let prev = previousPitches {
            let pcs = chordPitchClasses(root: symbol.root, quality: symbol.quality)
            pitches = smoothVoice(mode: .equal, prevPitches: prev, nextPCs: pcs)
        } else {
            pitches = voiceChord(root: symbol.root, quality: symbol.quality, inversion: 0)
        }

        let freqs = equalFrequencies(pitches)
        synth.playChord(frequencies: freqs, duration: chordDuration)
    }

    // MARK: - Sequential playback

    func playSequence(_ chords: [ChordSymbol], startingAt index: Int = 0, onChordStart: ((Int) -> Void)? = nil) {
        stopPlayback()
        guard !chords.isEmpty else { return }

        isPlaying = true
        let voicings = voiceChordSequence(mode: .equal, chords: chords)
        let dur = chordDuration

        playbackTask = Task { [weak self] in
            for i in index..<voicings.count {
                guard let self = self, self.isPlaying else { break }

                self.currentChordIndex = i
                onChordStart?(i)

                let freqs = equalFrequencies(voicings[i])
                self.synth.playChord(frequencies: freqs, duration: dur)

                let gap = dur * AudioConstants.gapFactor
                try? await Task.sleep(for: .seconds(dur + gap))
            }

            if let self = self {
                self.isPlaying = false
                self.currentChordIndex = nil
            }
        }
    }

    func stopPlayback() {
        isPlaying = false
        currentChordIndex = nil
        playbackTask?.cancel()
        playbackTask = nil
        synth.stop()
    }

    func skipForward(_ chords: [ChordSymbol], onChordStart: ((Int) -> Void)? = nil) {
        guard let current = currentChordIndex, current + 1 < chords.count else { return }
        playSequence(chords, startingAt: current + 1, onChordStart: onChordStart)
    }

    func skipBackward(_ chords: [ChordSymbol], onChordStart: ((Int) -> Void)? = nil) {
        guard let current = currentChordIndex, current > 0 else { return }
        playSequence(chords, startingAt: current - 1, onChordStart: onChordStart)
    }

    deinit {
        synth.destroy()
    }
}
```

- [ ] **Step 2: Build and verify**

Run: Cmd+B
Expected: Build Succeeded

- [ ] **Step 3: Commit**

```bash
git add ViewModels/PlaybackManager.swift
git commit -m "feat: add PlaybackManager — tap-to-play and sequential playback with voice leading"
```

---

## Task 9: PDF View (UIViewRepresentable)

**Files:**
- Create: `Views/PDFPageView.swift`

- [ ] **Step 1: Implement PDFPageView.swift**

```swift
import SwiftUI
import PDFKit

struct PDFPageView: UIViewRepresentable {
    let pdfData: Data
    @Binding var currentPage: Int

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePage
        pdfView.displayDirection = .horizontal
        pdfView.usePageViewController(true)
        pdfView.backgroundColor = .systemBackground

        if let doc = PDFDocument(data: pdfData) {
            pdfView.document = doc
        }

        // Observe page changes
        NotificationCenter.default.addObserver(
            context.coordinator,
            selector: #selector(Coordinator.pageChanged(_:)),
            name: .PDFViewPageChanged,
            object: pdfView
        )

        return pdfView
    }

    func updateUIView(_ pdfView: PDFView, context: Context) {
        // Navigate to requested page if different
        if let doc = pdfView.document,
           let page = doc.page(at: currentPage),
           pdfView.currentPage != page {
            pdfView.go(to: page)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject {
        var parent: PDFPageView

        init(_ parent: PDFPageView) {
            self.parent = parent
        }

        @objc func pageChanged(_ notification: Notification) {
            guard let pdfView = notification.object as? PDFView,
                  let currentPage = pdfView.currentPage,
                  let pageIndex = pdfView.document?.index(for: currentPage) else { return }
            DispatchQueue.main.async {
                self.parent.currentPage = pageIndex
            }
        }
    }
}
```

- [ ] **Step 2: Build and verify**

Run: Cmd+B
Expected: Build Succeeded

- [ ] **Step 3: Commit**

```bash
git add Views/PDFPageView.swift
git commit -m "feat: add PDFPageView — UIViewRepresentable wrapper for PDFKit"
```

---

## Task 10: PencilKit Canvas (UIViewRepresentable)

**Files:**
- Create: `Views/PencilCanvasView.swift`

- [ ] **Step 1: Implement PencilCanvasView.swift**

```swift
import SwiftUI
import PencilKit

struct PencilCanvasView: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    var onStrokesChanged: (([PKStroke]) -> Void)?

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.drawing = drawing
        canvas.tool = PKInkingTool(.pen, color: .systemBlue, width: 3)
        canvas.drawingPolicy = .pencilOnly
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.delegate = context.coordinator
        return canvas
    }

    func updateUIView(_ canvas: PKCanvasView, context: Context) {
        if canvas.drawing != drawing {
            canvas.drawing = drawing
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, PKCanvasViewDelegate {
        var parent: PencilCanvasView
        private var debounceTimer: Timer?

        init(_ parent: PencilCanvasView) {
            self.parent = parent
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            parent.drawing = canvasView.drawing

            // Debounce stroke recognition — wait 0.8s after last stroke
            debounceTimer?.invalidate()
            debounceTimer = Timer.scheduledTimer(withTimeInterval: 0.8, repeats: false) { [weak self] _ in
                guard let self = self else { return }
                self.parent.onStrokesChanged?(canvasView.drawing.strokes)
            }
        }
    }
}
```

- [ ] **Step 2: Build and verify**

Run: Cmd+B
Expected: Build Succeeded

- [ ] **Step 3: Commit**

```bash
git add Views/PencilCanvasView.swift
git commit -m "feat: add PencilCanvasView — PencilKit overlay with 0.8s debounced stroke callback"
```

---

## Task 11: Handwriting Recognition Pipeline

**Files:**
- Create: `Recognition/StrokeGrouper.swift`
- Create: `Recognition/HandwritingRecognizer.swift`
- Test: `ChordPlayiPadTests/HandwritingRecognizerTests.swift`

- [ ] **Step 1: Write HandwritingRecognizerTests.swift**

```swift
import Testing
@testable import ChordPlayiPad

struct HandwritingRecognizerTests {
    // MARK: - Parser-validated selection

    @Test func firstParseableCandidateWins() {
        let candidates = [
            RecognitionCandidate(text: "Arn7", confidence: 0.71),
            RecognitionCandidate(text: "Am7", confidence: 0.92),
            RecognitionCandidate(text: "Amy", confidence: 0.65),
        ]
        let result = selectBestChord(from: candidates)
        #expect(result?.chordText == "Am7")
        #expect(result?.confidence == 0.92)
    }

    @Test func noCandidatesParseable() {
        let candidates = [
            RecognitionCandidate(text: "Xyz", confidence: 0.9),
            RecognitionCandidate(text: "123", confidence: 0.8),
        ]
        let result = selectBestChord(from: candidates)
        #expect(result == nil)
    }

    @Test func emptyCandidates() {
        let result = selectBestChord(from: [])
        #expect(result == nil)
    }

    @Test func lowConfidenceStillAccepted() {
        let candidates = [
            RecognitionCandidate(text: "G7", confidence: 0.3),
        ]
        let result = selectBestChord(from: candidates)
        #expect(result?.chordText == "G7")
        #expect(result?.confidence == 0.3)
    }

    // MARK: - Fuzzy chord suggestions

    @Test func fuzzySuggestions() {
        let suggestions = fuzzyChordSuggestions(for: "Arn7", limit: 3)
        #expect(suggestions.contains("Am7"))
    }
}
```

- [ ] **Step 2: Run tests — expect compile error**

Run: Cmd+U
Expected: `RecognitionCandidate`, `selectBestChord`, `fuzzyChordSuggestions` not found

- [ ] **Step 3: Implement StrokeGrouper.swift**

```swift
import Foundation
import PencilKit

struct StrokeGroup {
    let strokes: [PKStroke]
    let bounds: CGRect
    let strokeIDs: [UUID]
}

enum StrokeGrouper {
    /// Group strokes by spatial proximity. Strokes whose bounding boxes
    /// are within `proximityThreshold` points of each other are merged.
    static func group(_ strokes: [PKStroke], proximityThreshold: CGFloat = 40) -> [StrokeGroup] {
        guard !strokes.isEmpty else { return [] }

        var groups: [(strokes: [PKStroke], bounds: CGRect, ids: [UUID])] = []

        for stroke in strokes {
            let strokeBounds = stroke.renderBounds
            let strokeID = UUID() // PencilKit strokes don't have stable IDs; assign one

            var merged = false
            for i in 0..<groups.count {
                let expanded = groups[i].bounds.insetBy(dx: -proximityThreshold, dy: -proximityThreshold)
                if expanded.intersects(strokeBounds) {
                    groups[i].strokes.append(stroke)
                    groups[i].bounds = groups[i].bounds.union(strokeBounds)
                    groups[i].ids.append(strokeID)
                    merged = true
                    break
                }
            }

            if !merged {
                groups.append((strokes: [stroke], bounds: strokeBounds, ids: [strokeID]))
            }
        }

        return groups.map { StrokeGroup(strokes: $0.strokes, bounds: $0.bounds, strokeIDs: $0.ids) }
    }
}
```

- [ ] **Step 4: Implement HandwritingRecognizer.swift**

```swift
import Foundation
import Vision
import PencilKit
import UIKit

// MARK: - Types

struct RecognitionCandidate: Sendable {
    let text: String
    let confidence: Float
}

struct ChordRecognitionResult: Sendable {
    let chordText: String
    let chord: ChordSymbol
    let confidence: Float
}

// MARK: - Parser-validated selection (pure, testable)

func selectBestChord(from candidates: [RecognitionCandidate]) -> (chordText: String, confidence: Float)? {
    for candidate in candidates {
        let result = parseChord(candidate.text)
        if result.isOk {
            return (chordText: candidate.text, confidence: candidate.confidence)
        }
    }
    return nil
}

/// Generate fuzzy chord suggestions for an unrecognized string using edit distance.
func fuzzyChordSuggestions(for input: String, limit: Int = 5) -> [String] {
    let allRoots = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"]
    let allQualities = ["", "m", "7", "m7", "maj7", "dim", "dim7", "aug", "m7b5", "sus4", "sus2", "6", "m6", "mMaj7"]

    var suggestions: [(chord: String, distance: Int)] = []
    for root in allRoots {
        for qual in allQualities {
            let chord = root + qual
            let dist = editDistance(input, chord)
            if dist <= 3 && parseChord(chord).isOk {
                suggestions.append((chord, dist))
            }
        }
    }

    return suggestions
        .sorted { $0.distance < $1.distance }
        .prefix(limit)
        .map { $0.chord }
}

private func editDistance(_ a: String, _ b: String) -> Int {
    let m = a.count, n = b.count
    let aChars = Array(a), bChars = Array(b)
    var dp = Array(repeating: Array(repeating: 0, count: n + 1), count: m + 1)
    for i in 0...m { dp[i][0] = i }
    for j in 0...n { dp[0][j] = j }
    for i in 1...m {
        for j in 1...n {
            if aChars[i-1] == bChars[j-1] {
                dp[i][j] = dp[i-1][j-1]
            } else {
                dp[i][j] = 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
            }
        }
    }
    return dp[m][n]
}

// MARK: - Vision integration

enum HandwritingRecognizer {
    /// Recognize text from a PencilKit stroke group rendered as an image.
    static func recognize(strokes: [PKStroke], in bounds: CGRect) async -> [RecognitionCandidate] {
        // Render strokes to image
        let drawing = PKDrawing(strokes: strokes)
        let image = drawing.image(from: bounds, scale: 2.0)

        guard let cgImage = image.cgImage else { return [] }

        return await withCheckedContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                guard let observations = request.results as? [VNRecognizedTextObservation] else {
                    continuation.resume(returning: [])
                    return
                }

                var candidates: [RecognitionCandidate] = []
                for observation in observations {
                    for candidate in observation.topCandidates(10) {
                        candidates.append(RecognitionCandidate(
                            text: candidate.string,
                            confidence: candidate.confidence
                        ))
                    }
                }
                // Sort by confidence descending
                candidates.sort { $0.confidence > $1.confidence }
                continuation.resume(returning: candidates)
            }

            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = false // chord names aren't English

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([request])
            } catch {
                continuation.resume(returning: [])
            }
        }
    }
}
```

- [ ] **Step 5: Run tests — expect all pass**

Run: Cmd+U
Expected: All HandwritingRecognizerTests pass

- [ ] **Step 6: Commit**

```bash
git add Recognition/ ChordPlayiPadTests/HandwritingRecognizerTests.swift
git commit -m "feat: add handwriting recognition — Vision OCR + parser validation + fuzzy suggestions"
```

---

## Task 12: Sheet View Model

**Files:**
- Create: `ViewModels/SheetViewModel.swift`

This orchestrates the PencilKit → recognition → badge → playback flow.

- [ ] **Step 1: Implement SheetViewModel.swift**

```swift
import Foundation
import Observation
import PencilKit
import SwiftData

@Observable
@MainActor
final class SheetViewModel {
    var document: SheetMusicDocument
    var currentPage: Int = 0
    var drawing: PKDrawing = PKDrawing()
    var chordAnnotations: [ChordAnnotation] = []
    var playback = PlaybackManager()

    private var modelContext: ModelContext

    init(document: SheetMusicDocument, modelContext: ModelContext) {
        self.document = document
        self.modelContext = modelContext
        loadPage(0)
    }

    // MARK: - Page management

    func loadPage(_ index: Int) {
        currentPage = index

        // Find or create PageAnnotation for this page
        let page = pageAnnotation(for: index)
        drawing = (try? PKDrawing(data: page.inkData)) ?? PKDrawing()
        chordAnnotations = page.chords.sorted { $0.sequenceIndex < $1.sequenceIndex }
    }

    func savePage() {
        let page = pageAnnotation(for: currentPage)
        page.inkData = drawing.dataRepresentation()
        document.updatedAt = Date()
        try? modelContext.save()
    }

    // MARK: - Stroke recognition

    func handleStrokesChanged(_ strokes: [PKStroke]) {
        // Save ink immediately
        savePage()

        // Group new strokes and recognize
        let groups = StrokeGrouper.group(strokes)
        for group in groups {
            Task {
                await recognizeGroup(group)
            }
        }
    }

    private func recognizeGroup(_ group: StrokeGroup) async {
        let candidates = await HandwritingRecognizer.recognize(
            strokes: group.strokes,
            in: group.bounds
        )

        guard let match = selectBestChord(from: candidates) else {
            // TODO: Mark strokes as unrecognized (orange ink)
            return
        }

        // Compute normalized position
        let page = pageAnnotation(for: currentPage)
        let posX = Double(group.bounds.midX) // Will be normalized by view size
        let posY = Double(group.bounds.midY)

        let annotation = ChordAnnotation(
            chordText: match.chordText,
            positionX: posX,
            positionY: posY,
            sequenceIndex: chordAnnotations.count,
            confidence: match.confidence,
            strokeIDs: group.strokeIDs
        )
        annotation.page = page
        page.chords.append(annotation)
        chordAnnotations.append(annotation)

        try? modelContext.save()
    }

    // MARK: - Playback

    var chordSymbols: [ChordSymbol] {
        chordAnnotations.compactMap { annotation in
            parseChord(annotation.chordText).value
        }
    }

    func tapChord(at index: Int) {
        let symbols = chordSymbols
        guard index < symbols.count else { return }

        let prev: [Pitch]? = index > 0
            ? voiceChordSequence(mode: .equal, chords: Array(symbols[0...index-1])).last
            : nil

        playback.playChord(symbols[index], previousPitches: prev)
    }

    func playAll() {
        playback.playSequence(chordSymbols)
    }

    // MARK: - Correction

    func updateChord(at index: Int, newText: String) {
        guard index < chordAnnotations.count else { return }
        chordAnnotations[index].chordText = newText
        chordAnnotations[index].isConfirmed = true
        chordAnnotations[index].confidence = 1.0
        try? modelContext.save()
    }

    func deleteChord(at index: Int) {
        guard index < chordAnnotations.count else { return }
        let annotation = chordAnnotations.remove(at: index)
        modelContext.delete(annotation)
        // Reindex sequence
        for (i, chord) in chordAnnotations.enumerated() {
            chord.sequenceIndex = i
        }
        try? modelContext.save()
    }

    // MARK: - Private

    private func pageAnnotation(for index: Int) -> PageAnnotation {
        if let existing = document.pages.first(where: { $0.pageIndex == index }) {
            return existing
        }
        let page = PageAnnotation(pageIndex: index)
        page.document = document
        document.pages.append(page)
        modelContext.insert(page)
        return page
    }
}
```

- [ ] **Step 2: Build and verify**

Run: Cmd+B
Expected: Build Succeeded

- [ ] **Step 3: Commit**

```bash
git add ViewModels/SheetViewModel.swift
git commit -m "feat: add SheetViewModel — orchestrates recognition, badges, and playback"
```

---

## Task 13: Chord Badge Overlay

**Files:**
- Create: `Views/ChordBadgeOverlay.swift`

- [ ] **Step 1: Implement ChordBadgeOverlay.swift**

```swift
import SwiftUI

struct ChordBadgeOverlay: View {
    let annotations: [ChordAnnotation]
    let activeIndex: Int?
    let viewSize: CGSize
    var onTap: ((Int) -> Void)?
    var onLongPress: ((Int) -> Void)?

    var body: some View {
        ZStack {
            ForEach(Array(annotations.enumerated()), id: \.element.id) { index, annotation in
                ChordBadge(
                    text: annotation.chordText,
                    isActive: index == activeIndex,
                    isLowConfidence: annotation.confidence < 0.5 && !annotation.isConfirmed
                )
                .position(
                    x: annotation.positionX * viewSize.width,
                    y: annotation.positionY * viewSize.height
                )
                .onTapGesture { onTap?(index) }
                .onLongPressGesture { onLongPress?(index) }
            }
        }
    }
}

struct ChordBadge: View {
    let text: String
    let isActive: Bool
    let isLowConfidence: Bool

    var body: some View {
        HStack(spacing: 2) {
            Text(text)
                .font(.system(size: 16, weight: .semibold, design: .rounded))
            if isLowConfidence {
                Text("?")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.orange)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(isActive ? Color.green.opacity(0.2) : Color(.systemGray6))
                .stroke(isActive ? Color.green : Color(.systemGray4), lineWidth: isActive ? 2 : 1)
        )
        .shadow(color: isActive ? .green.opacity(0.3) : .clear, radius: 8)
        .foregroundStyle(isActive ? .green : .primary)
    }
}
```

- [ ] **Step 2: Build and verify**

Run: Cmd+B
Expected: Build Succeeded

- [ ] **Step 3: Commit**

```bash
git add Views/ChordBadgeOverlay.swift
git commit -m "feat: add ChordBadgeOverlay — positioned tappable chord badges with active highlighting"
```

---

## Task 14: Transport Bar

**Files:**
- Create: `Views/TransportBar.swift`

- [ ] **Step 1: Implement TransportBar.swift**

```swift
import SwiftUI

struct TransportBar: View {
    @Bindable var playback: PlaybackManager
    let chordCount: Int
    var onPlay: () -> Void
    var onStop: () -> Void
    var onSkipForward: () -> Void
    var onSkipBackward: () -> Void

    var body: some View {
        HStack(spacing: 20) {
            // Skip backward
            Button(action: onSkipBackward) {
                Image(systemName: "backward.fill")
                    .font(.title2)
            }
            .disabled(!playback.isPlaying)

            // Play / Stop
            Button(action: {
                if playback.isPlaying {
                    onStop()
                } else {
                    onPlay()
                }
            }) {
                Image(systemName: playback.isPlaying ? "stop.fill" : "play.fill")
                    .font(.title)
                    .frame(width: 44, height: 44)
            }
            .tint(playback.isPlaying ? .red : .green)

            // Skip forward
            Button(action: onSkipForward) {
                Image(systemName: "forward.fill")
                    .font(.title2)
            }
            .disabled(!playback.isPlaying)

            Divider().frame(height: 30)

            // Tempo
            HStack(spacing: 6) {
                Image(systemName: "metronome")
                    .foregroundStyle(.secondary)
                Text("\(Int(playback.tempo))")
                    .font(.system(.body, design: .monospaced, weight: .semibold))
                    .frame(width: 36)
                Stepper("", value: $playback.tempo, in: 30...240, step: 4)
                    .labelsHidden()
            }

            Divider().frame(height: 30)

            // Position
            if let current = playback.currentChordIndex {
                Text("Chord \(current + 1) / \(chordCount)")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
            } else {
                Text("\(chordCount) chords")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
    }
}
```

- [ ] **Step 2: Build and verify**

Run: Cmd+B
Expected: Build Succeeded

- [ ] **Step 3: Commit**

```bash
git add Views/TransportBar.swift
git commit -m "feat: add TransportBar — play/stop, skip, tempo stepper, position indicator"
```

---

## Task 15: Correction Popover

**Files:**
- Create: `Views/CorrectionPopover.swift`

- [ ] **Step 1: Implement CorrectionPopover.swift**

```swift
import SwiftUI

struct CorrectionPopover: View {
    let originalText: String
    var onConfirm: (String) -> Void
    var onDelete: () -> Void
    @State private var editedText: String
    @State private var suggestions: [String] = []

    init(originalText: String, onConfirm: @escaping (String) -> Void, onDelete: @escaping () -> Void) {
        self.originalText = originalText
        self.onConfirm = onConfirm
        self.onDelete = onDelete
        self._editedText = State(initialValue: originalText)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Edit Chord")
                .font(.headline)

            TextField("Chord name", text: $editedText)
                .textFieldStyle(.roundedBorder)
                .font(.system(.title3, design: .monospaced))
                .autocorrectionDisabled()
                .textInputAutocapitalization(.characters)
                .onChange(of: editedText) { _, newValue in
                    suggestions = fuzzyChordSuggestions(for: newValue, limit: 4)
                }
                .onSubmit { confirmEdit() }

            // Validation indicator
            if parseChord(editedText).isOk {
                Label("Valid chord", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                    .font(.caption)
            } else if !editedText.isEmpty {
                Label("Unknown chord", systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                    .font(.caption)
            }

            // Suggestions
            if !suggestions.isEmpty {
                Text("Suggestions")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(suggestions, id: \.self) { suggestion in
                            Button(suggestion) {
                                editedText = suggestion
                                confirmEdit()
                            }
                            .buttonStyle(.bordered)
                            .font(.system(.body, design: .monospaced))
                        }
                    }
                }
            }

            HStack {
                Button("Delete", role: .destructive, action: onDelete)
                Spacer()
                Button("Confirm") { confirmEdit() }
                    .disabled(!parseChord(editedText).isOk)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .frame(width: 280)
        .onAppear {
            suggestions = fuzzyChordSuggestions(for: originalText, limit: 4)
        }
    }

    private func confirmEdit() {
        guard parseChord(editedText).isOk else { return }
        onConfirm(editedText)
    }
}
```

- [ ] **Step 2: Build and verify**

Run: Cmd+B
Expected: Build Succeeded

- [ ] **Step 3: Commit**

```bash
git add Views/CorrectionPopover.swift
git commit -m "feat: add CorrectionPopover — edit chord with validation, fuzzy suggestions, delete"
```

---

## Task 16: Sheet View (Main Workspace)

**Files:**
- Create: `Views/SheetView.swift`

This composites the PDF, PencilKit overlay, chord badges, and transport bar.

- [ ] **Step 1: Implement SheetView.swift**

```swift
import SwiftUI
import SwiftData

struct SheetView: View {
    @State var viewModel: SheetViewModel
    @State private var correctionTarget: Int? = nil

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                // Layer 1: PDF
                PDFPageView(
                    pdfData: viewModel.document.pdfData,
                    currentPage: $viewModel.currentPage
                )

                // Layer 2: PencilKit
                PencilCanvasView(
                    drawing: $viewModel.drawing,
                    onStrokesChanged: { strokes in
                        viewModel.handleStrokesChanged(strokes)
                    }
                )

                // Layer 3: Chord badges
                ChordBadgeOverlay(
                    annotations: viewModel.chordAnnotations,
                    activeIndex: viewModel.playback.currentChordIndex,
                    viewSize: geo.size,
                    onTap: { index in viewModel.tapChord(at: index) },
                    onLongPress: { index in correctionTarget = index }
                )

                // Transport bar
                TransportBar(
                    playback: viewModel.playback,
                    chordCount: viewModel.chordAnnotations.count,
                    onPlay: { viewModel.playAll() },
                    onStop: { viewModel.playback.stopPlayback() },
                    onSkipForward: {
                        viewModel.playback.skipForward(viewModel.chordSymbols)
                    },
                    onSkipBackward: {
                        viewModel.playback.skipBackward(viewModel.chordSymbols)
                    }
                )
            }
        }
        .navigationTitle(viewModel.document.title)
        .navigationBarTitleDisplayMode(.inline)
        .popover(item: $correctionTarget) { index in
            if index < viewModel.chordAnnotations.count {
                CorrectionPopover(
                    originalText: viewModel.chordAnnotations[index].chordText,
                    onConfirm: { newText in
                        viewModel.updateChord(at: index, newText: newText)
                        correctionTarget = nil
                    },
                    onDelete: {
                        viewModel.deleteChord(at: index)
                        correctionTarget = nil
                    }
                )
            }
        }
        .onChange(of: viewModel.currentPage) { _, newPage in
            viewModel.savePage()
            viewModel.loadPage(newPage)
        }
    }
}

// Make Int conform to Identifiable for popover binding
extension Int: @retroactive Identifiable {
    public var id: Int { self }
}
```

- [ ] **Step 2: Build and verify**

Run: Cmd+B
Expected: Build Succeeded

- [ ] **Step 3: Commit**

```bash
git add Views/SheetView.swift
git commit -m "feat: add SheetView — composites PDF, PencilKit, badges, transport, correction"
```

---

## Task 17: Library View & Document Import

**Files:**
- Modify: `Views/LibraryView.swift` (replace placeholder)
- Create: `ViewModels/LibraryViewModel.swift`

- [ ] **Step 1: Implement LibraryViewModel.swift**

```swift
import Foundation
import Observation
import SwiftData
import PDFKit

@Observable
@MainActor
final class LibraryViewModel {
    var documents: [SheetMusicDocument] = []
    var showingImporter = false
    var importError: String? = nil

    private var modelContext: ModelContext

    init(modelContext: ModelContext) {
        self.modelContext = modelContext
        fetchDocuments()
    }

    func fetchDocuments() {
        let descriptor = FetchDescriptor<SheetMusicDocument>(
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        documents = (try? modelContext.fetch(descriptor)) ?? []
    }

    func importPDF(data: Data) {
        guard let pdfDoc = PDFDocument(data: data) else {
            importError = "Could not read PDF file"
            return
        }

        let title = "Sheet Music \(documents.count + 1)"
        let doc = SheetMusicDocument(
            title: title,
            pdfData: data,
            pageCount: pdfDoc.pageCount
        )
        modelContext.insert(doc)
        try? modelContext.save()
        fetchDocuments()
    }

    func deleteDocument(_ doc: SheetMusicDocument) {
        modelContext.delete(doc)
        try? modelContext.save()
        fetchDocuments()
    }

    func renameDocument(_ doc: SheetMusicDocument, to newTitle: String) {
        doc.title = newTitle
        doc.updatedAt = Date()
        try? modelContext.save()
    }
}
```

- [ ] **Step 2: Replace LibraryView.swift**

```swift
import SwiftUI
import SwiftData
import PDFKit
import UniformTypeIdentifiers

struct LibraryView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var viewModel: LibraryViewModel?
    @State private var selectedDocument: SheetMusicDocument? = nil

    var body: some View {
        NavigationStack {
            Group {
                if let vm = viewModel {
                    if vm.documents.isEmpty {
                        ContentUnavailableView {
                            Label("No Sheet Music", systemImage: "music.note.list")
                        } description: {
                            Text("Import a PDF to get started")
                        } actions: {
                            Button("Import PDF") { vm.showingImporter = true }
                                .buttonStyle(.borderedProminent)
                        }
                    } else {
                        ScrollView {
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 200))], spacing: 16) {
                                ForEach(vm.documents, id: \.id) { doc in
                                    DocumentCard(document: doc)
                                        .onTapGesture { selectedDocument = doc }
                                        .contextMenu {
                                            Button("Delete", role: .destructive) {
                                                vm.deleteDocument(doc)
                                            }
                                        }
                                }
                            }
                            .padding()
                        }
                    }
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("ChordPlay")
            .toolbar {
                if let vm = viewModel {
                    Button {
                        vm.showingImporter = true
                    } label: {
                        Label("Import", systemImage: "plus")
                    }
                }
            }
            .fileImporter(
                isPresented: Binding(
                    get: { viewModel?.showingImporter ?? false },
                    set: { viewModel?.showingImporter = $0 }
                ),
                allowedContentTypes: [UTType.pdf],
                allowsMultipleSelection: false
            ) { result in
                switch result {
                case .success(let urls):
                    guard let url = urls.first else { return }
                    guard url.startAccessingSecurityScopedResource() else { return }
                    defer { url.stopAccessingSecurityScopedResource() }
                    if let data = try? Data(contentsOf: url) {
                        viewModel?.importPDF(data: data)
                    }
                case .failure(let error):
                    viewModel?.importError = error.localizedDescription
                }
            }
            .navigationDestination(item: $selectedDocument) { doc in
                SheetView(viewModel: SheetViewModel(document: doc, modelContext: modelContext))
            }
            .onAppear {
                if viewModel == nil {
                    viewModel = LibraryViewModel(modelContext: modelContext)
                }
            }
        }
    }
}

struct DocumentCard: View {
    let document: SheetMusicDocument

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // PDF thumbnail
            if let pdfDoc = PDFDocument(data: document.pdfData),
               let page = pdfDoc.page(at: 0) {
                let thumb = page.thumbnail(of: CGSize(width: 200, height: 260), for: .mediaBox)
                Image(uiImage: thumb)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.systemGray5))
                    .frame(height: 200)
                    .overlay {
                        Image(systemName: "doc.richtext")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                    }
            }

            Text(document.title)
                .font(.headline)
                .lineLimit(1)

            HStack {
                Text("\(document.pageCount) pages")
                Spacer()
                let chordCount = document.pages.flatMap(\.chords).count
                if chordCount > 0 {
                    Text("\(chordCount) chords")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.systemBackground)))
        .shadow(radius: 2)
    }
}
```

- [ ] **Step 3: Build and verify on iPad Simulator**

Run: Cmd+R (run on iPad Simulator)
Expected: App launches showing "No Sheet Music" empty state with Import button

- [ ] **Step 4: Commit**

```bash
git add Views/LibraryView.swift ViewModels/LibraryViewModel.swift
git commit -m "feat: add Library view — document grid, PDF import, thumbnails, navigation to SheetView"
```

---

## Task 18: Integration Testing & Polish

- [ ] **Step 1: Run full test suite**

Run: Cmd+U
Expected: All engine tests pass (Types, MusicTheory, ChordParser, VoiceLeading, AudioSynthesizer, HandwritingRecognizer)

- [ ] **Step 2: Manual test on iPad Simulator**

1. Launch app → Library shows empty state
2. Tap Import → file picker opens
3. Select a PDF → document appears in library grid with thumbnail
4. Tap document → SheetView opens with PDF rendered
5. Use Apple Pencil (simulate with mouse) to draw on the canvas
6. (Recognition requires device — verify ink appears on simulator)

- [ ] **Step 3: Fix any build warnings**

Run: Cmd+B, check Issue Navigator (Cmd+5)
Fix any Swift warnings (unused variables, deprecation, etc.)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: integration polish — fix warnings, verify full test suite"
```

---

## Post-Implementation Notes

**What works on Simulator vs Device:**
- ✅ Simulator: All engine tests, PDF rendering, SwiftUI views, navigation
- ⚠️ Simulator: PencilKit draws with mouse (limited — no pressure/tilt)
- ❌ Simulator: Vision handwriting recognition needs real pencil strokes on device
- ❌ Simulator: Audio may not play (use device for audio testing)

**Known areas for iteration (not in v1 scope):**
- Position normalization: The current `positionX/Y` values are in absolute points. On device, these need to be divided by the PDF view's frame size to get 0..1 normalized coordinates. This will become apparent during device testing.
- Stroke grouping threshold: The 40pt proximity threshold in `StrokeGrouper` may need tuning on device with real handwriting sizes.
- The sequential playback "auto-scroll to active chord" feature is described in the spec but not implemented in the view — add this once basic playback works on device.
