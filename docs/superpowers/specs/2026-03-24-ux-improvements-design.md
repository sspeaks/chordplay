# UX Improvements: Enharmonic Spelling, Shareable URLs, Defaults & UI Cleanup

**Date:** 2026-03-24
**Status:** Approved

## Problem

ChordPlay has several UX rough edges:

1. **Wrong enharmonic spelling** — NoteCards always shows flats (e.g., "B♭" in F#7 instead of "A#"), which is musically incorrect in sharp-key contexts.
2. **No URL sharing** — All state is lost on page refresh. Users can't share a chord progression link.
3. **Suboptimal defaults** — Just intonation and G3 gravity center are advanced choices; equal temperament and C4 are better for newcomers. Tempo of 1.2s is sluggish.
4. **Visual clutter** — Gravity and spread sliders are always visible even though most users never touch them.

## Scope

Five changes, all in the web frontend:

| Change | Files Affected |
|--------|---------------|
| Default tuning → equal | `App.tsx` |
| Default gravity → C4 (MIDI 60) | `App.tsx`, `voiceLeading.ts` |
| Default tempo → 0.8s | `App.tsx` |
| Hide gravity/spread behind disclosure triangle | `Toolbar.tsx`, CSS |
| Context-aware enharmonic spelling | `musicTheory.ts`, `NoteCards.tsx` |
| Shareable URLs (hash-based) | New `urlState.ts`, `App.tsx`, new dep `fflate` |

## Design

### 1. Default Changes

Three one-line state initializer changes in `App.tsx`:

```
tuning:        'just'  → 'equal'
gravityCenter:  55     → 60
tempo:          1.2    → 0.8
```

Also update `DEFAULT_GRAVITY_CENTER` in `voiceLeading.ts` from `55` to `60` so that the exported constant stays in sync with the App default.

### 2. Disclosure Triangle for Gravity/Spread

Wrap the gravity and spread sliders in `Toolbar.tsx` with a native `<details>/<summary>` element:

```tsx
{(voiceLeading === 'smooth' || voiceLeading === 'bass') && (
  <details className="voice-leading-advanced">
    <summary>Advanced</summary>
    {/* gravity slider */}
    {/* spread slider */}
  </details>
)}
```

- **Collapsed by default** (no `open` attribute)
- Only rendered when voice leading is `'smooth'` or `'bass'` (existing conditional)
- Native HTML element — no React state needed
- CSS styling to match existing toolbar look: `summary` cursor pointer, subtle marker styling

### 3. Context-Aware Enharmonic Spelling

**Affected component:** `NoteCards.tsx` only (chord input display unchanged).

**New utility in `musicTheory.ts`:**

Root-to-spelling-preference mapping based on conventional key signatures:

| PitchClass | Preference | Rationale |
|------------|-----------|-----------|
| C | flat | Convention (no key sig, but B♭ > A# in common usage) |
| Cs | flat | D♭ far more common than C# in barbershop/jazz |
| D | sharp | D major = 2 sharps |
| Ds | flat | E♭ far more common than D# |
| E | sharp | E major = 4 sharps |
| F | flat | F major = 1 flat |
| Fs | sharp | F# more common than G♭ |
| G | sharp | G major = 1 sharp |
| Gs | flat | A♭ far more common than G# |
| A | sharp | A major = 3 sharps |
| As | flat | B♭ far more common than A# |
| B | sharp | B major = 5 sharps |

Two display-name tables:

```typescript
const SHARP_NAMES: Record<PitchClass, string> = {
  C: 'C', Cs: 'C♯', D: 'D', Ds: 'D♯', E: 'E', F: 'F',
  Fs: 'F♯', G: 'G', Gs: 'G♯', A: 'A', As: 'A♯', B: 'B',
};

const FLAT_NAMES: Record<PitchClass, string> = {
  C: 'C', Cs: 'D♭', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
  Fs: 'G♭', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
};
```

**Exported function:**

```typescript
export function displayPitchName(pitchClass: PitchClass, chordRoot: PitchClass): string
```

Returns the appropriately-spelled pitch name based on the chord root's preference.

**NoteCards change:** Replace `DISPLAY_NAMES[pitch.pitchClass]` with `displayPitchName(pitch.pitchClass, root)`.

### 4. Shareable URLs

**New module:** `src/engine/urlState.ts`

**New dependency:** `fflate` (~3KB gzipped, pure JS, no WASM)

**Encoding scheme:** deflate-compressed base64url hash fragment.

**URL state keys** (abbreviated for compact URLs):

| Key | State | Type | Default |
|-----|-------|------|---------|
| `c` | chordText | string | `'Cmaj7 Am7 Dm7 G7 Em7 A7 Dm7 G7 Cmaj7 C7 Fmaj7 Fm6 Cmaj7 Am7 Dm7 G7 Cmaj7'` |
| `t` | tuning | `'just' \| 'equal'` | `'equal'` |
| `v` | voiceLeading | `'off' \| 'smooth' \| 'bass'` | `'smooth'` |
| `s` | playStyle | `'block' \| 'arpeggio'` | `'block'` |
| `p` | tempo | number | `0.8` |
| `n` | notationMode | `'standard' \| 'roman'` | `'standard'` |
| `k` | selectedKey | string (e.g. `'C'`, `'Am'`) | `'C'` |
| `g` | gravityCenter | number | `60` |
| `d` | targetSpread | number | `12` |

**Serialization flow:**
1. Collect all stateful values
2. Compare each to its default; omit matching values
3. If no non-default values remain, clear the hash
4. Otherwise: `JSON.stringify` → `deflateSync` (fflate) → base64url encode → set as `window.location.hash`

**Deserialization flow:**
1. On app mount, read `window.location.hash`
2. If empty, use defaults
3. Otherwise: strip `#` → base64url decode → `inflateSync` → `JSON.parse` → merge with defaults
4. Invalid/corrupted hash → fall back to defaults silently (no error shown)

**App.tsx integration:**
- Extract default values into a shared `DEFAULTS` constant (used by both state initialization and URL module)
- On mount: call `decodeUrlState()`, use result as initial state via lazy initializers: `useState(() => urlState.chordText ?? DEFAULTS.chordText)`
- On state change: `useEffect` with debounce (~300ms) calls `encodeUrlState(currentState)` → `history.replaceState` (not `pushState`, to avoid polluting browser history)
- No `hashchange` listener needed since we're the only writer

**Exported API:**

```typescript
interface AppState {
  chordText: string;
  tuning: Tuning;
  voiceLeading: VoiceLeading;
  playStyle: PlayStyle;
  tempo: number;
  notationMode: NotationMode;
  selectedKey: KeySignature;
  gravityCenter: number;
  targetSpread: number;
}

export const DEFAULTS: AppState;
export function encodeUrlState(state: AppState): string;       // returns hash string
export function decodeUrlState(hash: string): Partial<AppState>; // returns non-default values
```

## Testing

- **Enharmonic spelling:** Unit tests in `musicTheory.test.ts` — verify sharp-root chords (F#, D, A, etc.) produce sharp names and flat-root chords (C, Eb, Bb, etc.) produce flat names.
- **URL encoding round-trip:** Unit tests in `urlState.test.ts` — verify `decode(encode(state)) === state` for various state combinations, default omission, and corrupted input resilience.
- **Defaults and disclosure triangle:** Manual verification (no automated tests needed for one-line default changes and HTML structure).
- Existing tests must continue passing.

## Error Handling

- Corrupted URL hash → silent fallback to defaults (console.warn for debugging)
- Missing `fflate` at runtime → unlikely since it's a build dependency, but the module should catch and fall back

## Security

- URL hash is never sent to the server (fragment-only)
- No user-generated content is eval'd; JSON.parse on validated input only
- deflate/inflate operate on trusted local state; no injection vector
