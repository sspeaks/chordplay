# Voice Gravity & Spread Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add gravity-toward-center and target-spread forces to the smooth voice-leading algorithm, with user-adjustable sliders.

**Architecture:** Extend the existing permutation-based cost function in `voiceLeading.ts` with gravity-biased pitch placement and a spread deviation penalty. Add two conditional range sliders to `Toolbar.tsx` that appear when voice leading is active. Default voice leading to "Smooth".

**Tech Stack:** TypeScript, React, Vitest, Vite

**Spec:** `docs/superpowers/specs/2026-03-24-voice-gravity-spread-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `web/src/types.ts` | Modify | Add `VoiceLeadingOptions` interface |
| `web/src/engine/musicTheory.ts` | Modify | Add `midiToNoteName` helper |
| `web/src/engine/voiceLeading.ts` | Modify | Gravity-biased placement, spread penalty, export constants |
| `web/src/components/Toolbar.tsx` | Modify | Conditional gravity/spread sliders |
| `web/src/App.tsx` | Modify | New state, default change, wire options to engine and toolbar |
| `web/src/styles/index.css` | Modify | Styles for `.voice-leading-options` |
| `web/src/engine/voiceLeading.test.ts` | Modify | Tests for gravity and spread |

---

### Task 1: Add `VoiceLeadingOptions` type and `midiToNoteName` helper

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/engine/musicTheory.ts`

- [ ] **Step 1: Add `VoiceLeadingOptions` to types.ts**

At the end of `web/src/types.ts`, add:

```typescript
export interface VoiceLeadingOptions {
  readonly gravityCenter?: number;   // MIDI note number (default: 55 = G3)
  readonly targetSpread?: number;    // semitones (default: 18 = 1.5 octaves)
}
```

- [ ] **Step 2: Write failing test for `midiToNoteName`**

Add a new describe block in `web/src/engine/voiceLeading.test.ts` (or create a small test inline — musicTheory already has tests if they exist). Since the existing test file imports from musicTheory, add to `web/src/engine/voiceLeading.test.ts`:

```typescript
import { pitchToMidi, voiceChord, midiToNoteName } from './musicTheory';

describe('midiToNoteName', () => {
  it('converts MIDI 60 to C4', () => {
    expect(midiToNoteName(60)).toBe('C4');
  });

  it('converts MIDI 55 to G3', () => {
    expect(midiToNoteName(55)).toBe('G3');
  });

  it('converts MIDI 36 to C2', () => {
    expect(midiToNoteName(36)).toBe('C2');
  });

  it('converts MIDI 61 to C♯4', () => {
    expect(midiToNoteName(61)).toBe('C♯4');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts`
Expected: FAIL — `midiToNoteName` is not exported from `./musicTheory`

- [ ] **Step 4: Implement `midiToNoteName` in musicTheory.ts**

Add to `web/src/engine/musicTheory.ts` after the `equalFrequencies` function:

