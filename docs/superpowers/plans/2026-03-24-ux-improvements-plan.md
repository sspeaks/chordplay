# Implementation Plan: UX Improvements

**Spec:** `docs/superpowers/specs/2026-03-24-ux-improvements-design.md`
**Branch:** `ux-improvements`

## Problem

ChordPlay has suboptimal defaults (just intonation, G3 gravity, slow tempo), always-visible advanced controls, incorrect enharmonic spelling, and no way to share progressions via URL.

## Approach

Four independent tasks (1-3 parallelizable, 4 depends on 1 for finalized defaults). Each task gets its own commit.

---

## Task 1: Default Changes

**Files:** `web/src/App.tsx`, `web/src/engine/voiceLeading.ts`, `web/src/types.ts`

### Steps

1. In `web/src/engine/voiceLeading.ts` line 6, change `DEFAULT_GRAVITY_CENTER = 55` → `60`
2. In `web/src/App.tsx` line 20, change `useState<Tuning>('just')` → `useState<Tuning>('equal')`
3. In `web/src/App.tsx` line 21, change `useState(1.2)` → `useState(0.8)`
4. In `web/src/types.ts` line 50, update JSDoc comment `default: 55 = G3` → `default: 60 = C4`
5. Run `npm test` — verify all tests pass (no test hardcodes these defaults)

---

## Task 2: Disclosure Triangle for Gravity/Spread

**Files:** `web/src/components/Toolbar.tsx`, `web/src/styles/index.css`

### Steps

1. In `web/src/components/Toolbar.tsx` lines 145-172, replace the outer `<div className="voice-leading-options">` with:
   ```tsx
   <details className="voice-leading-advanced">
     <summary>Advanced</summary>
     <div className="voice-leading-options">
       {/* existing gravity slider label */}
       {/* existing spread slider label */}
     </div>
   </details>
   ```
   Keep the existing conditional `(voiceLeading === 'smooth' || voiceLeading === 'bass')` wrapping the whole thing.

2. In `web/src/styles/index.css` after line 613 (after `.voice-leading-options` block), add CSS:
   ```css
   .voice-leading-advanced summary {
     cursor: pointer;
     color: #888;
     font-size: 0.85rem;
     user-select: none;
   }
   .voice-leading-advanced summary:hover {
     color: #e0e0e0;
   }
   ```

3. Verify visually with `npm run dev` — triangle collapsed by default, expands to show sliders.

---

## Task 3: Context-Aware Enharmonic Spelling

**Files:** `web/src/engine/musicTheory.ts`, `web/src/engine/musicTheory.test.ts`, `web/src/components/NoteCards.tsx`

### Steps

1. In `web/src/engine/musicTheory.ts`, add after the last export (~line 158):

   ```typescript
   const SHARP_NAMES: Record<PitchClass, string> = {
     C: 'C', Cs: 'C♯', D: 'D', Ds: 'D♯', E: 'E', F: 'F',
     Fs: 'F♯', G: 'G', Gs: 'G♯', A: 'A', As: 'A♯', B: 'B',
   };

   const FLAT_NAMES: Record<PitchClass, string> = {
     C: 'C', Cs: 'D♭', D: 'D', Ds: 'E♭', E: 'E', F: 'F',
     Fs: 'G♭', G: 'G', Gs: 'A♭', A: 'A', As: 'B♭', B: 'B',
   };

   const ROOT_PREFERS_SHARP: Record<PitchClass, boolean> = {
     C: false, Cs: false, D: true, Ds: false, E: true, F: false,
     Fs: true, G: true, Gs: false, A: true, As: false, B: true,
   };

   export function displayPitchName(pitchClass: PitchClass, chordRoot: PitchClass): string {
     return ROOT_PREFERS_SHARP[chordRoot] ? SHARP_NAMES[pitchClass] : FLAT_NAMES[pitchClass];
   }
   ```

2. In `web/src/engine/musicTheory.test.ts`, add after the last test (~line 219):

   ```typescript
   describe('displayPitchName', () => {
     it('sharp-root chords display sharps', () => {
       // F# chord: A# not Bb
       expect(displayPitchName('As', 'Fs')).toBe('A♯');
       // D chord: F# not Gb, C# not Db
       expect(displayPitchName('Fs', 'D')).toBe('F♯');
       expect(displayPitchName('Cs', 'D')).toBe('C♯');
     });

     it('flat-root chords display flats', () => {
       // Eb chord: Eb, Ab, Bb
       expect(displayPitchName('Ds', 'Ds')).toBe('E♭');
       expect(displayPitchName('Gs', 'Ds')).toBe('A♭');
       expect(displayPitchName('As', 'Ds')).toBe('B♭');
     });

     it('C root uses flats (conventional)', () => {
       expect(displayPitchName('As', 'C')).toBe('B♭');
       expect(displayPitchName('Ds', 'C')).toBe('E♭');
     });

     it('natural notes are unaffected by root', () => {
       expect(displayPitchName('C', 'Fs')).toBe('C');
       expect(displayPitchName('G', 'Ds')).toBe('G');
     });
   });
   ```