```typescript
const MIDI_NOTE_NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];

export function midiToNoteName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${MIDI_NOTE_NAMES[pc]}${octave}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/types.ts web/src/engine/musicTheory.ts web/src/engine/voiceLeading.test.ts
git commit -m "feat: add VoiceLeadingOptions type and midiToNoteName helper

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Add gravity and spread to `smoothVoice`

**Files:**
- Modify: `web/src/engine/voiceLeading.ts`
- Modify: `web/src/engine/voiceLeading.test.ts`

- [ ] **Step 1: Write failing test — gravity pulls toward center**

Add to `web/src/engine/voiceLeading.test.ts` inside a new `describe('smoothVoice with gravity/spread')` block:

```typescript
describe('smoothVoice with gravity/spread', () => {
  it('gravity pulls voicing toward center', () => {
    // Start with a high voicing (octave 5)
    const highPrev: Pitch[] = [
      { pitchClass: 'C', octave: 5 },
      { pitchClass: 'E', octave: 5 },
      { pitchClass: 'G', octave: 5 },
      { pitchClass: 'C', octave: 6 },
    ];
    const nextPCs: PitchClass[] = ['F', 'A', 'C', 'F'];

    // With gravity toward G3 (MIDI 55) — should pull down
    const withGravity = smoothVoice('equal', highPrev, nextPCs, { gravityCenter: 55 });
    // Without gravity (center at same high register) — stays high
    const withoutGravity = smoothVoice('equal', highPrev, nextPCs, { gravityCenter: 84 });

    const gravityCentroid = withGravity.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    const noGravityCentroid = withoutGravity.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;

    expect(gravityCentroid).toBeLessThan(noGravityCentroid);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts`
Expected: FAIL — `smoothVoice` doesn't accept 4th argument (or ignores it)

- [ ] **Step 3: Write failing test — spread penalty favors target width**

Add to the same `describe` block:

```typescript
  it('spread penalty favors target width', () => {
    const prev: Pitch[] = [
      { pitchClass: 'C', octave: 3 },
      { pitchClass: 'E', octave: 3 },
      { pitchClass: 'G', octave: 3 },
      { pitchClass: 'C', octave: 4 },
    ];
    const nextPCs: PitchClass[] = ['D', 'Fs', 'A', 'D'];

    const narrow = smoothVoice('equal', prev, nextPCs, { targetSpread: 12 });
    const wide = smoothVoice('equal', prev, nextPCs, { targetSpread: 30 });

    const narrowSpread = Math.max(...narrow.map(pitchToMidi)) - Math.min(...narrow.map(pitchToMidi));
    const wideSpread = Math.max(...wide.map(pitchToMidi)) - Math.min(...wide.map(pitchToMidi));

    // The narrow-target voicing should have equal or smaller spread
    expect(narrowSpread).toBeLessThanOrEqual(wideSpread);
  });
```

- [ ] **Step 4: Write failing test — gravity + spread tension still produces valid voicing**

```typescript
  it('handles gravity + spread tension gracefully', () => {
    const prev: Pitch[] = [
      { pitchClass: 'C', octave: 3 },
      { pitchClass: 'E', octave: 3 },
      { pitchClass: 'G', octave: 3 },
      { pitchClass: 'C', octave: 4 },
    ];
    const nextPCs: PitchClass[] = ['F', 'A', 'C', 'F'];

    // Extreme: low gravity center + wide spread
    const result = smoothVoice('equal', prev, nextPCs, { gravityCenter: 36, targetSpread: 30 });
    expect(result).toHaveLength(4);
    result.forEach(p => {
      expect(p.pitchClass).toBeDefined();
      expect(typeof p.octave).toBe('number');
    });
  });
```

- [ ] **Step 5: Write failing test — backward compatibility (no options)**

```typescript
  it('works without options (backward compatible)', () => {
    const prev = voiceChord('C', 'Major', 0);
    const result = smoothVoice('equal', prev, ['F', 'A', 'C', 'F']);
    expect(result).toHaveLength(4);
    const midis = result.map(pitchToMidi);
    const prevMidis = prev.map(pitchToMidi);
    const maxMovement = Math.max(...midis.map((m, i) => Math.abs(m - prevMidis[i]!)));
    expect(maxMovement).toBeLessThanOrEqual(7);
  });
```

- [ ] **Step 6: Write failing test — cluster avoidance still works with gravity**

```typescript
  it('still avoids semitone clusters with gravity enabled', () => {
    const prev: Pitch[] = [
      { pitchClass: 'C', octave: 3 },
      { pitchClass: 'E', octave: 3 },
      { pitchClass: 'G', octave: 3 },
      { pitchClass: 'C', octave: 4 },
    ];
    const result = smoothVoice('equal', prev, ['C', 'E', 'G', 'C'], { gravityCenter: 55 });
    const midis = result.map(pitchToMidi).sort((a, b) => a - b);
    const gaps = midis.slice(1).map((m, i) => m - midis[i]!);
    expect(gaps.every(g => g !== 1)).toBe(true);
  });
```

- [ ] **Step 7: Run all new tests to verify they fail**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts`
Expected: Multiple failures in the gravity/spread tests

- [ ] **Step 8: Implement gravity-biased placement and spread penalty**

Modify `web/src/engine/voiceLeading.ts`. Add imports and constants at the top, then modify `smoothVoice`:

```typescript
import type { Pitch, PitchClass, ChordSymbol, SmoothMode, VoiceLeadingOptions } from '../types';
import { pitchToMidi, nearestPitch, voiceChord, chordPitchClasses } from './musicTheory';

export const GRAVITY_STRENGTH = 0.3;
export const SPREAD_WEIGHT = 2;
export const DEFAULT_GRAVITY_CENTER = 55;  // G3
export const DEFAULT_TARGET_SPREAD = 18;   // 1.5 octaves
```

Update `smoothVoice` signature and body:

```typescript
export function smoothVoice(
  mode: SmoothMode,
  prevPitches: Pitch[],
  nextPCs: PitchClass[],
  options?: VoiceLeadingOptions,
): Pitch[] {
  const { gravityCenter = DEFAULT_GRAVITY_CENTER, targetSpread = DEFAULT_TARGET_SPREAD } = options ?? {};

  const sorted = [...prevPitches].sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
  const prevMidis = sorted.map(pitchToMidi);
  const weights = mode === 'bass' ? [2, 1, 1, 1] : [1, 1, 1, 1];

  // Bias placement targets toward gravity center
  const biasedTargets = prevMidis.map(pm =>
    Math.round(pm * (1 - GRAVITY_STRENGTH) + gravityCenter * GRAVITY_STRENGTH)
  );

  const perms = permutations(nextPCs);

  let bestCost = Infinity;
  let bestMax = Infinity;
  let bestPlaced: Pitch[] = sorted;

  for (const perm of perms) {
    const placed = perm.map((pc, i) => nearestPitch(pc, biasedTargets[i]!));
    const placedMidis = placed.map(pitchToMidi);
    const movements = prevMidis.map((pm, i) => Math.abs(pm - placedMidis[i]!));
    const totalCost = movements.reduce((sum, m, i) => sum + m * weights[i]!, 0);
    const maxMove = Math.max(...movements);

    const sortedMidis = [...placedMidis].sort((a, b) => a - b);
    const gaps = sortedMidis.slice(1).map((m, i) => m - sortedMidis[i]!);
    const clusterPenalty = 12 * gaps.filter(g => g === 1).length;

    const actualSpread = sortedMidis[sortedMidis.length - 1]! - sortedMidis[0]!;
    const spreadPenalty = SPREAD_WEIGHT * Math.abs(actualSpread - targetSpread);

    const cost = totalCost + clusterPenalty + spreadPenalty;

    if (cost < bestCost || (cost === bestCost && maxMove < bestMax)) {
      bestCost = cost;
      bestMax = maxMove;
      bestPlaced = placed;
    }
  }

  return bestPlaced;
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts`
Expected: ALL PASS (both new gravity/spread tests and existing tests)

- [ ] **Step 10: Commit**

```bash
git add web/src/engine/voiceLeading.ts web/src/engine/voiceLeading.test.ts
git commit -m "feat: add gravity-biased placement and spread penalty to smoothVoice

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Wire options through `voiceChordSequence`

**Files:**
- Modify: `web/src/engine/voiceLeading.ts`
- Modify: `web/src/engine/voiceLeading.test.ts`

- [ ] **Step 1: Write failing integration test — long progression stays near gravity center**

Add to `web/src/engine/voiceLeading.test.ts`:

```typescript
describe('voiceChordSequence with gravity/spread', () => {
  it('gravity keeps long progression near center', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null },
      { root: 'G', quality: 'Dom7', inversion: null },
      { root: 'A', quality: 'Minor', inversion: null },
      { root: 'F', quality: 'Major', inversion: null },
      { root: 'D', quality: 'Minor', inversion: null },
      { root: 'G', quality: 'Dom7', inversion: null },
      { root: 'E', quality: 'Minor', inversion: null },
      { root: 'A', quality: 'Dom7', inversion: null },
      { root: 'D', quality: 'Minor', inversion: null },
      { root: 'G', quality: 'Dom7', inversion: null },
      { root: 'C', quality: 'Major', inversion: null },
    ];

    const withGravity = voiceChordSequence('equal', chords, { gravityCenter: 55 });
    const withoutGravity = voiceChordSequence('equal', chords, { gravityCenter: 84 });

    // Final voicing centroid should be closer to 55 with gravity=55
    const lastWithGravity = withGravity[withGravity.length - 1]!;
    const lastWithout = withoutGravity[withoutGravity.length - 1]!;
    const centroidWith = lastWithGravity.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;
    const centroidWithout = lastWithout.map(pitchToMidi).reduce((a, b) => a + b, 0) / 4;

    expect(Math.abs(centroidWith - 55)).toBeLessThan(Math.abs(centroidWithout - 55));
  });

  it('spread control keeps voicings near target width', () => {
    const chords: ChordSymbol[] = [
      { root: 'D', quality: 'Major', inversion: null },
      { root: 'A', quality: 'Dom7', inversion: null },
      { root: 'D', quality: 'Major', inversion: null },
      { root: 'G', quality: 'Major', inversion: null },
      { root: 'D', quality: 'Major', inversion: null },
    ];

    const narrow = voiceChordSequence('equal', chords, { targetSpread: 14 });
    const wide = voiceChordSequence('equal', chords, { targetSpread: 30 });

    const avgSpread = (voicings: Pitch[][]) => {
      const spreads = voicings.map(v => {
        const midis = v.map(pitchToMidi);
        return Math.max(...midis) - Math.min(...midis);
      });
      return spreads.reduce((a, b) => a + b, 0) / spreads.length;
    };

    expect(avgSpread(narrow)).toBeLessThan(avgSpread(wide));
  });

  it('options parameter is optional (backward compat)', () => {
    const chords: ChordSymbol[] = [
      { root: 'C', quality: 'Major', inversion: null },
      { root: 'F', quality: 'Major', inversion: null },
    ];
    const result = voiceChordSequence('equal', chords);
    expect(result).toHaveLength(2);
    result.forEach(v => expect(v).toHaveLength(4));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts`
Expected: FAIL — `voiceChordSequence` doesn't accept 3rd argument

- [ ] **Step 3: Update `voiceChordSequence` to accept and pass options**

In `web/src/engine/voiceLeading.ts`, update the signature and body:

```typescript
export function voiceChordSequence(
  mode: SmoothMode | null,
  chords: ChordSymbol[],
  options?: VoiceLeadingOptions,
): Pitch[][] {
  if (chords.length === 0) return [];

  if (mode === null) {
    return chords.map(c => voiceChord(c.root, c.quality, c.inversion ?? 0));
  }

  const first = chords[0]!;
  const firstVoicing = voiceChord(first.root, first.quality, first.inversion ?? 0);
  const result: Pitch[][] = [firstVoicing];

  let prev = firstVoicing;
  for (let i = 1; i < chords.length; i++) {
    const chord = chords[i]!;
    let voicing: Pitch[];
    if (chord.inversion !== null) {
      voicing = voiceChord(chord.root, chord.quality, chord.inversion);
    } else {
      voicing = smoothVoice(mode, prev, chordPitchClasses(chord.root, chord.quality), options);
    }
    result.push(voicing);
    prev = voicing;
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/engine/voiceLeading.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/engine/voiceLeading.ts web/src/engine/voiceLeading.test.ts
git commit -m "feat: wire VoiceLeadingOptions through voiceChordSequence

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Add gravity/spread sliders to Toolbar

**Files:**
- Modify: `web/src/components/Toolbar.tsx`
- Modify: `web/src/styles/index.css`

- [ ] **Step 1: Add slider props to Toolbar**

In `web/src/components/Toolbar.tsx`, update `ToolbarProps` interface to add 4 new props:

```typescript
interface ToolbarProps {
  voiceLeading: VoiceLeading;
  playStyle: PlayStyle;
  tuning: Tuning;
  notationMode: NotationMode;
  selectedKey: KeySignature;
  gravityCenter: number;
  targetSpread: number;
  onVoiceLeadingChange: (mode: VoiceLeading) => void;
  onPlayStyleChange: (style: PlayStyle) => void;
  onTuningChange: (tuning: Tuning) => void;
  onNotationModeChange: (mode: NotationMode) => void;
  onKeyChange: (key: KeySignature) => void;
  onGravityCenterChange: (value: number) => void;
  onTargetSpreadChange: (value: number) => void;
  onToggleSyntaxHelp: () => void;
  onExportWav: () => void;
  exportDisabled: boolean;
  isExporting: boolean;
}
```

- [ ] **Step 2: Add `midiToNoteName` import and destructure new props**

Add import at top:
```typescript
import { midiToNoteName } from '../engine/musicTheory';
```

Update the function signature to destructure new props:
```typescript
export default function Toolbar({
  voiceLeading,
  playStyle,
  tuning,
  notationMode,
  selectedKey,
  gravityCenter,
  targetSpread,
  onVoiceLeadingChange,
  onPlayStyleChange,
  onTuningChange,
  onNotationModeChange,
  onKeyChange,
  onGravityCenterChange,
  onTargetSpreadChange,
  onToggleSyntaxHelp,
  onExportWav,
  exportDisabled,
  isExporting,
}: ToolbarProps) {
```

- [ ] **Step 3: Add conditional slider JSX**

After the Voice Leading `ToggleGroup` (and before the Style `ToggleGroup`), add:

```tsx
      {(voiceLeading === 'smooth' || voiceLeading === 'bass') && (
        <div className="voice-leading-options">
          <label className="slider-label">
            <span className="slider-name">Gravity</span>
            <input
              type="range"
              min={36}
              max={72}
              value={gravityCenter}
              onChange={e => onGravityCenterChange(Number(e.target.value))}
              className="vl-slider"
            />
            <span className="slider-value">{midiToNoteName(gravityCenter)}</span>
          </label>
          <label className="slider-label">
            <span className="slider-name">Spread</span>
            <input
              type="range"
              min={12}
              max={36}
              value={targetSpread}
              onChange={e => onTargetSpreadChange(Number(e.target.value))}
              className="vl-slider"
            />
            <span className="slider-value">{(targetSpread / 12).toFixed(1)} oct</span>
          </label>
        </div>
      )}
```

- [ ] **Step 4: Add CSS styles for the sliders**

Add to `web/src/styles/index.css` before the `/* Responsive */` media query section:

```css
/* Voice Leading Options */
.voice-leading-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 200px;
}

.slider-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #aaa;
}

.slider-name {
  min-width: 4rem;
  color: #888;
}

.vl-slider {
  flex: 1;
  accent-color: #4a6fa5;
  min-width: 100px;
}

.slider-value {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  min-width: 3rem;
  text-align: right;
  color: #e0e0e0;
  font-size: 0.85rem;
}
```

Also add to the responsive section inside `@media (max-width: 768px)`:

```css
  .voice-leading-options {
    width: 100%;
  }
```

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Toolbar.tsx web/src/styles/index.css
git commit -m "feat: add gravity/spread sliders to Toolbar (conditional on voice leading)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Wire App state and change default voice leading

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add imports for constants and type**

Update the import from voiceLeading to include constants:
```typescript
import { voiceChordSequence, DEFAULT_GRAVITY_CENTER, DEFAULT_TARGET_SPREAD } from './engine/voiceLeading';
```

Update the type import to include `VoiceLeadingOptions`:
```typescript
import { VoiceLeading, PlayStyle, Tuning, ChordSymbol, Pitch, PitchClass, NotationMode, KeySignature, VoiceLeadingOptions } from './types';
```

- [ ] **Step 2: Add state and change default**

Inside the `App` component, change the voiceLeading default and add new state:

```typescript
const [voiceLeading, setVoiceLeading] = useState<VoiceLeading>('smooth');  // was 'off'
```

Add after the existing state declarations:

```typescript
const [gravityCenter, setGravityCenter] = useState(DEFAULT_GRAVITY_CENTER);
const [targetSpread, setTargetSpread] = useState(DEFAULT_TARGET_SPREAD);
```

- [ ] **Step 3: Create options object and pass to voiceChordSequence**

Update the voicings computation to pass options:

```typescript
const voiceLeadingOptions: VoiceLeadingOptions = { gravityCenter, targetSpread };
const voicings = validChords.length > 0
  ? voiceChordSequence(smoothMode, validChords, voiceLeadingOptions)
  : [];
```

- [ ] **Step 4: Pass new props to Toolbar**

Update the `<Toolbar>` JSX to include the new props:

```tsx
<Toolbar
  voiceLeading={voiceLeading}
  playStyle={playStyle}
  tuning={tuning}
  notationMode={notationMode}
  selectedKey={selectedKey}
  gravityCenter={gravityCenter}
  targetSpread={targetSpread}
  onVoiceLeadingChange={setVoiceLeading}
  onPlayStyleChange={setPlayStyle}
  onTuningChange={setTuning}
  onNotationModeChange={handleNotationModeChange}
  onKeyChange={handleKeyChange}
  onGravityCenterChange={setGravityCenter}
  onTargetSpreadChange={setTargetSpread}
  onToggleSyntaxHelp={() => setSyntaxHelpOpen(!syntaxHelpOpen)}
  onExportWav={handleExportWav}
  exportDisabled={validChords.length === 0}
  isExporting={isExporting}
/>
```

- [ ] **Step 5: Verify the build passes**

Run: `cd web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Run all tests**

Run: `cd web && npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: wire gravity/spread state in App, default voice leading to smooth

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Final verification and cleanup

- [ ] **Step 1: Run full test suite**

Run: `cd web && npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run dev server and manually verify**

Run: `cd web && npx vite --host` (if possible, open in browser to verify sliders appear and function)

- [ ] **Step 4: Verify sliders are hidden when voice leading is off**

In the browser, click "Off" — sliders should disappear. Click "Smooth" or "Bass-weighted" — sliders should reappear.

- [ ] **Step 5: Commit any fixes if needed, then tag completion**

If all checks pass, the feature is complete.