3. Run `npm test` — verify new tests pass.

4. In `web/src/components/NoteCards.tsx`:
   - Add import: `import { ..., displayPitchName } from '../engine/musicTheory';`
   - Line 54: replace `{DISPLAY_NAMES[pitch.pitchClass]}{pitch.octave}` with `{displayPitchName(pitch.pitchClass, root)}{pitch.octave}`
   - Delete the `DISPLAY_NAMES` constant (lines 12-15) — now unused.

5. Run `npm test` and `npm run build` — verify clean.

---

## Task 4: Shareable URLs (depends on Task 1)

**Files:** New `web/src/engine/urlState.ts`, new `web/src/engine/urlState.test.ts`, `web/src/App.tsx`, `web/package.json`

### Steps

1. Install dependency:
   ```bash
   cd web && npm install fflate
   ```

2. Create `web/src/engine/urlState.ts`:

   ```typescript
   import { deflateSync, inflateSync } from 'fflate';
   import type { Tuning, VoiceLeading, PlayStyle, NotationMode, KeySignature } from '../types';

   export interface AppState {
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

   export const DEFAULTS: AppState = {
     chordText: 'Cmaj7 Am7 Dm7 G7 Em7 A7 Dm7 G7 Cmaj7 C7 Fmaj7 Fm6 Cmaj7 Am7 Dm7 G7 Cmaj7',
     tuning: 'equal',
     voiceLeading: 'smooth',
     playStyle: 'block',
     tempo: 0.8,
     notationMode: 'standard',
     selectedKey: { root: 'C', quality: 'major' },
     gravityCenter: 60,
     targetSpread: 12,
   };

   // Abbreviated keys for compact URLs
   type UrlKeys = { c?: string; t?: string; v?: string; s?: string; p?: number; n?: string; k?: string; g?: number; d?: number };

   function toBase64Url(bytes: Uint8Array): string {
     let binary = '';
     for (const b of bytes) binary += String.fromCharCode(b);
     return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
   }

   function fromBase64Url(str: string): Uint8Array {
     const padded = str.replace(/-/g, '+').replace(/_/g, '/');
     const binary = atob(padded);
     const bytes = new Uint8Array(binary.length);
     for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
     return bytes;
   }

   function encodeKey(key: KeySignature): string {
     return key.quality === 'minor' ? key.root + 'm' : key.root;
   }

   function decodeKey(s: string): KeySignature {
     if (s.endsWith('m')) return { root: s.slice(0, -1) as any, quality: 'minor' };
     return { root: s as any, quality: 'major' };
   }

   export function encodeUrlState(state: AppState): string {
     const d: UrlKeys = {};
     if (state.chordText !== DEFAULTS.chordText) d.c = state.chordText;
     if (state.tuning !== DEFAULTS.tuning) d.t = state.tuning;
     if (state.voiceLeading !== DEFAULTS.voiceLeading) d.v = state.voiceLeading;
     if (state.playStyle !== DEFAULTS.playStyle) d.s = state.playStyle;
     if (state.tempo !== DEFAULTS.tempo) d.p = state.tempo;
     if (state.notationMode !== DEFAULTS.notationMode) d.n = state.notationMode;
     if (state.selectedKey.root !== DEFAULTS.selectedKey.root ||
         state.selectedKey.quality !== DEFAULTS.selectedKey.quality) d.k = encodeKey(state.selectedKey);
     if (state.gravityCenter !== DEFAULTS.gravityCenter) d.g = state.gravityCenter;
     if (state.targetSpread !== DEFAULTS.targetSpread) d.d = state.targetSpread;

     if (Object.keys(d).length === 0) return '';
     const json = JSON.stringify(d);
     const compressed = deflateSync(new TextEncoder().encode(json));
     return toBase64Url(compressed);
   }

   export function decodeUrlState(hash: string): Partial<AppState> {
     if (!hash || hash === '#') return {};
     try {
       const raw = hash.startsWith('#') ? hash.slice(1) : hash;
       if (!raw) return {};
       const bytes = fromBase64Url(raw);
       const json = new TextDecoder().decode(inflateSync(bytes));
       const d: UrlKeys = JSON.parse(json);
       const result: Partial<AppState> = {};
       if (d.c !== undefined) result.chordText = d.c;
       if (d.t !== undefined) result.tuning = d.t as Tuning;
       if (d.v !== undefined) result.voiceLeading = d.v as VoiceLeading;
       if (d.s !== undefined) result.playStyle = d.s as PlayStyle;
       if (d.p !== undefined) result.tempo = d.p;
       if (d.n !== undefined) result.notationMode = d.n as NotationMode;
       if (d.k !== undefined) result.selectedKey = decodeKey(d.k);
       if (d.g !== undefined) result.gravityCenter = d.g;
       if (d.d !== undefined) result.targetSpread = d.d;
       return result;
     } catch {
       console.warn('ChordPlay: invalid URL state, using defaults');
       return {};
     }
   }
   ```

3. Create `web/src/engine/urlState.test.ts`:

   ```typescript
   import { describe, it, expect } from 'vitest';
   import { encodeUrlState, decodeUrlState, DEFAULTS, AppState } from './urlState';

   describe('urlState', () => {
     it('round-trips full state', () => {
       const state: AppState = {
         ...DEFAULTS,
         chordText: 'Am F C G',
         tuning: 'just',
         tempo: 1.5,
       };
       const hash = encodeUrlState(state);
       const decoded = decodeUrlState(hash);
       expect(decoded.chordText).toBe('Am F C G');
       expect(decoded.tuning).toBe('just');
       expect(decoded.tempo).toBe(1.5);
     });

     it('all-defaults produces empty hash', () => {
       expect(encodeUrlState(DEFAULTS)).toBe('');
     });

     it('only encodes non-default values', () => {
       const state = { ...DEFAULTS, tuning: 'just' as const };
       const hash = encodeUrlState(state);
       const decoded = decodeUrlState(hash);
       expect(decoded.tuning).toBe('just');
       expect(decoded.chordText).toBeUndefined();
     });

     it('corrupted input returns empty object', () => {
       expect(decodeUrlState('#garbage!!!')).toEqual({});
     });

     it('empty hash returns empty object', () => {
       expect(decodeUrlState('')).toEqual({});
       expect(decodeUrlState('#')).toEqual({});
     });

     it('round-trips selectedKey', () => {
       const state = { ...DEFAULTS, selectedKey: { root: 'A' as const, quality: 'minor' as const } };
       const hash = encodeUrlState(state);
       const decoded = decodeUrlState(hash);
       expect(decoded.selectedKey).toEqual({ root: 'A', quality: 'minor' });
     });
   });
   ```

4. Run `npm test` — verify urlState tests pass.

5. Refactor `web/src/App.tsx` to use URL state:
   - Add imports: `import { DEFAULTS, encodeUrlState, decodeUrlState, AppState } from './engine/urlState';`
   - Before `App()`, decode initial state:
     ```typescript
     const initialUrlState = decodeUrlState(window.location.hash);
     ```
   - Replace all useState defaults with `initialUrlState.X ?? DEFAULTS.X` pattern:
     ```typescript
     const [chordText, setChordText] = useState(initialUrlState.chordText ?? DEFAULTS.chordText);
     const [tuning, setTuning] = useState<Tuning>(initialUrlState.tuning ?? DEFAULTS.tuning);
     // ... etc for all 9 state values
     ```
   - Remove the direct imports of `DEFAULT_GRAVITY_CENTER, DEFAULT_TARGET_SPREAD` from voiceLeading (use `DEFAULTS.gravityCenter` and `DEFAULTS.targetSpread` instead via urlState)
   - Add a `useEffect` after all state declarations for debounced URL sync:
     ```typescript
     useEffect(() => {
       const timer = setTimeout(() => {
         const state: AppState = { chordText, tuning, voiceLeading, playStyle, tempo, notationMode, selectedKey, gravityCenter, targetSpread };
         const hash = encodeUrlState(state);
         history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname);
       }, 300);
       return () => clearTimeout(timer);
     }, [chordText, tuning, voiceLeading, playStyle, tempo, notationMode, selectedKey, gravityCenter, targetSpread]);
     ```

6. Run `npm test && npm run build` — verify everything passes and compiles.

---

## Verification

After all 4 tasks:
1. `npm test` — all tests pass
2. `npm run build` — clean compilation
3. Manual: `npm run dev` — verify equal temperament default, C4 gravity, 0.8s tempo, collapsed advanced panel, correct enharmonic spelling for F#7 vs Eb chords, URL updates on state change, URL restores state on page reload.
